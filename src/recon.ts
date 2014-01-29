var totalRecords = 0;
var reconUndoStack : UndoStack;

interface Candidate {
  id: string;
  name: string[];
  score: number;
  match: boolean;
  type?: string;
}

function isUnreconciled(entity:tEntity):boolean {
    if (entity.isCVT())
        return false;
    return Arr.contains([undefined,null,""], entity.id);
}

function initializeReconciliation(onReady:()=>void) {
    totalRecords = rows.length;
    var rec_partition = Arr.partition(rows,isUnreconciled);
    //initialize queues and their event handlers
    automaticQueue = new EntityQueue();
    automaticQueue.addListener("changed", function() {
        var pctProgress = (((totalRecords - automaticQueue.size()) / totalRecords) * 100);
        $("#progressbar").progressbar("value", pctProgress);
        $("#progressbar label").html(pctProgress.toFixed(1) + "%");
    })
    automaticQueue.addListener("added", function(entity:tEntity) {
        entity['/rec_ui/rec_begun'] = true;
        //restarts autoreconciliation if something is added after it seems finished
        if (reconciliationBegun && !autoreconciling)
            autoReconcile();
    })
    manualQueue = new EntityQueue();
    manualQueue.addListener("changed", function() {
        $(".manual_count").html("("+manualQueue.size()+")");
    });
    manualQueue.addListener("added", function(entity:tEntity) {
        if (manualQueue.size() === 1)
            manualReconcile();
        if (manualQueue.size() === 2)
            renderReconChoices(entity);
    });

    //populate queues and begin reconciliation
    politeEach(rec_partition[0], function(_, unreconciledEntity) {
        automaticQueue.push(unreconciledEntity);
    }, function() {
        politeEach(rec_partition[1],function(_,reconciled_row){
            reconciled_row['/rec_ui/rec_begun'] = true;
            addReviewItem(reconciled_row, "previously");
            addColumnRecCases(reconciled_row);
        }, function() {
            freebase.fetchTypeInfo(typesSeen.getAll(), function() {
                $(".initialLoadingMessage").hide();
                reconciliationBegun = true;
                reconUndoStack = new UndoStack()
                setupOutput();
                onReady();
            });
        });
    });
}

function handleReconChoice(entity:tEntity, freebaseId:string) {
    manualQueue.remove(entity);
    $("#manualReconcile" + entity['/rec_ui/id']).remove();
    reconUndoStack.push(getReconciliationUndo(entity))
    entity.reconcileWith(freebaseId, false);
    addColumnRecCases(entity);
    manualReconcile();
}

function getReconciliationUndo(entity:tEntity) {
    //simple, stupid first pass: unreconcile the entity completely
    return function() {
        entity.unreconcile();
        displayReconChoices(entity['/rec_ui/id']);
        manualQueue.unshift(entity);
    }
}

function undoReconciliation() {
    reconUndoStack.pop();
}

/** @param {!tEntity} entity
  *
  */
function addColumnRecCases(entity:tEntity) {
    if (!automaticQueue) return;
    for (var key in entity) {
        var values = $.makeArray(entity[key]);
        $.each(values, function(_, value) {
            //skip it if it's not an entity
            if (!(value instanceof tEntity))
                return;
            //skip it if it's already gone through the queue
            if (value['/rec_ui/rec_begun'])
                return;

            value['/rec_ui/rec_begun'] = true;
            if (isUnreconciled(value) && value['/type/object/name']) {
                automaticQueue.push(value);
            }
            else {
                //if we're not going to reconcile it, add its children
                //to be reconciled
                addColumnRecCases(value);
                return;
            }
            totalRecords++;
        });
    }
}

/** @param {!tEntity} entity
    @param {boolean=} typeless
*/
function constructReconciliationQuery(entity:tEntity, typeless?:boolean) {
    var query = {}
    var headers = entity["/rec_ui/headers"];
    for (var i = 0; i < headers.length; i++) {
        var prop = headers[i];
        if (prop.charAt(0) != "/") continue;
        var parts = prop.split(":");
        $.each($.makeArray(entity.getChainedProperty(prop)),function(j, value) {
            var slot = query;
            if (value == undefined || value == "")
                return;
            if (parts.length === 1){
                slot[prop] = slot[prop] || [];
                slot[prop][j] = constructQueryPart(value);
                return;
            }
            slot[parts[0]]    = slot[parts[0]]    || [];
            slot[parts[0]][j] = slot[parts[0]][j] || {};
            slot = slot[parts[0]][j];
            $.each(parts.slice(1,parts.length-1), function(k,part) {
                slot[part] = slot[part] || {};
                slot = slot[part];
            });
            var lastPart = parts[parts.length-1];
            slot[lastPart] = constructQueryPart(value);
        })
    }
    if (typeless || !query['/type/object/type'])
        query['/type/object/type'] = ['/common/topic'];
    query = cleanup(query);
    entity['/rec_ui/recon_query'] = query;
    return query;

    function constructQueryPart(value:any):any {
        if (value instanceof tEntity && !Arr.contains([undefined, "", "None", "None (merged"], value.getID()))
            return {"id":value.getID(), "name":value["/type/object/name"]}
        if (value['/rec_ui/id'] !== undefined)
            return $.makeArray(value["/type/object/name"])[0];
        return value;
    }

    /* Removes undefined values, nulls, empty lists, empty objects,
       and collapses singleton arrays down to their single values
       to better feed the reconciliation service.  */
    function cleanup(value:any):any {
        switch(getType(value)){
        case "array":
            value = $.map(value, function(v) {
                return cleanup(v);
            });
            if (value.length === 0)
                return null;
            if (value.length === 1)
                return value[0];
            return value;
        case "object":
            var clone = {};
            for (var key in value) {
                var v = cleanup(value[key]);
                if (v === null || v === undefined)
                    continue;
                clone[key] = v;
            }
            if (isObjectEmpty(clone))
                return null;
            return clone;
        default:
            return value;
        }
    }
}

function getCandidates(entity:tEntity, callback:(entity:tEntity)=>void,
                       onError:(a:any)=>void, typeless?:boolean) {
  function handler(results:any) {
    if (results[0]['error']) {
      // Probably over rate, wait for a minute and then retry.
      setTimeout(function retry() {
        getCandidates(entity, callback, onError, typeless);
      }, 60 * 1000);
      return;
    }

    entity.reconResults = cleanResults(results[0]['result']);
    callback(entity);
  }
  function cleanResults(results:any):Candidate[] {
    function transformCandidate(candidate:any):Candidate {
      return {
        id: candidate.mid,
        name: [<string> candidate.name],
        score: candidate.confidence,
        match: false
      };
    }
    if (results.match) {
      var match = transformCandidate(results.match);
      match.match = true;
      return [match];
    }
    var candidates = results.candidate || [];
    var to_return : Candidate[] = [];
    for (var i = 0; i < candidates.length; i++) {
      to_return.push(transformCandidate(candidates[i]));
    }
    return to_return;
  }
  function getParams() {
    var structured_query = constructReconciliationQuery(entity,typeless);
    var params = {
      name: [],
      kind: [],
      prop: [],
      limit: 4,
      key: '',
    };
    //Concorde only supports one name for something
    params['name'] = $.makeArray(structured_query["/type/object/name"])[0];
    params['kind'] = $.makeArray(structured_query["/type/object/type"]);
    params['prop'] = [];
    walkTree(structured_query, function(path, value) {
      var key = path.join(".");
      if (key === "/type/object/name" || key === "/type/object/type") {
        return;
      }
      params['prop'].push(key + ":" + value);
    });
    return params;
  }
  function walkTree(tree:Object, onLeaf:(path:string[], value:any)=>void) {
    var path = [];
    function walk(node) {
      for (var key in node) {
        path.push(key);
        $.each($.makeArray(node[key]), function(_, value) {
          var type = getType(value);
          if (type === "object") {
            walk(value);
          } else {
            var pathCopy = path.slice();
            onLeaf(path.slice(), value);
          }
        });
        path.pop();
      }
    }
    walk(tree);
  }

  var base_url = reconciliation_url;
  var defaultLimit = 4;
  var limit = defaultLimit;
  if (entity.reconResults)
    limit = Math.max(entity.reconResults.length * 2, defaultLimit);
  if (!entity.typelessRecon && typeless){
    entity.typelessRecon = true;
    limit = defaultLimit;
  }
  var params = getParams();
  params.limit = limit;
  params.key = api_key;

  $.ajax('https://www.googleapis.com/rpc', {
    dataType:'json',
    contentType:'application/json-rpc',
    type:'POST',
    beforeSend: () => {},
    data:JSON.stringify([{
      "jsonrpc" : "2.0",
      "id" : "1",

      "method" : "freebase.reconcile",
      "apiVersion" : "v1",

      "params" : params
    }]),
    success:handler
  });
}
