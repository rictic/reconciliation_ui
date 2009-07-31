// ========================================================================
// Copyright (c) 2008-2009, Metaweb Technologies, Inc.
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
// 
// THIS SOFTWARE IS PROVIDED BY METAWEB TECHNOLOGIES AND CONTRIBUTORS
// ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL METAWEB
// TECHNOLOGIES OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
// OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
// DAMAGE.
// ========================================================================

var totalRecords = 0;
var mqlProps;
var mqlMetadata = {};
var headers;
var rows;
var complexHeaders;
var simpleHeaders;

/*
** Parsing and munging the input
*/

function parseTSV(spreadsheet, onComplete) {
    var position = 0;
    
    function parseLine() {
        var fields = [];
        var inQuotes = false;
        var field = "";
        function nextField() {
            fields.push(field);
            field = "";
            position++;
        }
        function isEndOfLine() {
            switch(spreadsheet.charAt(position)){
              case "": 
              case "\n": return true;
              case "\r": if (spreadsheet.charAt(position+1) == "\n") {
                            position++; return true;                            
                         }
              default: return false;
            }
        }
        //If this gives me any more trouble, I'm just doing a state machine
        while(true) {
            var c = spreadsheet.charAt(position);
            if (inQuotes){
                //quotes are quoted with two adjacent quotes
                if (c == '"' && spreadsheet.charAt(position+1) == '"'){
                    field += c;
                    position += 2;
                    continue;
                }
                //end of the quoted field
                if (c == '"'){
                    inQuotes = false;
                    position++;
                    if (isEndOfLine()){
                        fields.push(field);
                        position++;
                        return fields;
                    }
                    nextField();
                    continue;
                }
                
                if (c == ""){
                    error("unexpected end of input, no closing double-quote marks found");
                    fields.push(field);
                    position+=1;
                    return fields;
                }
                
                //just a character in the quoted field
                field += c;
                position++;
                continue;
            }
            
            //the field is quoted
            if (spreadsheet.charAt(position) == '"'){
                inQuotes = true;
                position++;
                continue;
            }
            
            //end of the field
            if (c == "\t"){
                nextField();
                continue;
            }
            
            //end of the line
            if (isEndOfLine()){
                fields.push(field);
                position += 1;
                return fields;
            }
            
            //just a character in the field
            field += c;
            position += 1;
        }
    }
    var rows = [];
    var yielder = new Yielder();
    function parseSpreadsheet() {
        while(spreadsheet.charAt(position) != "") {
            rows.push(parseLine());
            if (yielder.shouldYield(parseSpreadsheet))
                return;
        }
        onComplete(rows);
    }
    parseSpreadsheet();
}

function removeBlankLines(rows, onComplete) {
    var newRows = [];
    politeEach(rows, function(_,row) {
        if (row.length === 1 && row[0] === "")
            return;
        newRows.push(row);
    }, 
    function(){onComplete(newRows);});
}

function buildRowInfo(spreadsheetRows, onComplete) {
    resetEntities();
    headers = spreadsheetRows.shift();
    mqlProps = getMqlProperties(headers);
    fetchPropMetadata(buildRows, function(errorProps) {
        error("Can't find these mqlProps:")
        error(errorProps);
        mqlProps = arrayDifference(mqlProps, errorProps);
        buildRows();
    });
    
    function buildRows() {
        rows = [];
        politeEach(spreadsheetRows,function(_,rowArray) {
            var rowHeaders  = headers.slice();
            var rowMqlProps = mqlProps.slice();
            var entity = new Entity({"/rec_ui/headers": rowHeaders,
                                    "/rec_ui/mql_props": rowMqlProps,
                                    "/rec_ui/toplevel_entity": true});
            for (var i=0; i < headers.length; i++){
                var val = rowArray[i];
                if (rowArray[i] === "")
                    val = undefined;
                entity[headers[i]] = [val];
            }   
            rows.push(entity);
        },function() {onComplete(rows);});
    }
}

/*
*  Starting at `from+1`, look for the first row that has an entry in the
*  first column which is followed by a row without an entry in the first
*  column.
*/
function getAmbiguousRowIndex(from, onFound, noneLeft, yielder) {
    if (from == undefined)
        from = -1;
    from++;
    yielder = yielder || new Yielder();
    var startingRowIdx;
    var i = from;
    function searchForAmbiguity() {
        for(;i < rows.length; i++) {
            if (rows[i][headers[0]][0] != "" && rows[i][headers[0]][0] != undefined)
                startingRowIdx = i;
            else if (startingRowIdx != undefined)
                return onFound(startingRowIdx);
            if (yielder.shouldYield(searchForAmbiguity))
                return;
        }
        noneLeft();
    }
    searchForAmbiguity();
}


function combineRows(onComplete) {
    var rowIndex = undefined;
    var yielder = new Yielder();
    
    function doCombineRows() {
        getAmbiguousRowIndex(rowIndex, rowCombiner, onComplete, yielder);
    }
    
    function rowCombiner(ambiguousRow) {
        rowIndex = ambiguousRow;
        var mergeRow = rows[rowIndex];
        var i;
        for (i = rowIndex+1; i < rows.length && rows[i][headers[0]][0] == undefined;i++) {
            for (var j = 0; j<headers.length; j++) {
                var col = headers[j];
                mergeRow[col].push(rows[i][col][0]);
            }
            entities[rows[i]["/rec_ui/id"]] = undefined;
        }
        //remove the rows that we've combined in
        rows.splice(rowIndex+1, (i - rowIndex) - 1);
        doCombineRows();
    }
    doCombineRows();
}

function spreadsheetProcessed(callback) {
    function isUnreconciled(entity) {
        if (entity["/rec_ui/is_cvt"])
            return false;
        return contains([undefined,null,"indeterminate",""], entity.id);
    }
    addIdColumns();
    objectifyRows(function() {
        totalRecords = rows.length;
        var rec_partition = partition(rows,isUnreconciled);
        automaticQueue = rec_partition[0];
        $.each(rec_partition[1],function(_,reconciled_row){
            addColumnRecCases(reconciled_row);
        });
        $(".initialLoadingMessage").hide();
        callback();
    });
}

function fetchPropMetadata(onComplete, onError) {
    function getQuery(prop) {
        return {
            "expected_type" : {
                "extends" : [],
                "id" : null
            },
            "reverse_property" : null,
            "master_property"  : null,
            "type" : "/type/property",
            "name":null,
            "id" : prop
        }
    }
    var envelope = {};
    $.each(getProperties(headers), function(i, mqlProp) {
        $.each(mqlProp.split(":"), function(i, simpleProp) {
            if (simpleProp == "id") return;
            envelope[simpleProp.replace(/\//g,'Z')] = {"query": getQuery(simpleProp)};
        })
    })
    function handler(results) {
        var errorProps = handleMQLPropMetadata(results);
        if (errorProps.length > 0)
            return onError(errorProps);
        onComplete();
    }
    freebase.mqlRead(envelope, handler);
}

function handleMQLPropMetadata(results) {
    assert(results.code == "/api/status/ok", results);
    var errorProps = [];
    $.each(getProperties(headers), function(_,complexProp){
        $.each(complexProp.split(":"), function(_, mqlProp) {
            if (mqlProp == "id") return;
            var result = results[mqlProp.replace(/\//g,'Z')];
            if (result.code != "/api/status/ok" || result.result === null){
                errorProps.push(mqlProp)
                return
            }
            result = result.result;
            result.inverse_property = result.reverse_property || result.master_property;
            mqlMetadata[result.id] = result;
            if (result.expected_type && mqlMetadata[result.expected_type.id] == undefined)
                mqlMetadata[result.expected_type.id] = {inverse_property: result.id};
        });
    });
    return errorProps;
}

function addIdColumns() {
    if (!contains(headers, "id"))
        headers.push("id");
    $.each(getProperties(headers), function(_,complexProp) {
        var partsSoFar = [];
        $.each(complexProp.split(":"), function(_, mqlProp) {
            if (mqlProp == "id") return;
            partsSoFar.push(mqlProp);
            var idColumn = partsSoFar.concat("id").join(":");
            var meta = mqlMetadata[mqlProp];
            if (!meta) return;
            if (!isValueProperty(mqlProp) && !contains(headers,idColumn) && mqlProp != "/type/object/type")
                headers.push(idColumn);
        });
    });
}

function objectifyRows(onComplete) {
    politeEach(rows, function(_,row) {
        for (var prop in row) {
            function objectifyRowProperty(value) {
                var result = new Entity({'/type/object/name':value,
                              '/type/object/type':meta.expected_type.id,
                              '/rec_ui/headers': ['/type/object/name','/type/object/type'],
                              '/rec_ui/mql_props': [],
                              });
                if (meta.inverse_property != null){
                    result[meta.inverse_property] = row;
                    result['/rec_ui/headers'].push(meta.inverse_property);
                    result['/rec_ui/mql_props'].push(meta.inverse_property);
                }
                return result;
            }
            
            var meta = mqlMetadata[prop];
            if (meta == undefined || isValueType(meta.expected_type) || prop == "/type/object/type")
                continue;
            var newProp = [];
            for (var i = 0; i < row[prop].length; i++)
                if (row[prop][i])
                    newProp[i] = objectifyRowProperty(row[prop][i])
            row[prop] = newProp
        }
        $.each(filter(headers, function(h){return charIn(h,":");}), function(_,complexHeader) {
            var valueArray = row[complexHeader];
            if (valueArray === undefined) return;
            var parts = complexHeader.split(":");
            var slot;
            function cvtEntity(meta, parent) {
                var cvt = new Entity({"/type/object/type":meta.expected_type.id,
                                     "/rec_ui/is_cvt":true,
                                     "/rec_ui/parent":parent,
                                     "/rec_ui/mql_props" :[],
                                     "/rec_ui/cvt_props":[]});
                if (meta.inverse_property != null){
                    cvt[meta.inverse_property] = parent;
                    cvt["/rec_ui/mql_props"].push(meta.inverse_property);
                }
                return cvt;
            }
            var firstPart = parts[0];
            $.each(valueArray, function(i,value) {
                if (value === undefined)
                    return; //read as continue
                if (!(firstPart in row))
                    row[firstPart] = [];
                if (row[firstPart][i] === undefined)
                    row[firstPart][i] = cvtEntity(mqlMetadata[firstPart], row);;
                slot = row[firstPart][i];
                $.each(parts.slice(1,parts.length-1), function(_,part) {
                    if (!(part in slot))
                        slot[part] = cvtEntity(mqlMetadata[part], slot);
                    slot = slot[part];
                });
                var lastPart = parts[parts.length-1];
                var meta = mqlMetadata[lastPart];
                if (meta === undefined && lastPart !== "id")
                    return; //if we don't know what it is, leave it as it is
                if (lastPart === "id" || isValueProperty(lastPart))
                    slot[lastPart] = value;
                else {
                    var new_entity = new Entity({"/type/object/type":meta.expected_type.id,
                                                "/type/object/name":value,
                                                '/rec_ui/headers': ['/type/object/name','/type/object/type'],
                                                '/rec_ui/mql_props': [],
                                                });
                    if (meta.inverse_property) {
                        new_entity[meta.inverse_property] = slot;
//                         cvt["/rec_ui/mql_props"].push(meta.inverse_property);
                        var reversedParts = $.map(parts.slice().reverse(), function(part) {return (mqlMetadata[part] && mqlMetadata[part].inverse_property) || false;});
                        if (all(reversedParts)){
                            new_entity["/rec_ui/mql_props"].push(reversedParts.join(":"));
                            new_entity["/rec_ui/headers"].push(reversedParts.join(":"));
                        }
                            
                    }
                    slot[lastPart] = new_entity;
                    if (slot['/rec_ui/is_cvt'])
                        slot['/rec_ui/cvt_props'].push(lastPart);
                }
                    
            });
            delete row[complexHeader];
        });
        
        /* Recursively removes undefined objects from arrays anywhere in an object.
            Also, collapses singleton lists to single objects, to work around a bug in
            the reconciliation service.
            Supports self referential objects (though not self referential arrays)*/
        function cleanup(obj, closed) {
            //Only interested in Arrays and objects
            if (typeof(obj) != "object")
                return obj;
            
            //setup a closed list to handle mutually recursive data structures
            if (closed === undefined) closed = {};
            if (closed[obj])
                return obj; //we've seen this object before
            
            if ($.isArray(obj)) {
                var arr = filter(obj, function(val){return val !== undefined});
                if (arr.length === 1)
                    return cleanup(arr[0], closed);
                else
                    return $.map(arr, function (val) {return cleanup(val,closed);});
            }
            
            closed[obj] = true;
            for (var key in obj){
                if (key.match(/^\/rec_ui\//)) continue; //don't touch our own internal properties
                obj[key] = cleanup(obj[key], closed);
            }
            return obj
        }
        cleanup(row);
        if ($.isArray(row.id))
            row.id = row.id[0];
    }, onComplete);
}
