TestCase("UtilityTest",{
    testBasicPropertyGrouping: function() {
        var properties = ["a","b","c"];
        var groupedProps = groupProperties(properties);
        assertEq(properties,groupedProps.getProperties());
        assertEq(properties,groupedProps.getComplexProperties());
    }
    ,testComplexPropertyGrouping: function() {
        var properties = ["a","b:c:h","b:c:d","e","b:f"];
        var groupedProps = groupProperties(properties);
        assertEq(["a","b","e"], groupedProps.getProperties());
        assertEq(["c","f"], groupedProps.get("b").getProperties());
        assertEq(["h","d"], groupedProps.get("b").get("c").getProperties());
        assertEq(['a','b','b:c','b:c:h','b:c:d','b:f','e'], groupedProps.getComplexProperties());
        assertEq(['a','b:c:h','b:c:d','b:f','e'], groupedProps.getPropsForRows());
    }
    ,testIsMQLDatetime: function() {
        var validDateTimes = ["2001","2001-01","2001-01-01","2001-01-01T01Z",
                              "2000-12-31T23:59Z","2000-12-31T23:59:59Z",
                              "2000-12-31T23:59:59.9Z"];
                              
        //todo: look into accepting times:
        var shouldParseButDoesnt = ["00:00:00Z","12:15","17-05:00"];
        
        var invalidDateTimes = ["Jun 27 2009"];
        $.each(validDateTimes, function(_, datetime) {
            assertTrue(freebase.isMqlDatetime(datetime));
        });
        
        $.each(invalidDateTimes, function(_, datetime) {
            assertFalse(freebase.isMqlDatetime(datetime));
        });
    }
});

