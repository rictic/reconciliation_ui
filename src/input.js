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
    
*/

//A namespace for types
var loader = {row:null, record:null, tree:null, pathsegment:null, path:null};

/** @typedef {!Array.<!string>}*/
loader.row;
/** @typedef {!Array.<!Array.<!string>>} */
loader.record;
/** @typedef {!Object.<!string,(!string,!loader.tree)>} */
loader.tree;
/** @typedef {{prop: !string, index: !number}} */
loader.pathsegment;
/** @typedef {Array.<loader.pathsegment>} */
loader.path;


//Some globals that various components poke into
var totalRecords = 0;
var mqlProps;
var headers;
var originalHeaders;
var rows;
var typesSeen = new Set();
var propertiesSeen = new Set();
var inputType;


/*
** Parsing and munging the input
*/


/** @param {!string} input Either a tsv or a json array of trees
  * @param {!function(number, function(boolean))} ambiguityResolver
  * @param {!function()} onComplete
  * @param {Yielder=} yielder
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
            buildRowInfo(spreadsheetRows, onComplete, yielder);
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

// function parseSpreadsheet(spreadsheet, multiline)
// {
//     if(multiline)
//     {
//         
//     }
//     else
//     {
//         var records = parseSinglelineRecords(rows.slice(1))
//     }
//     
// 
//     return {"headers":headerData, "headerPaths":headerPaths, "entities":entities}
// }


/** @param {!Array.<!loader.row>} spreadsheetRows
  * @param {!function()} onComplete
  * @param {Yielder=} yielder
  */
function buildRowInfo(spreadsheetRows, onComplete, yielder) {
    //keeps us from crashing on blank input
    if (spreadsheetRows.length === 0) return;

    yielder = yielder || new Yielder();

    // parse headers:
    originalHeaders = spreadsheetRows.shift();
    headers = originalHeaders;
    var headerPaths = [];
    $.each(headers, function(_, rawHeader) {
        headerPaths.push(parseHeaderPath($.trim(rawHeader)));
    })

    var records = parseMultilineRecords(spreadsheetRows);
    var trees = []
    $.each(records, function(i,record) {
        var tree = {}
        $.each(record, function(j, row) {
            for(var k in row)
            {
                var value = row[k]
                if(value != null && value.length > 0)
                {
                    pathPut(headerPaths[k], j, tree, value)
                }
            }
        });
        trees.push(tree)        
    });
    
    resetEntities();
    typesSeen = new Set();
    
    mqlProps = getMqlProperties(originalHeaders);
    
    parseTrees(trees, function(entities) {
        rows = entities;
        headers = originalHeaders;
        
        freebase.fetchPropertyInfo(getProperties(originalHeaders), onComplete, function(errorProps) {
            $.each(errorProps, warnUnknownProp);
            mqlProps = Arr.difference(mqlProps, errorProps);
            onComplete();
        });
    }, yielder);
}

/** @param {!Array.<!loader.tree>} trees
  * @param {!function(!Array.<!tEntity>)} onComplete
  * @param {Yielder=} yielder
  */
function parseTrees(trees, onComplete, yielder) {
    yielder = yielder || new Yielder();
    findAllProperties(trees, function(props) {
        freebase.fetchPropertyInfo(props, afterPropertiesFetched, 
            function onError(errorProps) {
                $.each(errorProps, warnUnknownProp);
                afterPropertiesFetched();
            }
        );
        
        function afterPropertiesFetched() {
            treesToEntities(trees, onComplete, yielder);
        }
    }, yielder);
}

/**
*  Starting at `from+1`, look for the first row that has an entry in the
*  first column which is followed by a row without an entry in the first
*  column.
* 
* @param {(number|undefined|null)} from
* @param {function(number)} onFound
* @param {function()} noneLeft
* @param {Yielder=} yielder
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

/**
 * Returns true if an array of rows contains a multiline record (the first column in any row is empty).
 *
 * [["1", "2", "3"], ["a", "b", "c"]] returns false
 * [["1", "2", "3"], ["", "b", "c"]] returns true
 *
 * @param {Array.<loader.row>} rows
 * @return {boolean}
 */
function isMultilineFormat(rows)
{
    for(var i in rows)
    {
        if(rows[i][0].length == 0) return true;
    }
    return false;
}

/**
 * Parses a set of multi-line records.
 *
 * [["1", "2", "3"], ["", "b", "c"], ["d", "e", "f"]] returns [ [["1", "2", "3"], ["", "b", "c"]], [["d", "e", "f"]] ]
 *
 * @param {Array.<loader.row>} rows
 * @return {Array.<loader.record>}
 */
function parseMultilineRecords(rows)
{
    var records = []
    var currentRecord = []
    for(var i in rows)
    {
        var currentRow = rows[i]
        // start new record if the first column is non-empty and the current record is non-empty:
        if(currentRow[0].length > 0 && currentRecord.length > 0)
        {
            records.push(currentRecord)
            currentRecord = []
        }
        currentRecord.push(currentRow)
    }
    if(currentRecord.length > 0) records.push(currentRecord)
    return records
}

/**
 * Parses a set of single-line records.
 *
 * [["1", "2", "3"], ["a", "b", "c"]] returns [[["1", "2", "3"]], [["a", "b", "c"]]]
 *
 * @param {Array.<loader.row>} rows
 * @return {Array.<loader.record>}
 */
function parseSinglelineRecords(rows)
{
    var records = []
    for(var i in rows)
    {
        records.push([rows[i]])
    }
    return records
}


/**
 * Parses a header into a path object.
 *
 * "/foo/bar:/baz/asdf[1]:/fdsa[2]" returns
 *   [ {"prop":"/foo/bar", "index":0},
 *     {"prop":"/baz/asdf", "index":1},
 *     {"prop":"/fdsa", "index":2} ]
 *
 * @param {string} path
 * @return loader.path
 */
function parseHeaderPath(path)
{
    /**
     * Returns the index or 0.
     */
    function parseIndex(part)
    {
        var numsearch = part.match(/\[(\d+)\]/)
        if(numsearch == null || numsearch.length != 2) return 0
        else return parseInt(numsearch[1], 10)
    }

    /**
     * Returns the property without the index.
     */
    function parseProp(part)
    {
        var propsearch = part.match(/(.+)\[\d+\]/)
        if(propsearch == null || propsearch.length != 2) return part
        else return propsearch[1]
    }
    var paths = []
    var parts = path.split(/[:.]/)
    for(var i in parts)
    {
        path = {"index":parseIndex(parts[i]), "prop":parseProp(parts[i])}
        paths.push(path)
    }
    return paths
}

/**
 * Takes a list of path objects, an index for the first path,
 * and a target record and value, and inserts the value into the
 * record.
 *
 * @param {loader.path} paths
 * @param {number} topindex
 * @param {loader.tree} record
 * @value {string} value
 *
 */
function pathPut(paths, topindex, record, value)
{
    function putValue(currentRecord, pathIndex)
    {
        var currentPath = paths[pathIndex]
        var lastPath = pathIndex + 1 >= paths.length

        // if we're at the last path:
        if(lastPath)
        {
            // special case for ids:
            if(currentPath.prop == "id") currentRecord["id"] = value
            else
            {
                // place the value:
                if(!(currentPath.prop in currentRecord)) currentRecord[currentPath.prop] = []
                currentRecord[currentPath.prop][currentPath.index] = value
            }
        }

        // otherwise recurse:
        else
        {
            if(!(currentPath.prop in currentRecord)) currentRecord[currentPath.prop] = []
            var currentList = currentRecord[currentPath.prop]
            if(currentList.length <= currentPath.index ||
               currentList[currentPath.index] == null)
                currentList[currentPath.index] = {}
            putValue(currentList[currentPath.index], pathIndex + 1)
        }
    }
    paths[0].index = topindex
    putValue(record, 0)
}

/**
 * Takes a list of path objects, an index for the first path,
 * and a target record gets the value from the record.
 *
 * @param {loader.path} paths
 * @param {number} topindex
 * @param {loader.tree} record
 */
function pathGet(paths, topindex, record)
{
    function getValue(currentRecord, pathIndex)
    {
        var currentPath = paths[pathIndex]
        if(!(currentPath.prop in currentRecord))
        {
            return null
        }
        var currentList = currentRecord[currentPath.prop]

        // no more paths, get the value:
        if(pathIndex + 1 >= paths.length)
        {
            // special case for ids - no lists:
            if(currentPath.prop == "id") return currentList
            else return currentList[currentPath.index]
        }
        // recurse to the next path:
        else
        {
            if(currentList.length <= currentPath.index)
            {
                return null
            }
            getValue(currentList[currentPath.index], pathIndex + 1)
        }
    }
    paths[0].index = topindex
    getValue(record, 0)
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
            //if the property is /type/object/type then we treat it as an id automatically, no id column needed
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

/** Takes a list of trees and returns a list of all mql properties found anywhere
  * in any of the trees
  * @param {!Array.<loader.tree>} trees
  * @param {!function()} onComplete
  * @param {Yielder=} yielder
  */  
function findAllProperties(trees, onComplete, yielder) {
    politeEach(trees, findProps, function() {
        onComplete(propertiesSeen.getAll());
    }, yielder);
    
    function findProps(_,obj) {
        switch(getType(obj)) {
        case "array":
            $.map(obj, findProps); 
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
function treesToEntities(trees, onComplete, yielder) {
    politeMap(trees, function(record){return treeToEntity(record)}, onComplete, yielder);
}

/** Assumes that the metadata for all properties encountered
  * already exists.  See findAllProperties() and freebase.fetchPropertyInfo
  * @param {!Object} tree
  * @param {Object=} parent
  * @param {function(Object)=} onAddProperty
*/
function treeToEntity(tree, parent, onAddProperty) {
    var entity = new tEntity({'/rec_ui/toplevel_entity': !parent});
    if (parent)
        entity['/rec_ui/parent'] = [parent];
    for (var prop in tree){
        var value = $.makeArray(tree[prop]);
        var propMeta = freebase.getPropMetadata(prop);
            
        value = $.map(value, function(innerTree) {
            if (getType(innerTree) === "string") {
                if (isValueProperty(prop) || !propMeta)
                    return innerTree; //leave it as a string
                
                innerTree = {"/type/object/name" : innerTree};
            }
            
            var innerEntity = treeToEntity(innerTree, entity);
            if (propMeta) {
                if (propMeta.expected_type && !("/type/object/type" in innerEntity))
                    innerEntity.addProperty("/type/object/type", propMeta.expected_type.id);
                if (propMeta.inverse_property)
                    innerEntity.addProperty(propMeta.inverse_property, entity);
            }
            return innerEntity;
        });
        entity.addProperty(prop, value);
        if (onAddProperty)
            onAddProperty(prop);
    }
    
    return entity;
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
    
    parseTrees(trees, function(entities) {
        rows = entities;
        headers = rows[0]['/rec_ui/headers'];
        mqlProps = rows[0]['/rec_ui/mql_props'];
        onComplete();
    }, yielder);
}

function warnUnknownProp(_, errorProp) {
    addInputWarning("Cannot find property '" + errorProp + "'");
}