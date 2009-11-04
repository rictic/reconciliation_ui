var freebase = (function() {
    var freebase = {};
    var miniTopicFloaterEl = $("#miniTopicFloater");
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
    
    // Simple mql read
    freebase.mqlRead = function mqlRead(envelope, handler) {
        $.getJSON(getMqlReadURL(envelope), null, handler);
    };
    
    /* Used below, thus the odd style above */
    function getMqlReadURL(envelope) {
        var param = {query:JSON.stringify(envelope)};
        if (!('query' in envelope))
            param = {queries:param.query};
        return freebase_url + "/api/service/mqlread?callback=?&" + $.param(param);
    }
    
    /* Maps a freebase ID into a valid MQL query id */
    function idToQueryName(id) {
        return id.replace(/\//g,'ZZZZ');
    }
    
    /* freebase.mqlReads takes a list of pairs of [fb_key, query] and wraps them in a minimal
       number of HTTP GET requests needed to perform them.  For each query result
       it calls handler(fb_key, result) if the query is successful, and onError(fb_key, response)
       if the mql query fails.  After all of the queries have been handled, it calls onComplete()
    */
    var maxURLLength = 2048;
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
                        error(value);
                }
                else
                    handler(key, response.result);
            }
            if (keys.length === 0)
                onComplete();
        }
    }
    
    
    
    /* Given an id and a callback, immediately calls the callback with the freebase name
      if it has been looked up before.
      
      If it hasn't, then the callback is called once with the id immediately, and once again
      with the name after it has been looked up.*/
    var nameCache = {};
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
    freebase.makeLink = function(id) {
        var simpleEl = node("span",id);
        var link = freebase.link(simpleEl, id);
        freebase.getName(id, function(name) {
            simpleEl.html(name);
        });
        return link;
    }
    
    var typeMetadata = {};
    freebase.fetchTypeInfo = function(types, onComplete, onError) {
        var q_pairs = [];
        $.each(types, function(_,type) {
            if (freebase.getTypeMetadata(type))
                return;
            q_pairs.push([type, {query:getQuery(type)}]);
        })
        
        var errorTypes = [];
        freebase.mqlReads(q_pairs, handler, onCompleteHandler, onErrorHandler);
        
        function getQuery(type) {
            return {
                id:type,
                type:'/type/type',
                "/freebase/type_hints/included_types":[]
            }
        }
        
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
    
    var propMetadata = {};
    freebase.fetchPropertyInfo = function(properties, onComplete, onError) {
        var simpleProps = [];
        $.each(properties, function(_, mqlProp) {
            $.each(mqlProp.split(":"), function(i, simpleProp) {
                if (simpleProp == "id" || freebase.getPropMetadata(simpleProp))
                    return;
                simpleProps.push(simpleProp);
            });
        });
        simpleProps = Arr.unique(simpleProps);

        var q_pairs = [];
        $.each(simpleProps, function(_,simpleProp) {
            q_pairs.push([simpleProp, {query: getQuery(simpleProp)}]);
        });
        
        var errorProps = [];
        freebase.mqlReads(q_pairs, handler, onCompleteHandler, onErrorHandler);
        
        function getQuery(prop) {
            return {
                "expected_type" : {
                    "extends" : [],
                    "id" : null,
                    "/freebase/type_hints/mediator" : {"optional":true, "value":null}
                },
                "reverse_property" : null,
                "master_property"  : null,
                "type" : "/type/property",
                "name":null,
                "id" : prop
            }
        }

        function handler(mqlProp, result){
            if (result.expected_type.id) 
                typesSeen.add(result.expected_type.id)
            result.inverse_property = result.reverse_property || result.master_property;
            propMetadata[mqlProp] = result;
        }
        
        function onErrorHandler(key, response) { 
            errorProps.push(key); 
        }
        
        function onCompleteHandler() {
            if (errorProps.length > 0)
                onError(errorProps);
            else
                onComplete();
        }
        
    }
    freebase.getPropMetadata = function(prop) {return propMetadata[prop];}

    freebase.isBadOrEmptyResult = function(mqlResult) {
        return mqlResult.code != "/api/status/ok" || mqlResult.result === null;
    }
    
    freebase.beacon = function(info) {
        var url = "http://www.freebase.com/private/beacon?c=spreadsheetloader" + (info || "");
        $("<img src='" + url + "'>").appendTo($("body"));
    }
    
    return freebase;
}());