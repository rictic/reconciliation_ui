function justParseIt(spreadsheet) {
    parseInput(spreadsheet, function(_,f) {f(true)}, function() {});
}

var warningTests = {
    testUnknownProp: function() {
        var unmockFetch = temporaryMock(freebase, 'fetchPropertyInfo', function(properties,onComplete,onError) {
            if (onError)
                onError(properties);
            else
                onComplete();
        });
        var unmockWarnUnknownProp = temporaryMock(window, 'warnUnknownProp', pass);
        
        try {
            expectAsserts(2);
            justParseIt("/a\t/b\n1\t2\n");
        }
        finally {
            unmockFetch();
            unmockWarnUnknownProp();
        }
    }
    ,testWarnTypeMissing: function() {
        var unmockWarnPropMissing = temporaryMock(window, 'warnPropertyMissing', pass);
        
        try {
            expectAsserts(1);
            justParseIt("/type/object/name\nSt. Francis");
        }
        finally {
            unmockWarnPropMissing();
        }
    }
    ,testWarnNameMissing: function() {
        var unmockWarnPropMissing = temporaryMock(window, 'warnPropertyMissing', pass);
        
        try {
            expectAsserts(1);
            justParseIt("/type/object/type\n/film/film");
        }
        finally {
            unmockWarnPropMissing();
        }
    }
    ,testWarnUnknownType: function() {
        var unmockWarnTypeMissing = temporaryMock(window, 'warnUnknownType', pass);
        var unmockFetch = temporaryMock(freebase, 'fetchTypeInfo', function(types, onComplete, onError) {
            if (onError)
                onError(types);
            else
                onComplete();
        });
        
        try {
            expectAsserts(1);
            justParseIt("/type/object/type\t/type/object/name\n/lol/doesnt_exist\tBlade Runner");
        }
        finally {
            unmockWarnTypeMissing();
            unmockFetch();
        }
    }
    ,testUnwarnedSpreadsheet: function() {
        var unmockInputWarning = temporaryMock(window, 'addInputWarning', fail);
        
        try {
            justParseIt("/type/object/type\t/type/object/name\n/film/film\tBlade Runner");
        }
        finally {
            unmockInputWarning()
        }
    }
    ,testLongText: function() {
        testLiteral(stringWithLength(4097), "/type/text", true);
    }
    ,testLongRawString: function() {
        testLiteral(stringWithLength(4097), "/type/rawstring", true);
    }
}

var badBooleans = ["0", "TRUE", "truee", "obviously wrong"];
var badInts = ["1.2", "1e4", "0odeadbeef", "0badbadbad", "o0124", "obviously wrong"];//"9223372036854775808", "-9223372036854775809"
var badFloats = ["Infinity","NaN", "obviously wrong"];
var badDateTimes = ["Jun 27 2009"];

var goodBooleans = ["true", "false"];
var goodInts = ["0","1","-1","128"];//,"9223372036854775807", "-9223372036854775808"];
var goodFloats = ["1.0", "1", ".0", "-1", "1E5", "1E-5", "5.98e24"];
var goodDateTimes = ["2001","2001-01","2001-01-01","2001-01-01T01Z",
                      "2000-12-31T23:59Z","2000-12-31T23:59:59Z",
                      "2000-12-31T23:59:59.9Z", "00:00:00Z","12:15","17-05:00"];

$.each([[badBooleans,  goodBooleans,  "/type/boolean"], 
        [badInts,      goodInts,      "/type/int"], 
        [badFloats,    goodFloats,    "/type/float"],
        [badDateTimes, goodDateTimes, "/type/datetime"]], function(_, triple) {
    addTests(triple[0], triple[2], true);
    addTests(triple[1], triple[2], false);
});

function addTests(values, type, expectedToFail) {
    $.each(values, function(_, value) {
        var testName = "test `" + value + "` as " + (expectedToFail ? "an invalid" : "a valid") + " " + type;
        warningTests[testName] = function() {testLiteral(value, type, expectedToFail)}; 
    });
}

function testLiteral(value, type, expectedToFail) {
    var called = false;
    var unmockBadLiteral = temporaryMock(window, "addInputWarning", function() {
        called = true;
    });
    try {
        validateValueForType(value, type);
    }
    finally {
        unmockBadLiteral();
    }
    assertEquals(expectedToFail, called);
}








function stringWithLength(n) {
    var s = "";
    for (var i = 0; i < n; i++) 
        s += "F";
    return s;
}



TestCase("input warnings",warningTests);
