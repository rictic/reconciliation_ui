var jamesCameronRepeatedlySpreadsheet = "/type/object/name\t/type/object/type\t/film/film/directed_by\n" +
        "Titanic\t/film/film\tJames Cameron\n" +
        "Avatar\t/film/film\tJames Cameron";


TestCase("internal reconciliation",{
    "test two directors with the same name": function() {
        justParseIt(jamesCameronRepeatedlySpreadsheet);
        
        var jamesCamerons = Arr.filter(entities, function(entity) {
            return entity['/type/object/name'][0] === "James Cameron"
        });

        assertSubsetOf(internalReconciler, {
            byType: {
                "/film/director": {
                    "James Cameron": {
                        members:[{"/type/object/name": ["James Cameron"]},
                                 {"/type/object/name": ["James Cameron"]}],
                        shouldMerge: false
                    }
                }
            }
        });
        
        internalReconciler.setMerged(jamesCamerons[0], true);
        jamesCamerons[0].reconcileWith("/en/james_cameron");
        
        $.each(jamesCamerons, function(_, jamesCameron) {
            assertEq(jamesCameron.getIdentifier(), "/en/james_cameron");
        });
        
        jamesCamerons[0].reconcileWith("None");
        assertTrue(jamesCamerons[0].getIdentifier().match(/\$recGroup\d+/) !== null);
        assertEq(jamesCamerons[0].getIdentifier(), jamesCamerons[1].getIdentifier());
    }
    ,"test two toplevel entities with the same type and name": function() {
        justParseIt("/type/object/name\t/type/object/type\nJames Cameron\t/film/director\nJames Cameron\t/film/director");
        
        var jamesCamerons = Arr.filter(entities, function(entity) {
            return entity['/type/object/name'][0] === "James Cameron"
        });
        
        assertSubsetOf(internalReconciler, {
            byType: {
                "/film/director": {
                    "James Cameron": {
                        members:[{"/type/object/name": ["James Cameron"]},
                                 {"/type/object/name": ["James Cameron"]}],
                        shouldMerge: false
                    }
                }
            }
        });
    }
});