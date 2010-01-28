function justParseIt(spreadsheet) {
    parseInput(spreadsheet, function(_,f) {f(true)}, function() {});
}

TestCase("input warnings",{
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
    ,testWarnTypeMissing: function() {
        var unmockWarnTypeMissing = temporaryMock(window, 'warnTypeMissing', pass);
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
});