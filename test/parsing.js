var parsing_tests = {
    "test parsing a simple TSV": function() {
        var simpleTSV = "\
name\ttype\n\
Stevie Wonder\t/people/person\n\
\"Tabs '\t' Mcgee\"\t/people/person\n\
\"\"\"Weird Al\"\" Yankovic\"\t/people/person\n";
        var expectedRows = [
            ["name","type"],
            ["Stevie Wonder","/people/person"],
            ["Tabs '\t' Mcgee","/people/person"],
            ['"Weird Al" Yankovic',"/people/person"]
        ]
        expectAsserts(1);
        parseTSV(simpleTSV, function(rows){
            assertEq("rows",expectedRows,rows);
        });
    },
    "test getAmbiguousRowIndex": function() {
        headers = ["a","b","c"];
        rows = [{a:["a"],b:["b"],c:[3]},
                {a:["a2"]}];
        expectAsserts(1)
        getAmbiguousRowIndex(undefined, function(){fail("ambiguous row found in unambiguous data")},function(){assertTrue("success",true);});
    },
    "test combineRows": function() {
        headers = ["a","b","c"];
        rows = [{a:["a"],b:["b"],c:[3]},
                {a:[undefined],b:["b2"],c:[undefined]}];
        expectAsserts(1);
        combineRows(function(combinedRows) {
            assertEq("",[{"a":["a",null],"b":["b","b2"],"c":[3,null]}],rows);
        })
    }
}

/** @param {!string} name
  * @param {!string} spreadsheet
  * @param {!Array.<!loader.tree>} expectedParse
  * @param {boolean=} ambiguous
  * @param {boolean=} collapseRows
  */
function addCompleteParsingTestCase(name, spreadsheet, expectedParse, ambiguous, collapseRows) {
    function parseCompletely(parseComplete) {
        var ambiguityFound = false;
        parseInput(spreadsheet, 
            function onAmbiguity(startingIdx, ambiguityHandler) {
                ambiguityFound = true;
                if (ambiguous)
                    ambiguityHandler(collapseRows);
                else
                    fail("Unexpected ambiguity");
            },
            function onComplete() {
                if (ambiguityFound && !ambiguous)
                    fail("Expected ambiguity, but was parsed as unambiguous");
                parseComplete();
            }
        );
    }
    
    var description = "";
    if (ambiguous){
        description += "an ambiguous ";
        if (collapseRows)
            description += "collapsed "; 
    }
    else description += "a "
    description += name;
    
    parsing_tests["test completely parsing " + description] = function theParsingTest() {
        expectAsserts(1);

        parseCompletely(function() {
            assertSubsetOf("parsed input", rows, expectedParse);
        })
    }
    
    parsing_tests["test re-rendering " + description] = function theSpreadsheetOutputTest() {
        expectAsserts(1);
        parseCompletely(function() {
            //rebuild the spreadsheet and confirm it's identical to the original
            renderSpreadsheet(function(outputSpreadsheet) {
                assertEquals(spreadsheet, $.trim(outputSpreadsheet));
            });
        });        
    }
}


addCompleteParsingTestCase("simple two column, one row sheet",
                           "a\tb\n1\t2",
                           [{a:1,b:2}]);
 
addCompleteParsingTestCase("spreadsheet with empty cell",
                           "a\tb\tc\n1\t2\t3\n4\t\t5",
                           [{a:1,b:2,c:3},{a:4,c:5}]);

addCompleteParsingTestCase("spreadsheet with nested data",
                           "a:b\ta:c\td\n1\t2\t3",
                           [{a:[{b:[1],c:[2]}],d:3}]);

addCompleteParsingTestCase("spreadsheet",
                           "a\tb\tc\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:1,b:2,c:3},{b:4,c:5},{a:6,b:7}], true, false);
addCompleteParsingTestCase("spreadsheet",
                           "a\tb\tc\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:1,b:[2,4],c:[3,5]},{a:6,b:7}],true,true);
 
addCompleteParsingTestCase("spreadsheet with nested data across multiple rows",
                           "a\tb:c\tb:d\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:1,b:[{c:[2],d:[3]}]},{b:[{c:[4],d:[5]}]},{a:6,b:[{c:[7]}]}],true);
addCompleteParsingTestCase("spreadsheet with nested data across multiple rows",
                           "a\tb:c\tb:d\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:1,b:[{c:[2],d:[3]},{c:[4],d:[5]}]},{a:6,b:[{c:[7]}]}],true,true);

addCompleteParsingTestCase("spreadsheet with first column nested",
                           "a:b\ta:c\td\n1\t2\t3\n\t4\t5",
                           [{a:[{b:[1],c:[2]}],d:3},{a:[{c:[4]}],d:5}],true);
addCompleteParsingTestCase("spreadsheet with first column nested",
                           "a:b\ta:c\td\n1\t2\t3\n\t4\t5",
                           [{a:[{b:[1],c:[2]},{c:[4]}],d:[3,5]}],true, true);

TestCase("ParsingTest",parsing_tests);

