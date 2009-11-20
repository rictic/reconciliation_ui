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

function parseSpreadsheet(spreadsheet, multiline)
{
    var rows = splitTSV(spreadsheet)
    // parse headers:
    var headerData = rows[0]
    var headerPaths = []
    for(var i in headerData)
    {
        headerPaths.push(parseHeaderPath(headerData[i]))
    }
    // parse rows:
    if(multiline)
    {
        var records = parseMultilineRecords(rows.slice(1))
    }
    else
    {
        var records = parseSinglelineRecords(rows.slice(1))
    }
    var entities = []
    for(var i in records)
    {
        var record = records[i]
        var entity = {}
        for(var j in record)
        {
            var row = record[j]
            for(var k in row)
            {
                var value = row[k]
                if(value != null && value.length > 0)
                {
                    pathPut(headerPaths[k], j, entity, value)
                }
            }
        }
        entities.push(entity)
    }
    return {"headers":headerData, "headerPaths":headerPaths, "entities":entities}
}

/**
 * Splits a tsv into an array of arrays of strings.
 *
 * "1\t2\t3\t4\na\tb\tc\n" becomes [["1", "2", "3"], ["a", "b", "c"]]
 *
 * @param tsv
 */
function splitTSV(tsv)
{

    var tsvRows = tsv.split("\n")
    var rows = []
    for(var i in tsvRows)
    {
        // remove whitespace rows:
        if(!/^[\n\t\f\r ]+$/.test(tsvRows[i]) && tsvRows[i].length > 0)
        {
            // we should check if all of the rows are the same size here:
            rows.push(tsvRows[i].split("\t"))
        }
    }
    return rows
}

/**
 * Returns true if a set of rows contain a multiline record (the first column in any row is empty).
 *
 * [["1", "2", "3"], ["a", "b", "c"]] returns false
 * [["1", "2", "3"], ["", "b", "c"]] returns true
 *
 * @param {Array.<Array.<string>>} rows
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
 * @param {Array.<Array.<string>>} rows
 * @return {Array.<Array.<Array.<string>>>}
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
 * @param {Array.<Array.<string>>} rows
 * @return {Array.<Array.<Array.<string>>>}
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
 * @return {Array.<Object>}
 */
function parseHeaderPath(path)
{
    /**
     * Returns the index or 0.
     * @param part
     */
    function parseIndex(part)
    {
        var numsearch = part.match(/\[(\d+)\]/)
        if(numsearch == null || numsearch.length != 2) return 0
        else return parseInt(numsearch[1])
    }

    /**
     * Returns the property without the index.
     * @param part
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
 * @param {Array.<Array.<Object>>} paths
 * @param topindex
 * @param record
 * @param value
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
 * @param paths
 * @param topindex
 * @param record
 * @param value
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