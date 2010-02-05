TestCase("EntityTest",{
    testSimpleChainedPropertyAccess: function() {
        var e = new tEntity({"a":1});
        assertEq("", e.getChainedProperty('a'), [1]);
        e.a = [1,2]
        assertEq("", e.getChainedProperty('a'), [1,2]);
        e.a = {};
        e.a.b = 3;
        assertEq("", e.getChainedProperty('a:b'), [3]);
    },
    testComplexChainedPropertyAccess: function() {
        var e = new tEntity({});
        e.a = [{b:1},{b:2}];
        assertEq("", e.getChainedProperty('a:b'), [1,2]);
    },
    testUnreasonablyComplexChainedPropertyAccess: function() {
        var e = new tEntity({});
        e.a = [{b:[{c:1},{c:2}]},{b:{c:3}}];
        assertEq("", e.getChainedProperty('a:b:c'), [1,2,3]);
    }
});

