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
            assertEq("/en/james_cameron", jamesCameron.getIdentifier());
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
    ,"test taking an internally reconciled spreadsheet and reparsing it": function() {
        justParseIt(jamesCameronRepeatedlySpreadsheet);
        var jamesCamerons = Arr.filter(entities, function(entity) {
            return entity['/type/object/name'][0] === "James Cameron"
        });
        addIdColumns();
        internalReconciler.setMerged(jamesCamerons[0], true);
        jamesCamerons[0].reconcileWith("None");
        
        renderSpreadsheet(function(outputSheet) {            
            justParseIt(outputSheet);
            var jamesCamerons = Arr.filter(entities, function(entity) {
                return entity['/type/object/name'][0] === "James Cameron"
            });
            var recGroup = internalReconciler.getRecGroup(jamesCamerons[0]);
            assertEq(2, recGroup.members.length);
            assertEq("None", recGroup.reconciledTo);
            assertTrue(recGroup.shouldMerge);
        });
    }
});