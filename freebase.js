var freebase = (function() {
    var freebase = {};
    var miniTopicFloaterEl = $("#miniTopicFloater");
    function miniTopicFloater(element, id) {
        element.bind("hover",function() {
            miniTopicFloaterEl.empty().freebaseMiniTopic(id, function(){miniTopicFloaterEl.show()});
        })
        element.bind("hoverend", function() {
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
    return freebase;
}());

