var freebase = (function() {
    var freebase = {};
    var miniTopicFloaterEl = $("#miniTopicFloater");
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
    freebase.link = function(name, id) {
        var linkVal = node("a", name, {target:'_blank',href:freebase_url + '/view' + id})
        return miniTopicFloater(linkVal, id);
    };
    freebase.mqlRead = function(envelope, handler) {
        var param = {query:JSON.stringify(envelope)};
        if (!('query' in envelope))
            param = {queries:param.query};
        $.getJSON(freebase_url + "/api/service/mqlread?callback=?&", param, handler);
    };
    
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
        })
        return link;
    }
    
    function idToQueryName(id) {
        return id.replace(/\//g,'Z');
    }
    
    var typeMetadata = {};
    freebase.fetchTypeInfo = function(types, onComplete, onError) {
        function getQuery(type) {
            return {
                id:type,
                type:'/type/type',
                "/freebase/type_hints/included_types":[]
            }
        }
        var envelope = {};
        $.each(types, function(_,type) {
            envelope[idToQueryName(type)] = {query:getQuery(type)};
        })
        function handler(results) {
            var errorTypes = [];
            $.each(types, function(_,type) {
                var result = results[idToQueryName(type)];
                if (freebase.isBadOrEmptyResult(result)){
                    errorTypes.push(result);
                    return;
                }
                typeMetadata[type] = result.result;
            });
            if (errorTypes.length > 0 && onError){
                onError(errorTypes);
                return;
            }
            onComplete();
        }
        freebase.mqlRead(envelope, handler);
    }
    freebase.getTypeMetadata = function(type) {return typeMetadata[type];}
    
    var propMetadata = {};
    freebase.fetchPropertyInfo = function(properties, onComplete, onError) {
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
        var envelope = {};
        $.each(properties, function(i, mqlProp) {
            $.each(mqlProp.split(":"), function(i, simpleProp) {
                if (simpleProp == "id") return;
                envelope[idToQueryName(simpleProp)] = {"query": getQuery(simpleProp)};
            })
        })
        function handler(results) {
            var errorProps = handlePropertyInfo(results, properties);
            if (errorProps.length > 0)
                return onError(errorProps);
            onComplete();
        }
        freebase.mqlRead(envelope, handler);
    }
    function handlePropertyInfo(results, properties) {
        assert(results.code == "/api/status/ok", results);
        var errorProps = [];
        $.each(properties, function(_,complexProp){
            $.each(complexProp.split(":"), function(_, mqlProp) {
                if (mqlProp == "id") return;
                var result = results[idToQueryName(mqlProp)];
                if (freebase.isBadOrEmptyResult(result)){
                    errorProps.push(mqlProp)
                    return
                }
                result = result.result;
                if (result.expected_type.id) typesSeen.add(result.expected_type.id)
                result.inverse_property = result.reverse_property || result.master_property;
                propMetadata[mqlProp] = result;
            });
        });
        return errorProps;
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

