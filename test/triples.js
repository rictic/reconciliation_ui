TestCase("triples",{
    "test a simple entity with a value property": function() {
        var entity = new tEntity({id:"/a"});
        entity.addProperty("b", "c");
        
        expectAsserts(1);
        getTriples([entity], function(triples) {
            assertEq([{s:"/a", p:"b", o:"c"}], triples);
        });
    }
   ,"test a simple cvt": function() {
        var entity = new tEntity({id:"/a"});
        var cvt    = new tEntity({"/rec_ui/is_cvt":true, "/rec_ui/parent":entity});
        entity.addProperty("topic",cvt);
        
        /* CVT properties have to begin with the CVT's type, 
        otherwise I wouldn't bother with types here */
        cvt["/type/object/type"] = "/cvt";
        cvt.addProperty("/cvt/b","c");
        
        expectAsserts(1);
        getTriples([entity, cvt], function(triples) {
            assertEq([{s:"/a", p:"topic", o:{b:"c"}}], triples);
        });
    }
   ,"test multiple entities pointing into a cvt": function() {
        var entity = new tEntity({id:"/entity", "/rec_ui/toplevel_entity":true});
        var cvt    = new tEntity();
        var leaf   = new tEntity({id:"/leaf"});
        entity.addProperty("/topic/cvt_topic", cvt);
        cvt.addProperty("/type/object/type", "/cvt/topic")
        cvt.addProperty("/cvt/topic/leaf_topic", leaf);
        cvt.addParent(entity);
        leaf.addParent(cvt);
        
        expectAsserts(1);
        getTriples([entity, cvt, leaf], function(triples) {
            $.each(triples, function(_, triple) {
              log("s:" + triple.s);
              log("p:" + triple.p);
              log("o:" + triple.o);
              log("\n");
            });
            assertEq([{s:"/entity",
                       p:"/topic/cvt_topic",
                       o:{leaf_topic:"/leaf"}}], triples);
        });
    }
});

