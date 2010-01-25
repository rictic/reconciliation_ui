TestCase("Test Filling in IDs from TripleLoader",{
    "test filling in the id of one entity": function() {
        resetGlobals();
        var entity = new tEntity({"/type/object/name":"Douglas Hofstadter"});
        var target_id = "/en/douglas_hofstadter";
        var key = "$entity" + entity['/rec_ui/id'];
        var createdEntities = {};
        createdEntities[key] = target_id;
        fillinIds(createdEntities);
        assertEq(entity.getID(), target_id);
    }
    ,"test filling in the id of a RecGroup": function() {
        justParseIt(jamesCameronRepeatedlySpreadsheet);
        var jamesCamerons = Arr.filter(entities, function(entity) {
            return entity['/type/object/name'][0] === "James Cameron"
        });
        internalReconciler.setMerged(jamesCamerons[0], true);
        var recGroup = internalReconciler.getRecGroup(jamesCamerons[0]);
        var createdEntities = {};
        createdEntities["$recGroup" + recGroup.internal_id] = "/en/james_cameron";
        fillinIds(createdEntities);
        $.each(jamesCamerons, function(_, jamesCameron) {
            assertEq(jamesCameron.getID(), "/en/james_cameron");
        });
    }
});

