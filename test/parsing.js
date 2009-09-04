var value_prop = {
    "expected_type" : {
        "extends" : ["/type/value"],
        "id" : null,
        "/freebase/type_hints/mediator" : {"optional":true, "value":null}
    },
    "reverse_property" : null,
    "master_property"  : null,
    "type" : "/type/property",
    "name":null,
    "id" : null
}
var topic_prop = {
    "expected_type" : {
        "extends" : [],
        "id" : null,
        "/freebase/type_hints/mediator" : {"optional":true, "value":null}
    },
    "reverse_property" : null,
    "master_property"  : null,
    "type" : "/type/property",
    "name":null,
    "id" : null
}
var freebase = {
    fetchPropertyInfo:function(props,onComplete,onError){onComplete();},
    getPropMetadata:function(prop){
        if (prop.substr(0,8) == "/rec_ui/") return undefined;
        if (prop.substr(0,5) == "topic") return topic_prop;
        return value_prop;
    },
    fetchTypeInfo:function(types, onComplete, onError) {onComplete();}
}

var tests = {
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

function addCompleteParsingTestCase(name, spreadsheet, expectedParse, collapseRows) {
    tests["test completely processing a " + name] = function() {
        expectAsserts(1);

        parseTSV(spreadsheet,function(spreadsheetRowsWithBlanks) {
            removeBlankLines(spreadsheetRowsWithBlanks, function(spreadsheetRows) {
                buildRowInfo(spreadsheetRows, function(rows){
                    if (collapseRows)
                        getAmbiguousRowIndex(undefined,function(){
                            combineRows(finishProcessing)
                        }, fail);
                    else
                        getAmbiguousRowIndex(undefined, fail, finishProcessing);
                });
            })
        });
        function finishProcessing() {
            objectifyRows(function() {
                spreadsheetProcessed(function() {
                    assertSubsetOf("parsed input", rows, expectedParse);
                })
            })
        }
    }
}

addCompleteParsingTestCase("simple two column, one row sheet",
                           "a\tb\n1\t2",
                           [{a:"1",b:"2"}]);
 
addCompleteParsingTestCase("spreadsheet with missing empty cell",
                           "a\tb\tc\n1\t2\t3\n4\t\t5",
                           [{a:"1",b:"2",c:"3"},{a:"4",c:"5"}]);

addCompleteParsingTestCase("spreadsheet with nested data",
                           "a:b\ta:c\td\n1\t2\t3",
                           [{a:[{b:[1],c:[2]}],d:[3]}]);

addCompleteParsingTestCase("ambiguous spreadsheet",
                           "a\tb\tc\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:[1],b:[2],c:[3]},{b:[4],c:[5]},{a:[6],b:[7]}]);
addCompleteParsingTestCase("ambiguous spreadsheet",
                           "a\tb\tc\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:[1],b:[2,4],c:[3,5]},{a:[6],b:[7]}],true);
 
addCompleteParsingTestCase("ambiguous spreadsheet with nested data across multiple rows",
                           "a\tb:c\t:b:d\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:[1],b:[{c:[2],d:[3]}]},{b:[{c:[4],d:[5]}]},{a:[6],b:[{c:[7]}]}]);
addCompleteParsingTestCase("ambiguous spreadsheet with nested data across multiple rows",
                           "a\tb:c\t:b:d\n1\t2\t3\n\t4\t5\n6\t7",
                           [{a:[1],b:[{c:[2],d:[3]},{c:[4],d:[5]}]},{a:[6],b:[{c:7}]}],true);

addCompleteParsingTestCase("ambiguous spreadsheet with first column nested",
                           "a:b\ta:c\td\n1\t2\t3\n\t4\t5",
                           [{a:[{b:[1],c:[2]}],d:[3]},{a:[{c:[4]}],d:[5]}]);
addCompleteParsingTestCase("ambiguous spreadsheet with first column nested",
                           "a:b\ta:c\td\n1\t2\t3\n\t4\t5",
                           [{a:[{b:[1],c:[2]},{c:[2]}],d:[3,5]}],true);

TestCase("ParsingTest",tests);

