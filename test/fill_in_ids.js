TestCase("Test Filling in IDs from TripleLoader",{
    testFillingInOneSimpleId: function() {
        resetGlobals();
        var entity = new tEntity({"/type/object/name":"Douglas Hofstadter"});
        var target_id = "/en/douglas_hofstadter";
        var key = "$entity" + entity['/rec_ui/id'];
        var createdEntities = {};
        createdEntities[key] = target_id;
        fillinIds(createdEntities);
        assertEq(entity.id, target_id);
    }
    //TODO: add a case for a recgroup
});

