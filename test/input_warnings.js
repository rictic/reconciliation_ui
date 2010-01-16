function justParseIt(spreadsheet) {
    parseInput(spreadsheet, function(_,f) {f(true)}, function() {});
}

TestCase("input warnings",{
    testUnknownProp: function() {
        var unmockFetch = temporaryMock(freebase, 'fetchPropertyInfo', function(types,onComplete,onError) {
            if (onError)
                onError(types);
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
    ,testUnwarnedSpreadsheet: function() {
        var unmockInputWarning = temporaryMock(window, 'addInputWarning', fail);
        
        try {
            justParseIt("/type/object/type\t/type/object/name\n/film/film\tBlade Runner");
        }
        finally {
            unmockInputWarning()
        }
    }
});