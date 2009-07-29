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
**  Rendering the spreadsheet back to the user
*/

function onDisplayOutputScreen() {
    setTimeout(renderSpreadsheet,0);
    setTimeout(prepareTriples,0);
    checkLogin();
}
function onHideOutputScreen() {
    if (spreadsheetRendererYielder)
        spreadsheetRendererYielder.cancel();
    if (tripleGetterYielder)
        tripleGetterYielder.cancel();
    $("#outputSpreadSheet")[0].value = "";
}

function encodeLine(arr) {
    var values = [];
    for(var i = 0; i < headers.length; i++){
        var val = arr[i];
        if (typeof val == "undefined")
            values.push("");
        else if (!val.match(/(\t|\"|\n)/))
            values.push(arr[i])
        else {
            val = val.replace(/"/g, '""');
            values.push('"' + val + '"');
        }
    }
    return values.join("\t");
}

//Like getChainedProperty, only it preserves array placement
function getChainedPropertyPreservingPlace(entity, prop) {
    var slots = [entity];
    $.each(prop.split(":"), function(_,part) {
        var newSlots = [];
        $.each(slots, function(_,slot) {
            if (!slot || !slot[part])
                newSlots.push(undefined);
            else
                newSlots = newSlots.concat($.makeArray(slot && slot[part]))
        })
        slots = newSlots;
    });
    if (slots === []) return undefined;
    return slots;
}


function encodeRow(row) {
    var lines = [[]];
    for (var i = 0; i < headers.length; i++){
        var val = getChainedPropertyPreservingPlace(row, headers[i]);
        if ($.isArray(val)) {
            for (var j = 0; j < val.length; j++) {
                if (lines[j] == undefined) lines[j] = [];
                lines[j][i] = textValue(val[j]);
            }
        }
        else
            lines[0][i] = textValue(val);
    }
    return $.map(lines,encodeLine);
}

var spreadsheetRendererYielder;
function renderSpreadsheet() {
    spreadsheetRendererYielder = new Yielder();
    var lines = [];
    lines.push(encodeLine(headers));
    $("#outputSpreadSheet")[0].value = "One moment, rendering...";
    
    politeEach(rows, function(idx, row) {
        lines = lines.concat(encodeRow(row));
    },
    function() {
        $("#outputSpreadSheet")[0].value = lines.join("\n");
    }, spreadsheetRendererYielder);
}

function prepareTriples() {
    getTriples(rows, function(triples) {
        politeMap(triples,function(_,val){return JSON.stringify(val)},
            function(encodedTriples) {
                var tripleString = encodedTriples.join("\n");
                $(".triplesDisplay").html(tripleString);
                $(".triple_count").html(encodedTriples.length);
                $('#payload')[0].value = tripleString;
            }
        );
    });
}

var tripleGetterYielder;
function getTriples(rows, callback) {
    tripleGetterYielder = new Yielder();
    var triples = [];
    function isValidID(id) {
        if ($.isArray(id))
            id = id[0];
        return id !== undefined && $.trim(id) !== "";
    }
    function getID(entity) {
        if (entity.id === "None")
            return "$entity" + entity['/rec_ui/id'];
        return entity.id;
    }
    function cvtObject(cvt) {
        var result = {};
        var props = cvt['/rec_ui/cvt_props'];
        var empty = true;
        for (var i = 0; i < props.length; i++){
            var id = getID(cvt[props[i]]);
            if (id){
                result[props[i]] = id;
                empty = false;
            }
        }
        if (empty)
            return undefined;
        return result;
    }
    politeEach(entities, function(_,subject) {
        if (!subject || !isValidID(subject.id) || subject['/rec_ui/is_cvt'])
            return;
        $.each($.makeArray(subject['/type/object/type']), function(_, type){
            triples.push({s:getID(subject), p:"/type/object/type",o:type});
        });
        if (subject.id === "None"){
            $.each($.makeArray(subject["/type/object/name"]), function(_, name) {
                if (name)
                    triples.push({s:getID(subject),p:"/type/object/name",o:name});
            });
        }
        
        var mqlProps = unique($.map(subject['/rec_ui/mql_props'], function(val){return val.split(":")[0]}));
        $.each(mqlProps, function(_, predicate) {
            
            $.each($.makeArray(subject[predicate]), function(_, object) {
                if (isValueProperty(predicate)) {
                    triples.push({s:getID(subject), p:predicate, o:object});
                    return;
                }
                
                if (object['/rec_ui/is_cvt']){
                    if (!object['/rec_ui/parent'] === subject)
                        return; //only create cvt once, from the 'root' of the parent
                    var cvtTripleObject = cvtObject(object);
                    if (cvtTripleObject)
                        triples.push({s:getID(subject),p:predicate,o:cvtTripleObject}); 
                }
                
                if  (!isValidID(object.id))
                    return;
                
                triples.push({s:getID(subject),p:predicate,o:getID(object)});
            })
        });
    }, function() {callback(triples)}, tripleGetterYielder);
}

function checkLogin() {
    $(".uploadLogin").hide();
    $(".uploadForm").hide();
    var response = $.get("http://data.labs.freebase.com/freeq/spreadsheet/");
    $.ajax({
        url:"http://data.labs.freebase.com/freeq/spreadsheet/",
        type:"GET",
        complete:function(response){
            if (!response || !response.status){
                error(response);
                return;
            }
            if (response.status === 200){
                $(".uploadLogin").hide();
                $(".uploadForm").show();
            }
            else if (response.status === 401){
                $(".uploadLogin").show();
                $(".uploadForm").hide();
            }
            else
                error(response);
        }})
}
