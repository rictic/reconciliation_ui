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
}

var badBooleans = ["0", "TRUE", "truee", "obviously wrong"];
var badInts = ["1.2", "1e4", "0odeadbeef", "0badbadbad", "o0124", "9223372036854775808", "-9223372036854775809", "obviously wrong"];
var badFloats = ["Infinity","NaN", "obviously wrong"];
var badString = [stringWithLength(4097)];
var badRawString = [stringWithLength(4097)];

$.each([[badBooleans, "/type/boolean"], [badInts, "/type/int"], [badFloats, "/type/float"]], function(_, pair) {
    addTests(pair[0], pair[1], true);
});

function addTests(values, type, expectedToFail) {
    $.each(values, function(_, value) {
        var testName = "test " + value + " as " + (expectedToFail ? "an invalid" : "a valid") + " " + type;
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
    assertEq(expectedToFail, called);
}








function stringWithLength(n) {
    var s = "";
    for (var i = 0; i < n; i++) 
        s += "F";
    return s;
}



TestCase("input warnings",warningTests);
