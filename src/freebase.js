var freebase = {mqlValue:null, mqlTree:null}; //some types
/** @typedef {Object.<string, freebase.mqlValue>} */
freebase.mqlTree;
    
/** @typedef {(null, number, string, freebase.mqlTree, Array.<freebase.mqlValue>)} */
freebase.mqlValue;

(function() {
    var miniTopicFloaterEl = $("#miniTopicFloater");
    /** @param {!string} name
      * @param {!string} id
      */
    freebase.link = function(name, id) {
        var linkVal = node("a", name, {target:'_blank',href:freebase_url + '/view' + id})
        return miniTopicFloater(linkVal, id);
        
        function miniTopicFloater(element, id) {
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
    
    
    /** Simple mql read
      * 
      * @param {freebase.mqlTree} envelope
      * @param {function(freebase.mqlTree)} handler
      */
    freebase.mqlRead = function mqlRead(envelope, handler) {
        $.getJSON(getMqlReadURL(envelope), null, handler);
    };
    
    /** Used below, thus the odd style above 
      *
      * @param {freebase.mqlTree} envelope
      * @returns {!string} 
      */
    function getMqlReadURL(envelope) {
        var param = {query:JSON.stringify(envelope)};
        if (!('query' in envelope))
            param = {queries:param.query};
        return freebase_url + "/api/service/mqlread?callback=?&" + $.param(param);
    }
    
    /** Maps a freebase ID into a valid MQL query id 
      * @param {string} id
      * @return {string}
      */
    function idToQueryName(id) {
        return id.replace(/\//g,'ZZZZ');
    }
    
    var maxURLLength = 2048;
    
    /** freebase.mqlReads takes a list of pairs of [fb_key, query] and wraps them in a minimal
        number of HTTP GET requests needed to perform them.  For each query result
        it calls handler(fb_key, result) if the query is successful, and onError(fb_key, response)
        if the mql query fails.  After all of the queries have been handled, it calls onComplete()
        
        @param {!Array.<!Array.<!string>>} q_pairs
        @param {!function(!string, !freebase.mqlTree)} handler
        @param {!function()} onComplete
        @param {function(!string, !freebase.mqlTree)=} errorHandler
    */
    freebase.mqlReads = function(q_pairs, handler, onComplete, errorHandler) {
        if (q_pairs.length === 0){
            onComplete();
            return;
        }
        var keys = $.map(q_pairs, function(q_pair){return q_pair[0]});
        var encoded_queries = $.each(q_pairs, function(_,q_pair){q_pair[0] = idToQueryName(q_pair[0]);});
        multiQuery(encoded_queries);
        
        /* multiQuery takes a list of pairs of [name, query] and breaks them up so that it
           each mql query fits in an HTTP GET request, calling handler on each container
           query result
        */
        function multiQuery(queries) {
            var query = {};
            $.each(queries, function(_,qparts) {
                query[qparts[0]] = qparts[1];
            });
            if (queries.length > 1 && getMqlReadURL(query).length > maxURLLength) {
                var splitPoint = queries.length / 2;
                multiQuery(queries.slice(0, splitPoint));
                multiQuery(queries.slice(splitPoint));
            }
            else
                freebase.mqlRead(query, dispatcher);
        }
        
        /* Takes the result of multiple mql queries all wrapped up together
           and dispatches them to handler if they succeeded, errorHandler
           if they failed, and calls onComplete if all of the keys have
           been handled. */
        function dispatcher(responseGroup) {
            //FIXME: need to run unique over the query key set
            assert(keys.length > 0, "freebase.mqlReads.dispatcher: keys.length should be >0, found: " + keys.length);
            var i = 0;
            while(i < keys.length) {
                var key = keys[i];
                var response = responseGroup[idToQueryName(key)];
                if (!response) {
                    i++;
                    continue;
                }
                
                //We've handled the ith key, remove it from the list of keys
                keys = Arr.removeAt(keys, i);
                if (freebase.isBadOrEmptyResult(response)) {
                    if (errorHandler)
                        errorHandler(key, response);
                    else
                        error(response);
                }
                else
                    handler(key, response.result);
            }
            if (keys.length === 0)
                onComplete();
        }
    }
    
    
    var nameCache = {};
    /** Given an id and a callback, immediately calls the callback with the freebase name
        if it has been looked up before.
      
        If it hasn't, then the callback is called once with the id immediately, and once again
        with the name after it has been looked up.
    
        @param {!string} id
        @param {!function(string)} callback
    */
    freebase.getName = function(id, callback) {
        if (id in nameCache){
            callback(nameCache[id]);
            return;
        }
        callback(id);
        freebase.mqlRead({query:{id:id,name:null}}, function(results) {
            nameCache[id] = (results && results.result && results.result.name) || id;
            callback(nameCache[id]);
        });
    }
    
    /** @param {!string} id */
    freebase.makeLink = function(id) {
        var simpleEl = node("span",id);
        var link = freebase.link(simpleEl, id);
        freebase.getName(id, function(name) {
            simpleEl.html(name);
        });
        return link;
    }
    
    /** @param {string=} type
      * @return {freebase.mqlTree}
      */
    function getTypeQuery(type) {
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
    /** @param {!Array.<!string>} types
      * @param {!function(!string, !freebase.mqlTree)} onComplete
      * @param {function(!string, !freebase.mqlTree)=} onError
      */
    freebase.fetchTypeInfo = function(types, onComplete, onError) {
        var q_pairs = [];
        $.each(types, function(_,type) {
            if (freebase.getTypeMetadata(type))
                return;
            q_pairs.push([type, {query:getTypeQuery(type)}]);
        })
        
        var errorTypes = [];
        freebase.mqlReads(q_pairs, handler, onCompleteHandler, onErrorHandler);
        
        
        
        function handler(type, result) {
            typeMetadata[type] = result;
        }
        
        function onErrorHandler(type, response) {
            errorTypes.push(type);
        }
        
        function onCompleteHandler() {
            if (errorTypes.length > 0 && onError){
                onError(errorTypes);
                return;
            }
            onComplete();
        }
    }
    freebase.getTypeMetadata = function(type) {return typeMetadata[type];}
    
    /** @type {Object.<string, (freebase.mqlTree|undefined)>} */
    var propMetadata = {};
    /** @param {!Array.<!string>} properties
      * @param {!function(string, freebase.mqlTree)} onComplete
      * @param {function(string, freebase.mqlTree)=} onError
      */
    freebase.fetchPropertyInfo = function(properties, onComplete, onError) {
        var simpleProps = [];
        var errorProps = [];
        
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

        var q_pairs = [];
        $.each(simpleProps, function(_,simpleProp) {
            q_pairs.push([simpleProp, {query: getQuery(simpleProp)}]);
        });
        
        freebase.mqlReads(q_pairs, handler, onCompleteHandler, onErrorHandler);
        
        function getQuery(prop) {
            var query =  {
                "reverse_property" : null,
                "master_property"  : null,
                "type" : "/type/property",
                "name":null,
                "id" : prop
            }
            query.expected_type = getTypeQuery();
            return query;
        }

        function handler(mqlProp, result){
            if (result.expected_type.id)
                typeMetadata[result.expected_type.id] = result.expected_type
            result.inverse_property = result.reverse_property || result.master_property;
            if (result.inverse_property)
                propertiesSeen.add(result.inverse_property);
            propMetadata[mqlProp] = result;
        }
        
        function onErrorHandler(mqlProp, response) { 
            propMetadata[mqlProp] = undefined;
            errorProps.push(mqlProp);
        }
        
        function onCompleteHandler() {
            if (onError && errorProps.length > 0)
                onError(errorProps);
            else
                onComplete();
            if (q_pairs.length > 0)
                freebase.fetchPropertyInfo(propertiesSeen.getAll(), function(){}, function(){});
        }
        
    }
    freebase.getPropMetadata = function(prop) {
        var meta = propMetadata[prop];
        if (meta instanceof Function)
            return undefined;
            
        return meta;
    }

    /** @param {freebase.mqlTree} mqlResult
        @result {boolean} */
    freebase.isBadOrEmptyResult = function(mqlResult) {
        return mqlResult.code != "/api/status/ok" || mqlResult.result === null;
    }

    /** @param {string=} info */
    freebase.beacon = function(info) {
        var url = "http://www.freebase.com/private/beacon?c=spreadsheetloader" + (info || "");
        $("<img src='" + url + "'>").appendTo("body");
    }
    
    /** @param {string} s
        @return {boolean}
     */
    freebase.isMqlDatetime = function(s) {
        return !isNaN(mjt.freebase.date_from_iso(s));
    }
    
    return freebase;
}());})();
