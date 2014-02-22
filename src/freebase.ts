module freebase {
  var miniTopicFloaterEl = $("#miniTopicFloater");

  export function link(nameEl:JQuery, id:string):JQuery;
  export function link(name:string, id:string):JQuery;
  export function link(name:any, id:string):JQuery {
      var linkVal = node("a", name, {target:'_blank',href:freebase_url + '/view' + id})
      return miniTopicFloater(linkVal, id);

      function miniTopicFloater(element:JQuery, id:string) {
          var mouseIsOver = false;
          element.bind("mouseover",function() {
              mouseIsOver = true;
              miniTopicFloaterEl.empty().freebaseMiniTopic(id, function(){
                  if (mouseIsOver)
                      miniTopicFloaterEl.show();
              });
          })
          element.bind("mouseout", function() {
              mouseIsOver = false;
              miniTopicFloaterEl.hide();
          })
          element.mousemove(function(e){
              miniTopicFloaterEl.css({
                  top: (e.pageY + 15) + "px",
                  left: (e.pageX + 15) + "px"
              });
          });
          return element;
      }
  };

  export interface MqlReadEnvelope {
    query: MqlReadQuery;
  }

  export interface MqlReadQuery {

  }

  export interface QueryPair {
    0:string;
    1:MqlReadEnvelope
  }

  export interface MultiMqlRead {
    [uniqueKey:string]:MqlReadEnvelope;
  }

  /** Simple mql read
    */
  export function mqlRead(envelope:MqlReadEnvelope, handler?:(result:any)=>void):Q.Promise<any> {
      return Q($.getJSON(getMqlReadURL(envelope), null, handler));
  };

  /** Used below, thus the odd style above
    *
    * @param {freebase.mqlTree} envelope
    * @returns {!string}
    */
  function getMqlReadURL(envelope:MqlReadEnvelope):string {
    var param : any;
    if ('query' in envelope) {
      param = envelope;
      param.query = JSON.stringify(envelope.query);
    } else {
      console.log(envelope);
      throw new Error("can't use queries");
    }
    param['key'] = api_key;
    return fbapi_url + "mqlread?callback=?&" + $.param(param);
  }

  /** Maps a freebase ID into a valid MQL query id */
  function idToQueryName(id:string):string {
    return id.replace(/\//g,'ZZZZ');
  }

  var maxURLLength = 2048;

  /** freebase.mqlReads takes a list of pairs of [fb_key, query] and wraps
      them in a bunch of HTTP GET requests to perform them. This used to be
      efficient, but it isn't any longer.

      For each query result it calls handler(fb_key, result) if the query is
      successful, and onError(fb_key, response) if the mql query fails.  After
      all of the queries have been handled, it calls onComplete()

      @param {!Array.<!Array.<!string>>} q_pairs
      @param {!function(!string, !freebase.mqlTree)} handler
      @param {!function()} onComplete
      @param {function(!string, !freebase.mqlTree)=} errorHandler
  */
  export function mqlReads(q_pairs:QueryPair[],
                           handler:(key:string, result:Object)=>void) {
    var successes : {key: string; result: Object}[] = [];
    var failures : {key: string; error: Object}[] = [];
    var result = {successes: successes, failures: failures};
    var defer = Q.defer<typeof result>();
    var progress = new QuickProgress(defer, q_pairs.length);

    var promises : Q.Promise<any>[] = [];
    q_pairs.forEach((q_pair:QueryPair) => {
      var promise = freebase.mqlRead(q_pair[1]).then(function(res) {
        successes.push({key: q_pair[0], result: res});
        handler(q_pair[0], res['result']);
        progress.increment();
      }, function(err) {
        failures.push({key: q_pair[0], error: err});
        progress.increment();
      });
      promises.push(promise);
    });

    Q.all(promises).then((res) => defer.resolve(result), (err) => defer.reject(err));
    return defer.promise;
  }

  export function mqlReadQueries(queries:MultiMqlRead,
                                 onComplete:(res:Object)=>any) {
    var response = {
      code: '/api/status/ok',
      warnings: []
    };
    var combiner = combineCallbacks(numProperties(queries), function() {
      onComplete(response);
    });
    for (var key in queries) {
      (function(key:string){
        freebase.mqlRead(queries[key], function(result) {
          response[key] = result;
          combiner();
        });
      })(key);
    }
  }

  var nameCache : {[id:string]: Q.Promise<string>} = {
    "None": Q<string>(null), "None (merged)": Q<string>(null)
  };
  /** Given an id and a callback, immediately calls the callback with the
      freebase name if it has been looked up before.

      If it hasn't, then the callback is called once with the id immediately,
      and once again with the name after it has been looked up.

      @param {!string} id
      @param {!function(string)} callback
  */
  export function getName(id:string):Q.Promise<string> {
    if (!(id in nameCache)){
      nameCache[id] = freebase.mqlRead({query:{id:id,name:null}})
        .then((results:any) => {
          return results && results.result && results.result.name;
        });
    }

    return nameCache[id];
  }

  export function makeLink(id:string):JQuery {
      var simpleEl = node("span",id);
      var link : JQuery = freebase.link(simpleEl, id);
      freebase.getName(id).then((name) => simpleEl.html(name));
      return link;
  }

  /** @param {string=} type
    * @return {freebase.mqlTree}
    */
  function getTypeQuery(type?:string):any {
      return {
          id:type || null,
          type:'/type/type',
          "/freebase/type_hints/included_types":[],
          "/freebase/type_hints/mediator":{"optional": true, "value":null},
          "extends" : []
      }
  }

  /** @type {Object.<string, freebase.mqlTree>} */
  var typeMetadata = {};

  export function fetchTypeInfo(types:string[]):Q.Promise<{}> {
      var q_pairs : any[] = [];
      $.each(types, function(_,type) {
          if (freebase.getTypeMetadata(type))
              return;
          // a hack until typescript supports tuple types
          var val : any = [type, {query:getTypeQuery(type)}];
          q_pairs.push(val);
      })

      return freebase.mqlReads(q_pairs, handler).then((res) => {
        var errorTypes = Object.keys(res.failures);
        if (errorTypes.length > 0) {
          throw errorTypes;
        }
        return res.successes;
      });

      function handler(type:string, result:any) {
          typeMetadata[type] = result;
      }

  }
  export function getTypeMetadata(type:string) {return typeMetadata[type];}

  /** @type {Object.<string, (freebase.mqlTree|undefined)>} */
  export interface PropertyInfo {
    reverse_property: string;
    master_property: string;
    inverse_property: string; // synthetic, wraps up both reverse and master
    type: string; // always "/type/property"
    name: string;
    id: string; // same as the key in the propMetadata map
    expected_type: TypeInfo;
    schema: TypeInfo;
  }

  export interface TypeInfo {
    id: string;
    type: string;
    // '/freebase/type_hints/included_types':[];
    // '/freebase/type_hints/mediator': {"optional": boolean, "value":boolean};
    extends: string[];
  }

  var propMetadata : {[propId:string]: PropertyInfo} = {};
  export function fetchPropertyInfo(properties:string[],
                                    onComplete?:()=>void,
                                    onError?:(badProperties:string[])=>void) {
      var simpleProps : string[] = [];
      var errorProps : string[] = [];

      $.each(properties, function(_, mqlProp) {
          $.each(mqlProp.split(":"), function(i, simpleProp) {
              if (simpleProp in propMetadata && propMetadata[simpleProp] === undefined)
                  errorProps.push(simpleProp);
              if (simpleProp == "id" || simpleProp in propMetadata)
                  return;
              simpleProps.push(simpleProp);
          });
      });
      simpleProps = Arr.unique(simpleProps);

      var q_pairs : QueryPair[] = [];
      $.each(simpleProps, function(_,simpleProp) {
          var val = {0:simpleProp, 1:{query: getQuery(simpleProp)}};
          q_pairs.push(val);
      });

      var promise = freebase.mqlReads(q_pairs, handler).then((res) => {
        var errorProps = res.failures.map((failure) => failure.key);
        errorProps.forEach((failedProp) => {
          propMetadata[failedProp] = undefined;
        });

        if (errorProps.length > 0) {
          throw errorProps;
        }

        if (q_pairs.length > 0) {
          freebase.fetchPropertyInfo(propertiesSeen.getAll());
        }
      })
      promise.then(onComplete, onError);
      return promise;

      function getQuery(prop:string):any {
          var query =  {
              "reverse_property" : null,
              "master_property"  : null,
              "type" : "/type/property",
              "name":null,
              "id" : prop,
              "expected_type": getTypeQuery(),
              "schema": getTypeQuery()
          }
          return query;
      }

      function handler(mqlProp:string, result:any){
          if (result.expected_type.id)
              typeMetadata[result.expected_type.id] = result.expected_type;
          if (result.schema.id)
              typeMetadata[result.schema.id] = result.schema;
          result.inverse_property = result.reverse_property || result.master_property;
          if (result.inverse_property)
              propertiesSeen.add(result.inverse_property);
          propMetadata[mqlProp] = result;
      }
  }

  export function getPropMetadata(prop:string) {
      var meta = propMetadata[prop];
      if (meta instanceof Function)
          return undefined;

      return meta;
  }

  /** @param {freebase.mqlTree} mqlResult
      @return {boolean} */
  export function isBadOrEmptyResult(mqlResult:any):boolean {
      return mqlResult.result === null;
  }

  /** @param {string=} info */
  export function beacon(info?:string) {
      var url = "http://www.freebase.com/private/beacon?c=spreadsheetloader" + (info || "");
      $("<img src='" + url + "'>").appendTo("body");
  }

  export function getMid(id:string, callback:(mid:string)=>void) {
      callback(id);
      if (id.match(/\/m\//) || id === 'None' || id == 'None (matched)') {
        return;
      }
      var envelope = {query:{"myId:id":id, "mid":null}}
      freebase.mqlRead(envelope, function(results:any){
          if (results && results.result && results.result.mid)
              callback(results.result.mid);
      });
  }

  export interface BlurbOptions {
    format? :string;
    lang? : string;
    maxlength? : number;
    key?: string; // apikey
  }
  export function getBlurb(id:string, options:BlurbOptions, onSuccess:(result:any)=>void) {
    options.key = api_key;
    $.getJSON(fbapi_url + "text/" + id + "?callback=?", options, onSuccess);
  }

  export interface ImageOptions {
    fallbackid?:string;
    maxheight?:number;
    maxwidth?:number;
    mode?:string;
    pad?:string;
    key?:string; // apikey
  }
  export function imageUrl(id:string, options:ImageOptions) {
    options.key = api_key;
    return fbapi_url + "image/" + id + "?" + $.param(options);
  }

  /** @param {string} s
      @return {boolean}
   */
  export function isMqlDatetime(s:string):boolean {
    return isISO8601(s);
  }

}

function isValueProperty(propName:string):boolean {
    if (Arr.contains(["/type/object/type", "/type/object/name", "id"], propName))
        return true;
    if (freebase.getPropMetadata(propName))
        return isValueType(freebase.getPropMetadata(propName).expected_type);
    return undefined;
}

function isValueType(type:freebase.TypeInfo):boolean {
    return Arr.contains(type.extends, "/type/value");
}

function isCVTProperty(propName:string):boolean {
    var prop = freebase.getPropMetadata(propName);
    if (prop)
        return isCVTType(prop.expected_type);
    return undefined;
}

/** @param {!(string|Object)} type
  * @return {(boolean|undefined)}
  */
function isCVTType(type:freebase.TypeInfo):boolean;
function isCVTType(type:string):boolean;

function isCVTType(type:any):boolean {
    if (getType(type) === "string")
        type = freebase.getTypeMetadata(type);
    if (type === undefined) {
        console.error("type undefined in isCVTType");
        return;
    }

    return type["/freebase/type_hints/mediator"]
        && type["/freebase/type_hints/mediator"].value;
}
