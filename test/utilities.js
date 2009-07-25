TestCase("UtilityTest",{
    testBasicPropertyGrouping: function() {
        var properties = ["a","b","c"];
        var groupedProps = groupProperties(properties);
        assertEq(properties,groupedProps.getProperties());
        assertEq(properties,groupedProps.getComplexProperties());
    },
    testComplexPropertyGrouping: function() {
        var properties = ["a","b:c:h","b:c:d","e","b:f"];
        var groupedProps = groupProperties(properties);
        assertEq(["a","b","e"], groupedProps.getProperties());
        assertEq(["c","f"], groupedProps.get("b").getProperties());
        assertEq(["h","d"], groupedProps.get("b").get("c").getProperties());
        assertEq(['a','b','b:c','b:c:h','b:c:d','b:f','e'], groupedProps.getComplexProperties());
        assertEq(['a','b:c:h','b:c:d','b:f','e'], groupedProps.getPropsForRows());
    }
});

