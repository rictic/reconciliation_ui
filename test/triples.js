TestCase("triples",{
    "test a simple entity with a value property": function() {
        resetGlobals();
        var entity = new tEntity({id:"/a"});
        entity.addProperty("b", "c");
        
        expectAsserts(1);
        getTriples([entity], false, function(triples) {
            assertEq([{s:"/a", p:"b", o:"c"}], triples);
        });
    }
   ,"test a simple cvt": function() {
        resetGlobals();
        var entity = new tEntity({id:"/a"});
        var cvt    = new tEntity({"/rec_ui/parent":entity});
        entity.addProperty("topic",cvt);
        
        /* CVT properties have to begin with the CVT's type, 
        otherwise I wouldn't bother with types here */
        cvt["/type/object/type"] = "/cvt";
        cvt.addProperty("/cvt/b","c");
        
        expectAsserts(1);
        getTriples([entity, cvt], false, function(triples) {
            assertEq([{s:"/a", p:"topic", o:{b:"c"}}], triples);
        });
    }
   ,"test multiple entities pointing into a cvt": function() {
        resetGlobals();
        var entity = new tEntity({id:"/entity", "/rec_ui/toplevel_entity":true});
        var cvt    = new tEntity();
        var leaf   = new tEntity({id:"/leaf"});
        entity.addProperty("/topic/cvt_topic", cvt);
        cvt.addProperty("/type/object/type", "/cvt/topic")
        cvt.addProperty("/cvt/topic/leaf_topic", leaf);
        cvt.addParent(entity);
        leaf.addParent(cvt);
        
        expectAsserts(1);
        getTriples([entity, cvt, leaf], false, function(triples) {
            assertEq([{s:"/entity",
                       p:"/topic/cvt_topic",
                       o:{leaf_topic:"/leaf"}}], triples);
        });
    }
    ,"test a simple entity with a topic property": function() {
        resetGlobals();
        
        var parent = new tEntity({id:"/parent", "/rec_ui/toplevel_entity":true});
        var child = new tEntity({id:"/child"});
        child.addParent(parent);
        parent.addProperty("/topic", child);
        
        //no triples should be produced, because the id of the child is blank
        expectAsserts(1);
        getTriples([parent, child], false, function(triples) {
            assertEq([{s:"/parent",
                       p:"/topic",
                       o:"/child"
                    }], triples);
        });
    }
    ,"test a simple triple with a blank id": function() {
        resetGlobals();
        
        var parent = new tEntity({id:"/parent", "/rec_ui/toplevel_entity":true});
        var child = new tEntity({id:""});
        child.addParent(parent);
        parent.addProperty("/topic", child);

        //no triples should be produced, because the id of the child is blank
        expectAsserts(1);
        getTriples([parent, child], false, function(triples) {
            assertEq([], triples);
        });
    }
    ,"test an entity that points to multiple topics with the same property": function() {
        resetGlobals();
        
        var parent = new tEntity({id:"/parent", "/rec_ui/toplevel_entity":true});
        var firstChild = new tEntity({id:"/child1"});
        firstChild.addParent(parent);
        var secondChild = new tEntity({id:"/child2"});
        secondChild.addParent(parent);
        parent.addProperty("/topic", [firstChild,secondChild]);
        
        expectAsserts(1);
        getTriples([parent, firstChild, secondChild], false, function(triples) {
            assertEq([{s:"/parent",
                       p:"/topic",
                       o:"/child1"
                      },
                      {s:"/parent",
                       p:"/topic",
                       o:"/child2"}], triples);
        });
    }
    ,"test an entity that points to multiple topics with the same property and one of the child topics has a blank id": function() {
        resetGlobals();
        
        var parent = new tEntity({id:"/parent", "/rec_ui/toplevel_entity":true});
        var firstChild = new tEntity({id:""});
        firstChild.addParent(parent);
        var secondChild = new tEntity({id:"/child2"});
        secondChild.addParent(parent);
        parent.addProperty("/topic", [firstChild,secondChild]);
        
        expectAsserts(1);
        getTriples([parent, firstChild, secondChild], false, function(triples) {
            assertEq([{s:"/parent",
                       p:"/topic",
                       o:"/child2"}], triples);
        });
    }
    ,"test an entity that points to multiple topics through a single cvt property": function() {
        resetGlobals();
        
        var entity = new tEntity({id:"/entity", "/rec_ui/toplevel_entity":true});
        var cvt    = new tEntity();
        var firstLeaf   = new tEntity({id:"/leaf1"});
        var secondLeaf   = new tEntity({id:"/leaf2"});
        entity.addProperty("/topic/cvt_topic", cvt);
        cvt.addProperty("/type/object/type", "/cvt/topic")
        cvt.addProperty("/cvt/topic/leaf_topic", [firstLeaf,secondLeaf]);
        cvt.addParent(entity);
        firstLeaf.addParent(cvt);
        secondLeaf.addParent(cvt);
        
        expectAsserts(1);
        getTriples([entity, cvt, firstLeaf, secondLeaf], false, function(triples) {
            assertEq([{s:"/entity",
                       p:"/topic/cvt_topic",
                       o:{leaf_topic:["/leaf1","/leaf2"]}}], triples);
        });
    }
    ,"test an entity that points to multiple topics through a single cvt property and one of the leaves has a blank id": function() {
        resetGlobals();
        
        var entity = new tEntity({id:"/entity", "/rec_ui/toplevel_entity":true});
        var cvt    = new tEntity();
        var firstLeaf   = new tEntity({id:""});
        var secondLeaf   = new tEntity({id:"/leaf2"});
        entity.addProperty("/topic/cvt_topic", cvt);
        cvt.addProperty("/type/object/type", "/cvt/topic")
        cvt.addProperty("/cvt/topic/leaf_topic", [firstLeaf,secondLeaf]);
        cvt.addParent(entity);
        firstLeaf.addParent(cvt);
        secondLeaf.addParent(cvt);
        
        expectAsserts(1);
        getTriples([entity, cvt, firstLeaf, secondLeaf], false, function(triples) {
            assertEq([{s:"/entity",
                       p:"/topic/cvt_topic",
                       o:{leaf_topic:"/leaf2"}}], triples);
        });
    }
});

