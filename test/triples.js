TestCase("triples",{
    testSimple: function() {
        var entity = new Entity({id:"/a"});
        entity.addProperty("b", "c");
        
        expectAsserts(1);
        getTriples([entity], function(triples) {
            assertEq([{s:"/a", p:"b", o:"c"}], triples);
        });
    },
    testSimpleCVT: function() {
        var entity = new Entity({id:"/a"});
        var cvt    = new Entity({"/rec_ui/is_cvt":true, "/rec_ui/parent":entity});
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
});

