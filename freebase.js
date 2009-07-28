var freebase = (function() {
    var freebase = {};
    var miniTopicFloaterEl = $("#miniTopicFloater");
    function miniTopicFloater(element, id) {
        var mouseIsOver = false;
        element.bind("mouseover",function() {
            mouseIsOver = true;
            miniTopicFloaterEl.empty().freebaseMiniTopic(id, function(){
                if (mouseIsOver){
                    miniTopicFloaterEl.show()
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
        var linkVal = $("<a target='_blank' href='"+freebase_url+"/view"+id+"'>" + name + "</a>");
        return miniTopicFloater(linkVal, id);
    };
    freebase.mqlRead = function(envelope, handler) {
        var param = {query:JSON.stringify(envelope)};
        if (!('query' in envelope))
            param = {queries:param.query};
        $.getJSON(freebase_url + "/api/service/mqlread?callback=?&", param, handler);
    }
    return freebase;
}());

