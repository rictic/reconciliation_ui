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

/* 
    Parsing a spreadsheet into a tree.
    
    Our pipeline goes something like this:
    TSV Text -> [Row] -> [Record] -> [Tree]-> [Entity]
    
    OR
    
    JSON Array (as text) -> [Tree] -> [Entity]
    
    TSV text is a string representing a spreadsheet-like structure,
    tabs delimit the cells, and newlines delimit the rows.  Quoting
    is done usind double-quotes, and quotes are escaped with two adjacent
    double-quotes.  We support an extension of the TSV format where a row 
    with a blank first cell may be an extension of the row above.  This
    format is ambiguous with normal TSV files, so the user is prompted as
    to which was intended.
    
    Row: an array of unescaped strings.
    
    Record: an array of Rows.  At this point in the processing, the user
    has either chosen to keep every row of their TSV separate, in which case
    every Record will contain a single Row, or they may have chosen to collapse
    Rows missing the first cell, in which case the Records may consist of 
    several Rows.
    
    A Tree is a javascript object, the keys are headers from the TSV text
    and values are arrays of either strings or, when the key is a MQL property
    that is expected to point to a Topic in Freebase, a reified object.
    
    The JSON input format is just an array of Trees, and just skips the input
    pipeline up to that point.
    
*/

//A namespace for types
var loader = {row:null, record:null, tree:null};

/** @typedef {!Array.<!string>}*/
loader.row;
/** @typedef {!Array.<!Array.<!string>>} */
loader.record;
/** @typedef {!Object.<!string,(!string,!loader.tree)>} */
loader.tree;

//Some globals that various components poke into
var originalHeaders;
var rows;
var typesSeen = new Set();
var propertiesSeen = new Set();
var inputType;
var headerPaths;

/*
** Parsing and munging the input
*/

function resetGlobals() {
    //this is more or less a list of variables which need to be eliminated
    originalHeaders = rows = inputType = headerPaths = undefined;
    typesSeen = new Set();
    propertiesSeen = new Set();
}

/** @param {!string} input Either a tsv or a json array of trees
  * @param {!function(loader.record, function(boolean))} ambiguityResolver
  * @param {!function()} onComplete
  * @param {Yielder=} yielder
  */
function parseInput(input, ambiguityResolver, onComplete, yielder) {
    yielder = yielder || new Yielder();

    //reset global values
    clearInputWarnings();
    resetGlobals();

    if (input.charAt(0) === "[") {
        inputType = "JSON";
        parseJSON(input, onComplete, yielder);
        return;
    }
    
    inputType = "TSV";

    parseTSV(input,function(spreadsheetRowsWithBlanks) {
        removeBlankLines(spreadsheetRowsWithBlanks, function(spreadsheetRows) {
            buildRowInfo(spreadsheetRows, ambiguityResolver, onComplete, yielder);
        }, yielder)
    }, yielder);
}


/**
 * Splits a tsv into an array of arrays of strings.
 *
 * "1\t2\t3\t4\na\tb\tc\n" becomes [["1", "2", "3"], ["a", "b", "c"]]
 *
 * @param {string} spreadsheet
 * @param {function(Array.<loader.row>)} onComplete
 * @param {Yielder=} yielder
 */
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

/** @param {!Array.<loader.row>} rows
    @param {!function(Array.<loader.row>)} onComplete
    @param {Yielder=} yielder
*/
function removeBlankLines(rows, onComplete, yielder) {
    var newRows = [];
    politeEach(rows, function(_,row) {
        if (row.length === 1 && row[0] === "")
            return;
        newRows.push(row);
    }, 
    function(){onComplete(newRows);}, yielder);
}

/** @param {!Array.<!loader.row>} spreadsheetRows
  * @param {!function()} onComplete
  * @param {Yielder=} yielder
  */
function buildRowInfo(spreadsheetRows, ambiguityResolver, onComplete, yielder) {
    //keeps us from crashing on blank input
    if (spreadsheetRows.length === 0) return;

    yielder = yielder || new Yielder();

    // parse headers:
    originalHeaders = spreadsheetRows.shift();
    headerPaths = [];
    $.each(originalHeaders, function(_, rawHeader) {
        headerPaths.push(new loader.path($.trim(rawHeader)));
    })

    //fetching property metadata early helps in the UI
    freebase.fetchPropertyInfo(getProperties(headerPaths), function() {
        rowsToRecords(spreadsheetRows, function(singleRecords, multiRecords, exampleRecord) {
            if (exampleRecord === undefined)
                handleRecords(singleRecords);
            else
                ambiguityResolver(exampleRecord, function(useMultiRecords) {
                    handleRecords(useMultiRecords ? multiRecords : singleRecords);
                });
        }, yielder);
    });

    function handleRecords(records) {recordsToEntities(records, onComplete, yielder)}
}

function recordsToTrees(records, onComplete, yielder) {
    politeMap(records, recordToTree, onComplete, yielder);
}

function recordToTree(record) {
    var tree = {}
    $.each(record, function(j, row) {
        for(var k in row) {
            var value = row[k]
            if (k >= headerPaths.length) {
                var errorMessage = "There are more columns than headers.  " + row.length + " columns found, but only " + headerPaths.length + " headers.";
                inputError(errorMessage);
                throw new Error(errorMessage);
            }
            if(value != null && value.length > 0)
                pathPut(headerPaths[k], j, tree, value)
        }
    });
    return tree;
}

function recordsToEntities(records, onComplete, yielder) {
    recordsToTrees(records, function(trees) {
        resetEntities();
        typesSeen = new Set();


        treesToEntities(trees, function(entities) {
            rows = entities;
            onComplete();
        }, yielder);
    }, yielder);
}

/** @param {!Array.<!loader.tree>} trees
  * @param {!function(!Array.<!tEntity>)} onComplete
  * @param {Yielder=} yielder
  */
function treesToEntities(trees, onComplete, yielder) {
    yielder = yielder || new Yielder();
    findAllProperties(trees, function(props) {
        freebase.fetchPropertyInfo(props, afterPropertiesFetched, 
            function onError(errorProps) {
                $.each(errorProps, warnUnknownProp);
                afterPropertiesFetched();
            }
        );
        
        function afterPropertiesFetched() {
            mapTreesToEntities(trees, onComplete, yielder);
        }
    }, yielder);
}

/**
 * Parses rows into records.  The callback should be a function that takes either one or three arguments.
 * If one argument, then there was only one way to parse the rows into records, and the one argument is
 * just the records.  If multiple arguments, then the first is the singleline parse, the second the multiline parse,
 * and the third is an exemplary multiline record which differs from its singleline version, helpful for displaying
 * a disambiguation dialog to a user.
 *
 * Multiline rows:
 * [["1", "2", "3"], ["", "b", "c"], ["d", "e", "f"]] returns [ [["1", "2", "3"], ["", "b", "c"]], [["d", "e", "f"]] ]
 *
 * Singleline rows:
 * [["1", "2", "3"], ["a", "b", "c"]] returns [[["1", "2", "3"]], [["a", "b", "c"]]]
 
 * @param {!Array.<loader.row>} rows
 * @param {!function(!Array.<loader.record>, Array.<loader.record>=, loader.record=)} onComplete
 * @param {Yielder=} yielder
 */
function rowsToRecords(rows, onComplete, yielder) {
    yielder = yielder || new Yielder();
    
    var firstMultilineRecord = undefined;
    var multiRecords = [];
    var singleRecords = [];
    
    var currentMultiRecord = []
    
    function addMultiRecord() {
        if (currentMultiRecord.length > 1 && !firstMultilineRecord)
            firstMultilineRecord = currentMultiRecord;
        multiRecords.push(currentMultiRecord)
        currentMultiRecord = []
    }
    
    politeEach(rows, function(_, currentRow) {
        singleRecords.push([currentRow]);
        
        // start new record if the first column is non-empty and the current record is non-empty:
        if(currentRow[0].length > 0 && currentMultiRecord.length > 0)
            addMultiRecord();
        
        currentMultiRecord.push(currentRow);
    }, function() {
        if(currentMultiRecord.length > 0)
            addMultiRecord();
        if (singleRecords.length === multiRecords.length)
            onComplete(singleRecords);
        else
            onComplete(singleRecords, multiRecords, firstMultilineRecord);
    }, yielder);
}

/**
 * Inserts the value into the tree at the path (with the initial
 * index of topindex)
 *
 * @param {!loader.path} path
 * @param {!number} topindex
 * @param {!loader.tree} record
 * @value {!string} value
 *
 */
function pathPut(path, topindex, record, value) {
    /** @param {!loader.tree} currentRecord
      * @param {!number} pathIndex
      * @param {number=} currentIndex
      */
    function putValue(currentRecord, pathIndex, currentIndex) {
        var currentPart = path.parts[pathIndex]
        currentIndex = currentPart.index || currentIndex || 0;
        var atLastPath = pathIndex + 1 >= path.parts.length

        // if we're at the last path:
        if(atLastPath) {
            // special case for ids:
            if(currentPart.prop == "id") 
                currentRecord["id"] = value
            else {
                // place the value:
                if(!(currentPart.prop in currentRecord)) 
                    currentRecord[currentPart.prop] = []
                currentRecord[currentPart.prop][currentIndex] = value
            }
        }
        // otherwise recurse:
        else {
            if(!(currentPart.prop in currentRecord)) 
                currentRecord[currentPart.prop] = []
            var currentList = currentRecord[currentPart.prop]
            if(currentList.length <= currentIndex || currentList[currentIndex] == null)
                currentList[currentIndex] = {}
            if(getType(currentList[currentIndex]) === "string")
                currentList[currentIndex] = {"/type/object/name":[currentList[currentIndex]]};

            putValue(currentList[currentIndex], pathIndex + 1)
        }
    }
    putValue(record, 0, topindex)
}

function addIdColumns() {
    if (!columnAlreadyExists("id"))
        headerPaths.push(new loader.path("id"));
    $.each(headerPaths, function(_,headerPath) {
        var partsSoFar = [];
        //only add id columns if they look like mql props
        if (!isMqlProp(headerPath.parts[0].prop))
            return;
        
        $.each(headerPath.parts, function(_, part) {
            var mqlProp = part.prop;
            if (mqlProp == "id") return;

            partsSoFar.push(part.toString());
            var idColumn = partsSoFar.concat("id").join(":");
            var meta = freebase.getPropMetadata(mqlProp);
            //if we don't have metadata on it, it's not a valid property, so no id column for it
            if (!meta) return;
            //if it's a value then it doesn't get an id
            if (isValueProperty(mqlProp)) return;
            //if the property is /type/object/type then we treat it as an id automatically, no id column needed
            if (mqlProp == "/type/object/type") return;
            //if it's a CVT then we won't do reconciliation of it ourselves (that's triplewriter's job)
            //so no id column
            if (meta.expected_type && isCVTType(meta.expected_type))
                return;
            //if there already is an id column for it, then don't create a new one
            if (columnAlreadyExists(idColumn))
                return;
            
            //otherwise, add an id column
            headerPaths.push(new loader.path(idColumn));
        });
    });
    
    function columnAlreadyExists(header) {
        for (var i = 0; i < headerPaths.length; i++)
            if (headerPaths[i].toString() === header)
                return true;
        return false;
    }
}

/** Takes a list of trees and returns a list of all mql properties found anywhere
  * in any of the trees
  * @param {!Array.<loader.tree>} trees
  * @param {!function(Array.<string>)} onComplete
  * @param {Yielder=} yielder
  */  
function findAllProperties(trees, onComplete, yielder) {
    politeEach(trees, findProps, function() {
        onComplete(propertiesSeen.getAll());
    }, yielder);
    
    function findProps(_,obj) {
        switch(getType(obj)) {
        case "array":
            $.each(obj, findProps); 
            break;
        case "object":
            for (var key in obj) {
                if (key.charAt(0) === "/") {
                    propertiesSeen.add(key);
                    findProps(null,obj[key]);
                }
            }
            break;
        }
    }
}

/**
  * @param {!Array.<!loader.tree>} trees
  * @param {!function(!Array.<tEntity>)} onComplete
  * @param {Yielder=} yielder
  */
function mapTreesToEntities(trees, onComplete, yielder) {
    politeMap(trees, function(record){return mapTreeToEntity(record)}, onComplete, yielder);
}

/** Assumes that the metadata for all properties encountered
  * already exists.  See findAllProperties() and freebase.fetchPropertyInfo
  * @param {!Object} tree
  * @param {tEntity=} parent
*/
function mapTreeToEntity(tree, parent) {
    var entity = new tEntity({'/rec_ui/toplevel_entity': !parent});
    if (parent)
        entity.addParent(parent);
    else {
        if (originalHeaders)
            entity.setInitialHeaders(originalHeaders);
        $.each(requiredProperties, function(_,requiredProperty) {
            if (!(requiredProperty in tree))
                warnPropertyMissing(requiredProperty);
        });
    }
    for (var prop in tree){
        var values = $.makeArray(tree[prop]);
        var propMeta = freebase.getPropMetadata(prop);
        
        values = $.map(values, function(innerTree) {
            if (getType(innerTree) === "string") {
                if (!propMeta)
                    return innerTree; //not a valid mql property, leave it alone

                if (isValueProperty(prop))
                    return innerTree;
                
                //treat this string as a tree itself
                innerTree = {"/type/object/name" : innerTree};
            }
            
            var innerEntity = mapTreeToEntity(innerTree, entity);
            if (propMeta) {
                if (propMeta.expected_type && !("/type/object/type" in innerEntity))
                    innerEntity.addProperty("/type/object/type", propMeta.expected_type.id);
                if (propMeta.inverse_property)
                    innerEntity.addProperty(propMeta.inverse_property, entity);
            }
            
            if (innerEntity.isCVT())
                connectCVTProperties(innerEntity);
            
            return innerEntity;
        });
        entity.addProperty(prop, values);
    }
    
    return entity;
}

function connectCVTProperties(entity) {
    for (var prop in entity) {
        var propMeta = freebase.getPropMetadata(prop);
        if (!propMeta) {
            debugger;
            continue;
        }
        var inverseProp = propMeta.inverse_property;
        if (!inverseProp)
            continue;

        $.each(entity[prop], function(_, value) {
            if (!(value instanceof tEntity)) return;
            if (value === entity['/rec_ui/parent']) return;
            
            var otherProps = entity['/rec_ui/mql_props'];

            $.each(otherProps, function(_, otherProp) {
                if (otherProp === prop) return;

                value.propSeen(inverseProp + ":" + otherProp);
            })
        });
    }
    
}

/** @param {!string} json
  * @param {!function()} onComplete
  * @param {Yielder=} yielder
  */
function parseJSON(json, onComplete, yielder) {
    yielder = yielder || new Yielder();
    try {
        var trees = JSON.parse(json);
    }
    catch(e) {
        inputError("JSON error: " + e);
        return;
    }
    
    treesToEntities(trees, function(entities) {
        rows = entities;
        headerPaths = rows[0]['/rec_ui/headerPaths'];
        onComplete();
    }, yielder);
}

function warnUnknownProp(_, errorProp) {
    addInputWarning("Cannot find property '" + errorProp + "'");
}

/** @const */
var requiredProperties = ["/type/object/type", "/type/object/name"];
function warnPropertyMissing(propName) {
    addInputWarning(propName + " is required for Freebase Loader to function correctly");
}

function warnTypeMissing(typeName) {
    addInputWarning("Cannot find a type with the id " + typeName);
}
