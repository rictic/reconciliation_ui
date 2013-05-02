// ========================================================================
// Copyright (c) 2008-2009, Metaweb Technologies, Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY METAWEB TECHNOLOGIES AND CONTRIBUTORS
// ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL METAWEB
// TECHNOLOGIES OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
// OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
// DAMAGE.
// ========================================================================


/*
**  Rendering the spreadsheet back to the user
*/

function onDisplayOutputScreen() {
    addTimeout(() => checkLogin(),0);
    addTimeout(() => displayOutput(),0);
    addTimeout(() => prepareTriples(),0);
}
function onHideOutputScreen() {
    if (spreadsheetRendererYielder)
        spreadsheetRendererYielder.cancel();
    if (tripleGetterYielder)
        tripleGetterYielder.cancel();
    $("#outputData").val("");
}

/** @param {!Array.<(string|undefined)>} arr
  * @returns {!string}
  */
function encodeLine(arr) {
    var values = [];
    for(var i = 0; i < headerPaths.length; i++){
        var val = arr[i];
        if (typeof val === "undefined")
            values.push("");
        else if (!val.match(/(\t|\"|\n)/))
            values.push(arr[i])
        else {
            val = val.replace(/"/g, '""');
            values.push('"' + val + '"');
        }
    }
    return values.join("\t");
}

/**
  * @param {!tEntity} row
  * @return {!Array.<!string>}
  */
function encodeRow(row) {
    var lines = [[]];
    $.each(headerPaths, function(i, headerPath) {
        var val = row.get(headerPath, true);
        if ($.isArray(val)) {
            for (var j = 0; j < val.length; j++) {
                if (lines[j] == undefined) lines[j] = [];
                lines[j][i] = textValue(val[j]);
            }
        }
        else
            lines[0][i] = textValue(val);
    });
    return $.map(lines,encodeLine);
}

function displayOutput() {
    $("#outputData").val("One moment, rendering...");

    function setOutput(val) {
        $("#outputData").val(val);
    }

    if ($("input.outputFormat:checked").val() === "spreadsheet")
        renderSpreadsheet(setOutput)
    else
        renderJSON(setOutput);
}

function renderJSON(callback) {
    callback(JSON.stringify(rows, null, 2));
}

var spreadsheetRendererYielder;
function renderSpreadsheet(onComplete) {
    var lines = [];
    lines.push(encodeLine($.map(headerPaths, function(headerPath){return headerPath.toString()})));
    spreadsheetRendererYielder = new Yielder();
    politeEach(rows, function(idx, row) {
        lines = lines.concat(encodeRow(row));
    },
    function() {
        onComplete(lines.join("\n"));
    }, spreadsheetRendererYielder);
}


function prepareTriples(callback?:(triples:SuperFreeq.TripleLoadCommand[])=>any) {
    $(".renderingTriples").show();
    $(".triplesRendered").hide();
    var assertNaked = !! $("#assert_naked_properties").attr('checked');
    getSFTriples(entities, assertNaked,
      function(triples) {
        if (callback) {
          callback(triples);
        }

        politeMap(triples,function(val){return JSON.stringify(val)},
            function(encodedTriples:string[]) {
                var tripleString = encodedTriples.join("\n");
                $(".triplesDisplay").html(tripleString);
                $(".triple_count").html("" + encodedTriples.length);
                $('#payload').val(tripleString);
                $(".renderingTriples").hide();
                $(".triplesRendered").show();
            }
        );
    });
}



function getSFTriples(entities, assertNakedProperties,
                      callback:(triples:SuperFreeq.TripleLoadCommand[])=>any) {
  function tripToSfTrip(triple:OldFreeqTriple):SuperFreeq.TripleLoadCommand {

    var obj = triple.o;

    if ($.type(obj) === "object") {
      var cvt_triples : SuperFreeq.CVTTriple[] = [];
      for (var prop in triple.o) {
        cvt_triples.push(populateTriple({pred: prop}, obj[prop]));
      }
      return {
        triple: {
          sub: triple.s,
          pred: triple.p,
        },
        cvt_triples: cvt_triples,
        assert_ids: true
      };
    }

    if ($.type(obj) === "number") {
      // SuperFreeq only wants strings, never numbers.
      // obj is the only place where this could have taken place.
      obj = '' + obj;
    }

    return {
      triple: populateTriple({sub: triple.s, pred: triple.p}, obj),
      assert_ids: true
    };
  }

  function populateTriple(triple, obj) {
    triple.obj_type = getObjType(triple.pred);
    if (triple.obj_type in {'TEXT':1, 'INT':1, 'FLOAT':1, 'BOOLEAN':1}) {
      triple.value
    }
    return {
        sub: triple.s,
        pred: triple.p,
        obj: obj,
        obj_type: getObjType(triple.p)
    }
  }

  function getObjType(pred) {
    var objType = {
      '/type/text': 'TEXT',
      '/type/datetime': 'DATETIME',
      '/type/boolean': 'BOOLEAN',
      '/type/int': 'INT',
      '/type/rawstring': 'RAWSTRING',
      '/type/uri': 'URL',
      '/type/key': 'KEY',
      '/type/float': 'FLOAT'
    }[freebase.getPropMetadata(pred).expected_type.id]
    return objType || 'ID'
  }

  getTriples(entities, assertNakedProperties,
    function(triples) {
      var results : SuperFreeq.TripleLoadCommand[] = [];
      politeEach(triples, function(_, triple) {
        var sfTriple = tripToSfTrip(triple);
        if (sfTriple) {
          results.push(sfTriple);
        }
      }, function() {
        callback(results);
      }, tripleGetterYielder);
    }
  )
}

interface OldFreeqTriple {
  s: string;
  p: string;
  o: any;
}

var tripleGetterYielder;
function getTriples(entities:tEntity[], assertNakedProperties:bool,
                    callback:(triples:OldFreeqTriple[])=>any) {
    tripleGetterYielder = new Yielder();
    function hasValidID(entity) {
        var id = getID(entity);
        if ($.isArray(id))
            id = id[0];
        return id !== undefined && $.trim(id) !== "";
    }
    function getID(entity) {
        return entity.getIdentifier();
    }
    function getValue(property, value) {
        if (getType(value) === "array") {
            if (value.length === 1)
                return getValue(property, value[0]);
            return $.map(value, function(val){return getValue(property, val)});
        }
        if (getType(value) === "object") {
            console.error("found an object for the value property " + property + "!");
            return undefined;
        }
        var stringValue = value;
        var expectedType = freebase.getPropMetadata(property).expected_type.id;
        if (Arr.contains(["/type/int","/type/float"], expectedType))
            return Number($.trim(stringValue));
        if (expectedType === "/type/boolean"){
            var lowerValue = $.trim(stringValue.toLowerCase());
            if (lowerValue === "true")
                return true;
            if (lowerValue === "false")
                return false;
            return undefined;
        }
        return stringValue;
    }
    function cvtObject(cvt) {
        var result = {};
        var props = cvt['/rec_ui/headers'];
        var empty = true;
        var type = $.makeArray(cvt['/type/object/type'])[0];
        for (var i = 0; i < props.length; i++){
            var predicate = props[i];
            if (predicate.indexOf(type) !== 0){
                if (predicate !== "/type/object/type")
                    console.warn("bad predicate " + predicate + " in CVT with type" + type);
                continue;
            }
            var value = cvt[predicate];
            // For SuperFreeq it's best if this predicate isn't shortened,
            // though that's how freeq liked it.
            var outputPredicate = predicate;
            if (isValueProperty(predicate)) {
                value = getValue(predicate, value);
                if (value){
                    result[outputPredicate] = value
                    empty = false;
                }
            }
            else {
                value = $.makeArray(value);
                value = Arr.filter(value, function(val){return !val['/rec_ui/toplevel_entity']});
                var ids = $.map(value, getID);
                ids = Arr.filter(ids, function(id){return id !== ""});
                if (ids.length === 0)
                    continue;
                if (ids.length === 1)
                    ids = ids[0];
                result[outputPredicate] = ids;
                empty = false;
            }
        }
        if (empty)
            return undefined;
        return result;
    }

    var triples = [];
    politeEach(entities, function(_,subject) {
        if (!subject || !hasValidID(subject) || subject.isCVT())
            return;


        var types = new Set();
        function addType(type) {
            types.add(type);
            var metadata = freebase.getTypeMetadata(type);
            if (metadata)
                types.addAll(metadata["/freebase/type_hints/included_types"]);
        }
        /* Assert each type and all included types exactly once */
        $.each($.makeArray(subject['/type/object/type']), function(_, type){addType(type)});
        /* Unless given specific OK to assert naked properties, assert
           any types implied by the subject's properties. */
        if (!assertNakedProperties) {
            $.each(subject['/rec_ui/headerPaths'], function(_, headerPath) {
                var prop = headerPath.parts[0].prop;
                var metadata = freebase.getPropMetadata(prop);
                if (metadata && metadata.schema && metadata.schema.id)
                    addType(metadata.schema.id);
            });
        }
        types.remove("/type/object");
        $.each(types.getAll(), function(_,type) {
            if (type)
                triples.push({s:getID(subject), p:"/type/object/type",o:type});
        });

        /* If the subject is new to Freebase, give it a name as well */
        if (Arr.contains(["None", "None (merged)"], subject.getID())){
            $.each($.makeArray(subject["/type/object/name"]), function(_, name) {
                if (name)
                    triples.push({s:getID(subject),p:"/type/object/name",o:name});
            });
        }

        /* Assert each of the top level mql properties */
        var mqlProps = Arr.unique(Arr.filter($.map(subject['/rec_ui/headers'], function(val){return val.split(":")[0]}), isMqlProp));
        $.each(mqlProps, function(_, predicate) {

            $.each($.makeArray(subject[predicate]), function(_, object) {
                if (object === undefined || object === null)
                    return;

                if (isValueProperty(predicate)) {
                    triples.push({s:getID(subject), p:predicate, o:getValue(predicate, object)});
                    return;
                }

                if (getType(object) !== "object") {
                    console.error("expected the target of the property " + predicate + " to be an object, but it was a " + getType(object));
                    return;
                }

                if (object.isCVT()){
                    if (!(object['/rec_ui/parent']['/rec_ui/id'] === subject['/rec_ui/id']))
                        return; //only create the cvt once, from the 'root' of the parent
                    var cvtTripleObject = cvtObject(object);
                    if (cvtTripleObject)
                        triples.push({s:getID(subject),p:predicate,o:cvtTripleObject});
                }


                if  (!hasValidID(object))
                    return;


                triples.push({s:getID(subject),p:predicate,o:getID(object)});
            })
        });
    }, function() {callback(triples)}, tripleGetterYielder);
}

var standardFreeq = "http://data.labs.freebase.com/freeq/spreadsheet/";
function checkLogin() {
  SuperFreeq.isAuthorized(function() {
    $(".uploadLogin").show();
    $(".uploadForm").hide();
  }, function() {
    $(".uploadLogin").hide();
    $(".uploadForm").show();
  });
}

function fillinIds(createdEntities) {
    for (var key in createdEntities) {
        var id = standardizeId(createdEntities[key]);

        var entity_match = key.match(/entity(\d+)/);
        if (entity_match) {
            entities[entity_match[1]].setID(id);
            continue;
        }
        var recGroup_match = key.match(/recGroup(\d+)/);
        if (recGroup_match) {
            RecGroup.groups[recGroup_match[1]].setID(id);
            continue;
        }
    }
}

class FreeqMonitor {
  repeatingTimer;
  constructor(public job:SuperFreeq.Job, public onComplete) {
    this.repeatingTimer = new RepeatingTimer(30 * 1000,
                                             ()=>this.checkProgress());
    this.checkProgress();
  }

  checkProgress() {
    this.job.get((result:SuperFreeq.JobStatus) => {
      this.repeatingTimer.reset();
      if (!result.stats) {
        addTimeout(() => this.checkProgress(), 5000);
        return;
      }
      var totalActions = 0;
      var actionsRemaining = result.stats.num_ready;
      for (var key in result.stats) {
        totalActions += result.stats[key];
      }
      $('#upload_progressbar').progressbar('option', 'value', (totalActions-actionsRemaining)*100/totalActions);

      if (actionsRemaining === 0) {
        this.repeatingTimer.stop();
        if (this.onComplete) {
            //ensures that onComplete is called at most once
            var onComplete = this.onComplete;
            this.onComplete = undefined;
            onComplete(this.job);
        }
      }
      else {
        addTimeout(() => this.checkProgress(), 5000);
      }
    });
  }
}


function setupOutput() {
    if (inputType === "JSON")
        $("input.outputFormat[value='json']").attr("checked","checked").change()
}

function doLoad() {
  var name = $("#mdo_name").val()
  var info_source = $("#mdo_data_source_id").val();
  var graph = $(".graphport:checked").val();


  $(".uploadToFreeQ").hide();
  $(".uploadForm .error").hide();
  $(".uploadSpinner").show();
  SuperFreeq.createJob(name, graph, info_source, function(job:SuperFreeq.Job) {
    prepareTriples(function(triples) {
      job.load(triples, function() {
        job.start(() => {
          console.log("job started!")
          $(".freeqLoad").show();
          $(".freeqLoadInProgress").show();
          $(".uploadSpinner").hide();
          $("#upload_progressbar").progressbar({value:0});
          $(".peacock_link").attr("href",job.base_url);
          new FreeqMonitor(job, function() {
            $(".freeqLoadInProgress").hide();

            if ($("input.graphport:checked").val() === "otg") {
              job.getIdMapping((v) => {
                fillinIds(v);
                $(".fetchingFreeqIds").hide();
                $(".idsFetched").show();
                displayOutput();
              });
              $(".uploadToOTGComplete").show();
            }
            else {
              $(".uploadToSandboxComplete").show();
            }
          });
        });
      });
    });
  });
}

$(document).ready(function () {
    $(".displayTriples").click(function(){$(".triplesDisplay").slideToggle(); return false;});
    $(".uploadLogin .loginButton").click(function() {SuperFreeq.authorize(checkLogin)});
    $(".loadAgainButton").click(function() {
        $(".freeqLoad").hide();
        $(".uploadToSandboxComplete").hide();
        $(".uploadToFreeQ").show();
    });

    $("input.outputFormat").change(function() {
        displayOutput();
        $(".outputFormatText").html(this.value);
    });

    $("#assert_naked_properties").change(function() { prepareTriples(); });
    $("#mdo_data_source").suggest({type:"/dataworld/information_source",
                               flyout:true,type_strict:"should", key:api_key})
                         .bind("fb-select", function(e, data) {
                               $("#mdo_data_source_id").val(data.id);
                               updateMdoInfo();
                         });
    $("#mdo_name").val(defaultMDOName);
    $("#mdo_name").change(updateMdoInfo);
    $("input.graphport").change(function(){
        var warning = $("#otg_upload_warning");
        if (this.value === "otg")
            warning.show();
        else
            warning.hide();
    });
    $("#upload_button").click(doLoad);
});
