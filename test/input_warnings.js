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
        var unmockWarnUnknownProp= temporaryMock(window, 'warnUnknownProp', pass);
        
        try {
            expectAsserts(2);
            justParseIt("/a\t/b\n1\t2\n");
        }
        finally {
            unmockFetch();
            unmockWarnUnknownProp();
            resetGlobals();
        }
    }
});