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
var headers;
var rows;
var typesSeen = new Set();
var inputType;
/*
** Parsing and munging the input
*/

function parseInput(input, ambiguityResolver, onComplete, yielder) {
    clearInputWarnings();
    yielder = yielder || new Yielder();

    if (input.charAt(0) === "[") {
        inputType = "JSON";
        parseJSON(input, onComplete, yielder);
        return;
    }
    
    inputType = "TSV";
    function handleAmbiguity(shouldCombineRows) {
        if (shouldCombineRows)
            combineRows(onComplete);
        else
            onComplete();
    }

    parseTSV(input,function(spreadsheetRowsWithBlanks) {
        removeBlankLines(spreadsheetRowsWithBlanks, function(spreadsheetRows) {
            buildRowInfo(spreadsheetRows, function(rows){
                getAmbiguousRowIndex(undefined,
                                     function curry(startingRowIdx){ambiguityResolver(startingRowIdx,handleAmbiguity);}, 
                                     onComplete, yielder);
            }, yielder);
        }, yielder)
    }, yielder);
}

function parseTSV(spreadsheet, onComplete, yielder) {
    yielder = yielder || new Yielder();
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

function removeBlankLines(rows, onComplete, yielder) {
    var newRows = [];
    politeEach(rows, function(_,row) {
        if (row.length === 1 && row[0] === "")
            return;
        newRows.push(row);
    }, 
    function(){onComplete(newRows);}, yielder);
}

function setupHeaderInfo(headers, onComplete, onError) {
    typesSeen = new Set();
    mqlProps = getMqlProperties(headers);
    freebase.fetchPropertyInfo(getProperties(headers), onComplete, onError);
}

function buildRowInfo(spreadsheetRows, onComplete, yielder) {
    yielder = yielder || new Yielder();
    resetEntities();
    if (spreadsheetRows.length === 0) return;
    headers = $.map(spreadsheetRows.shift(), function(header){return $.trim(header)});
    setupHeaderInfo(headers, buildRows, function(errorProps) {
        $.each(errorProps, warnUnknownProp);
        mqlProps = Arr.difference(mqlProps, errorProps);
        buildRows();
    });
    

    function buildRows() {
        politeMap(spreadsheetRows,function(rowArray) {
            var rowHeaders  = headers.slice();
            var rowMqlProps = mqlProps.slice();
            var entity = new tEntity({"/rec_ui/headers": rowHeaders,
                                    "/rec_ui/mql_props": rowMqlProps,
                                    "/rec_ui/toplevel_entity": true});
            for (var i=0; i < headers.length; i++){
                var val = rowArray[i];
                if (rowArray[i] === "")
                    val = undefined;
                entity[headers[i]] = [val];
            }
            return entity;
        },function(newRows) {
            rows = newRows;
            onComplete(rows);
        },
        yielder);
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

function addIdColumns() {
    if (!Arr.contains(headers, "id"))
        headers.push("id");
    $.each(getProperties(headers), function(_,complexProp) {
        var partsSoFar = [];
        $.each(complexProp.split(":"), function(_, mqlProp) {
            if (mqlProp == "id") return;
            partsSoFar.push(mqlProp);
            var idColumn = partsSoFar.concat("id").join(":");
            var meta = freebase.getPropMetadata(mqlProp);
            //if we don't have metadata on it, it's not a valid property, so no id column for it
            if (!meta) return;
            //if it's a value then it doesn't get an id
            if (isValueProperty(mqlProp)) return;
            //if there already is an id column for it, then don't create a new one
            if (Arr.contains(headers,idColumn)) return;
            //if the property is /type/objec/type then we treat it as an id automatically, no id column needed
            if (mqlProp == "/type/object/type") return;
            //if it's a CVT then we won't do reconciliation of it ourselves (that's triplewriter's job)
            //so no id column
            if (meta.expected_type && isCVTType(meta.expected_type))
                return;
            //otherwise, add an id column
            headers.push(idColumn);
        });
    });
}

function objectifyRows(onComplete) {
    politeEach(rows, function(_,row) {
        if (inputType === "JSON")
            return;
        for (var prop in row) {
            function objectifyRowProperty(value) {
                var result = new tEntity({'/type/object/name':value,
                              '/type/object/type':meta.expected_type.id,
                              '/rec_ui/headers': ['/type/object/name','/type/object/type']
                              });
                if (meta.inverse_property != null){
                    result[meta.inverse_property] = row;
                    result['/rec_ui/headers'].push(meta.inverse_property);
                    result['/rec_ui/mql_props'].push(meta.inverse_property);
                }
                return result;
            }
            
            var meta = freebase.getPropMetadata(prop);
            if (meta == undefined || isValueType(meta.expected_type) || prop == "/type/object/type")
                continue;
            var newProp = [];
            for (var i = 0; i < row[prop].length; i++)
                if (row[prop][i])
                    newProp[i] = objectifyRowProperty(row[prop][i])
            row[prop] = newProp
        }
        $.each(Arr.filter(headers, function(h){return charIn(h,":");}), function(_,complexHeader) {
            var valueArray = row[complexHeader];
            if (valueArray === undefined) return;
            var parts = complexHeader.split(":");
            var slot;
            function innerEntity(meta, parent) {
                var entity = new tEntity({"/type/object/type":meta.expected_type.id,
                                     "/rec_ui/is_cvt":isCVTType(meta.expected_type)});
                entity.addParent(parent, meta.inverse_property);
                return entity;
            }
            var firstPart = parts[0];
            $.each(valueArray, function(i,value) {
                if (value === undefined)
                    return; //read as continue
                if (!(firstPart in row))
                    row.addProperty(firstPart,[]);
                if (row[firstPart][i] === undefined)
                    row[firstPart][i] = innerEntity(freebase.getPropMetadata(firstPart), row);;
                slot = row[firstPart][i];
                $.each(parts.slice(1,parts.length-1), function(_,part) {
                    if (!(part in slot))
                        slot.addProperty(part, innerEntity(freebase.getPropMetadata(part), slot));
                    slot = slot[part][0];
                });
                var lastPart = parts[parts.length-1];
                var meta = freebase.getPropMetadata(lastPart);
                if (meta === undefined && lastPart !== "id")
                    return; //if we don't know what it is, leave it as it is
                if (lastPart === "id" || lastPart == "/type/object/type" || isValueProperty(lastPart))
                    slot.addProperty(lastPart, value);
                else {
                    var new_entity = new tEntity({"/type/object/type":meta.expected_type.id,
                                                "/type/object/name":value,
                                                '/rec_ui/headers': ['/type/object/name','/type/object/type'],
                                                '/rec_ui/mql_props': []
                                                });
                    if (meta.inverse_property) {
                        new_entity[meta.inverse_property] = slot;
                        
                        var reversedParts = $.map(parts.slice().reverse(), function(part) {
                            return (freebase.getPropMetadata(part) && freebase.getPropMetadata(part).inverse_property) || false;
                        });
                        if (Arr.all(reversedParts)){
                            new_entity["/rec_ui/mql_props"].push(reversedParts.join(":"));
                            new_entity["/rec_ui/headers"].push(reversedParts.join(":"));
                        }
                    }
                    slot.addProperty(lastPart, new_entity);
                }
            });
            delete row[complexHeader];
        });
        
        /* Recursively removes undefined objects from arrays anywhere in an object.
            Also, collapses singleton arrays to the object inside
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
                var arr = Arr.filter(obj, function(val){return val !== undefined});
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
        $.each($.makeArray(row['/type/object/type']), function(_,type){if (type) typesSeen.add(type);})
    }, onComplete);
}

//Takes a list of trees and returns a list of all mql properties found anywhere
//in any of the trees
function findAllProperties(trees, onComplete, yielder) {
    var propsSeen = new Set();
    politeEach(trees, findProps, function() {
        onComplete(propsSeen.getAll());
    }, yielder);
    
    function findProps(_,obj) {
        switch(getType(obj)) {
        case "array":
            $.map(obj, findProps); 
            break;
        case "object":
            for (var key in obj) {
                if (key.charAt(0) === "/") {
                    propsSeen.add(key);
                    findProps(null,obj[key]);
                }
            }
            break;
        }
    }
}

function recordsToEntities(records, onComplete, yielder) {
    politeMap(records, recordToEntity, onComplete, yielder);
}

/* Assumes that the metadata for all properties encountered
   already exists.  See findAllProperties() and freebase.fetchPropertyInfo
*/
function recordToEntity(tree, parent, onAddProperty) {
    log(tree);
    var entity = new tEntity({'/rec_ui/toplevel_entity': !parent});
    if (parent)
        entity['/rec_ui/parent'] = [parent];
    for (var prop in tree){
        var value = tree[prop];
        if (getType($.makeArray(value)[0]) === "object") {
            var propMeta = freebase.getPropMetadata(prop);
            
            value = $.map($.makeArray(value), function(innerTree) {
                var innerEntity = recordToEntity(innerTree, entity);
                if (propMeta) {
                    if (propMeta.expected_type && !("/type/object/type" in innerEntity))
                        innerEntity.addProperty("/type/object/type", propMeta.expected_type.id);
                    innerEntity.addProperty(propMeta.inverse_property, entity);
                }
                return innerEntity;
            });
        }
        entity.addProperty(prop, value);
        if (onAddProperty)
          onAddProperty(prop);
    }
    
    return entity;
}

function parseJSON(json, onComplete, yielder) {
    yielder = yielder || new Yielder();
    try {
        var records = JSON.parse(json);
    }
    catch(e) {
        inputError("JSON error: " + e);
        return;
    }
    
    findAllProperties(records, function(props) {
        freebase.fetchPropertyInfo(props, afterPropertiesFetched, 
            function onError(errorProps) {
                $.each(errorProps, warnUnknownProp);
                afterPropertiesFetched();
            }
        );
        
        function afterPropertiesFetched() {
            recordsToEntities(records, function(entities) {
                rows = entities;
                headers = rows[0]['/rec_ui/headers'];
                mqlProps = rows[0]['/rec_ui/mql_props'];
                onComplete();
            }, yielder);
        }
    }, yielder);
}

function warnUnknownProp(_, errorProp) {
    addInputWarning("Cannot find property '" + errorProp + "'");
}