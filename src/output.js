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
    addTimeout(checkLogin,0);
    addTimeout(displaySpreadsheet,0);
    addTimeout(prepareTriples,0);
}
function onHideOutputScreen() {
    if (spreadsheetRendererYielder)
        spreadsheetRendererYielder.cancel();
    if (tripleGetterYielder)
        tripleGetterYielder.cancel();
    $("#outputSpreadSheet")[0].value = "";
}

/** @param {!Array.<(string|undefined)>} arr
  * @returns {!string}
  */
function encodeLine(arr) {
    var values = [];
    for(var i = 0; i < headerPaths.length; i++){
        var val = arr[i];
        if (typeof val === "undefined")
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

/**
  * @param {!tEntity} row
  * @return {!Array.<!string>}
  */
function encodeRow(row) {
    var lines = [[]];
    $.each(headerPaths, function(i, headerPath) {
        var val = row.get(headerPath, true);
        if ($.isArray(val)) {
            for (var j = 0; j < val.length; j++) {
                if (lines[j] == undefined) lines[j] = [];
                lines[j][i] = textValue(val[j]);
            }
        }
        else
            lines[0][i] = textValue(val);
    });
    return $.map(lines,encodeLine);
}

function displaySpreadsheet() {
    $("#outputSpreadSheet")[0].value = "One moment, rendering...";
    
    renderSpreadsheet(function(spreadsheet) {
        $("#outputSpreadSheet")[0].value = spreadsheet;
    })
}

var spreadsheetRendererYielder;
function renderSpreadsheet(onComplete) {
    var lines = [];
    lines.push(encodeLine($.map(headerPaths, function(headerPath){return headerPath.toString()})));
    spreadsheetRendererYielder = new Yielder();
    politeEach(rows, function(idx, row) {
        lines = lines.concat(encodeRow(row));
    },
    function() {
        onComplete(lines.join("\n"));
    }, spreadsheetRendererYielder);
}


function prepareTriples() {
    $(".renderingTriples").show();
    $(".triplesRendered").hide();
    getTriples(entities, $("#assert_naked_properties")[0].checked, function(triples) {
        politeMap(triples,function(val){return JSON.stringify(val)},
            function(encodedTriples) {
                var tripleString = encodedTriples.join("\n");
                $(".triplesDisplay").html(tripleString);
                $(".triple_count").html(encodedTriples.length);
                $('#payload')[0].value = tripleString;
                $(".renderingTriples").hide();
                $(".triplesRendered").show();
            }
        );
    });
}

var tripleGetterYielder;
function getTriples(entities, assertNakedProperties, callback) {
    tripleGetterYielder = new Yielder();
    function hasValidID(entity) {
        var id = getID(entity);
        if ($.isArray(id))
            id = id[0];
        return id !== undefined && $.trim(id) !== "";
    }
    function getID(entity) {
        return entity.getIdentifier();
    }
    function getValue(property, value) {
        if (getType(value) === "array") {
            if (value.length === 1)
                return getValue(property, value[0]);
            return $.map(value, function(val){return getValue(property, val)});
        }
        if (getType(value) === "object") {
            error("found an object for the value property " + property + "!");
            return undefined;
        }
        var stringValue = value;
        var expectedType = freebase.getPropMetadata(property).expected_type.id;
        if (Arr.contains(["/type/int","/type/float"], expectedType))
            return Number($.trim(stringValue));
        if (expectedType === "/type/boolean"){
            var lowerValue = $.trim(stringValue.toLowerCase());
            if (lowerValue === "true")
                return true;
            if (lowerValue === "false")
                return false;
            return undefined;
        }
        return stringValue;
    }
    function cvtObject(cvt) {
        var result = {};
        var props = cvt['/rec_ui/headers'];
        var empty = true;
        var type = $.makeArray(cvt['/type/object/type'])[0];
        for (var i = 0; i < props.length; i++){
            var predicate = props[i];
            if (predicate.indexOf(type) !== 0){
                if (predicate !== "/type/object/type")
                    warn("bad predicate " + predicate + " in CVT with type" + type);
                continue;
            }
            var value = cvt[predicate];
            var outputPredicate = predicate.replace(type + "/","");
            if (isValueProperty(predicate)) {
                value = getValue(predicate, value);
                if (value){
                    result[outputPredicate] = value
                    empty = false;
                }
            }
            else {
                value = $.makeArray(value);
                value = Arr.filter(value, function(val){return !val['/rec_ui/toplevel_entity']});
                var ids = $.map(value, getID);
                ids = Arr.filter(ids, function(id){return id !== ""});
                if (ids.length === 0)
                    continue;
                if (ids.length === 1)
                    ids = ids[0];
                result[outputPredicate] = ids;
                empty = false;
            }
        }
        if (empty)
            return undefined;
        return result;
    }
    
    var triples = [];
    politeEach(entities, function(_,subject) {
        if (!subject || !hasValidID(subject) || subject.isCVT())
            return;
        
        /* Assert each type and all included types exactly once */
        var types = new Set();
        function addType(type) {
            types.add(type);
            var metadata = freebase.getTypeMetadata(type);
            if (metadata)
                types.addAll(metadata["/freebase/type_hints/included_types"]);
        }
        $.each($.makeArray(subject['/type/object/type']), function(_, type){addType(type)});
        /* Unless given specific OK to assert naked properties, assert
           any types implied by the subject's properties. */
        if (!assertNakedProperties) {
            $.each(subject['/rec_ui/headerPaths'], function(_, headerPath) {
                var prop = headerPath.parts[0].prop;
                var metadata = freebase.getPropMetadata(prop);
                if (metadata && metadata.schema && metadata.schema.id)
                    addType(metadata.schema.id);
            });
        }
        $.each(types.getAll(), function(_,type) {
            if (type)
                triples.push({s:getID(subject), p:"/type/object/type",o:type});
        });
        
        /* If the subject is new to Freebase, give it a name as well */
        if (Arr.contains(["None", "None (merged)"], subject.getID())){
            $.each($.makeArray(subject["/type/object/name"]), function(_, name) {
                if (name)
                    triples.push({s:getID(subject),p:"/type/object/name",o:name});
            });
        }
        
        /* Assert each of the top level mql properties */
        var mqlProps = Arr.unique(Arr.filter($.map(subject['/rec_ui/headers'], function(val){return val.split(":")[0]}), isMqlProp));
        $.each(mqlProps, function(_, predicate) {
            
            $.each($.makeArray(subject[predicate]), function(_, object) {
                if (object === undefined || object === null)
                    return;
                
                if (isValueProperty(predicate)) {
                    triples.push({s:getID(subject), p:predicate, o:getValue(predicate, object)});
                    return;
                }
                
                if (getType(object) !== "object") {
                    error("expected the target of the property " + predicate + " to be an object, but it was a " + getType(object));
                    return;
                }
                
                if (object.isCVT()){
                    if (!(object['/rec_ui/parent']['/rec_ui/id'] === subject['/rec_ui/id']))
                        return; //only create the cvt once, from the 'root' of the parent
                    var cvtTripleObject = cvtObject(object);
                    if (cvtTripleObject)
                        triples.push({s:getID(subject),p:predicate,o:cvtTripleObject}); 
                }
                
                
                if  (!hasValidID(object))
                    return;
                
                
                triples.push({s:getID(subject),p:predicate,o:getID(object)});
            })
        });
    }, function() {callback(triples)}, tripleGetterYielder);
}

function checkLogin() {
    if (!onSameDomain()) {
        $(".uploadForm").show();
        $(".loginUnknown").show();
        return;
    }
    
    $(".uploadSpinner").show();
    $(".uploadLogin").hide();
    $(".uploadForm").hide();
    $.ajax({
        url:"http://data.labs.freebase.com/freeq/spreadsheet/",
        type:"GET",
        complete:function(response){
            $(".uploadSpinner").hide();
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
        }
    });
}

var freeq_url = "http://data.labs.freebase.com/freeq/spreadsheet/";

function fillinIds(createdEntities) {
    for (var key in createdEntities) {
        var id = standardizeId(createdEntities[key]);
        
        var entity_match = key.match(/entity(\d+)/);
        if (entity_match) {
            entities[entity_match[1]].setID(id);
            continue;
        }
        var recGroup_match = key.match(/recGroup(\d+)/);
        if (recGroup_match) {
            RecGroup.groups[recGroup_match[1]].setID(id);
            continue;
        }
    }
}

/** @param {!number} job_id
  * @param {function()=} onComplete
  */
function populateCreatedIds(job_id, onComplete) {
    getCreatedIds(freeq_url + job_id + "?view=list", function(createdEntities) {
        fillinIds(createdEntities);
        if (onComplete) onComplete();
    });
}

function getCreatedIds(url, callback) {
    //this request is idempotent, and sometimes fails, so repeat until it works
    var repeatingTimer = new RepeatingTimer(30 * 1000, fetchIds);
    
    function fetchIds() {
        $.getJSON(url, null, function(result) {
            repeatingTimer.reset();
            //this request should succeed, so retry
            if (!result || !result.status || result.status.code !== 200) {
                addTimeout(function() {
                    getCreatedIds(url, callback);
                }, 2000);
            }
            $(".fetchingFreeqIds").hide();
            $(".idsFetched").show();
            var actions=result.result.actions;
            var keymap = {};
            $.each(actions, function(_,i) {
                var summary = JSON.parse(i.result);
                for (var key in summary) {
                    if (key.match(/(entity\d+)|(recGroup\d+)/)){
                        keymap[key] = summary[key];
                    }
                }
            });
            repeatingTimer.stop();
            callback(keymap);
        });
    }
}


/** @constructor
  * @param {!number} job_id
  * @param {function(!number)=} onComplete
  */
function FreeQMonitor(job_id, onComplete) {
    /** @const */
    this.job_id = job_id;
    /** @const */
    this.url = freeq_url + job_id;
    this.onComplete = onComplete;
    var self = this;
    this.repeatingTimer = new RepeatingTimer(30 * 1000, function() {self.checkProgress();})
    this.checkProgress();
}

FreeQMonitor.prototype.checkProgress = function() {
    var self = this;
    function handler(result){
        self.repeatingTimer.reset();
        var totalActions = result.result.count;
        var actionsRemaining = 0;
        $.each(result.result.details, function(_,i){
            if (Arr.contains([null, "proc", "queued"], i.status))
                actionsRemaining += parseInt(i.count,10);
        });
        $('#upload_progressbar').progressbar('option', 'value', (totalActions-actionsRemaining)*100/totalActions);
        
        if (actionsRemaining === 0) {
            self.repeatingTimer.stop();
            if (self.onComplete) {
                //ensures that onComplete is called at most once
                var onComplete = self.onComplete;
                self.onComplete = undefined;
                onComplete(self.job_id);
            }
        }
        else {
            addTimeout(function() {self.checkProgress()}, 1000);
        }
    }
    $.getJSON(this.url, null, handler);
}

$(document).ready(function () {
    if (onSameDomain()) {
        $('#freeq_form').ajaxForm({
            dataType:'json'
            ,beforeSend: function() {
                $(".uploadToFreeQ").hide();
                $(".uploadForm .error").hide();
                $(".uploadSpinner").show();
            }
            ,error: function(x, msg, error) {
                $(".uploadToFreeQ").show();
                $(".uploadForm .error").show().html(escape(msg));
            }
            ,success: function(result) {
                var job_id=result.result.job_id;
                var peacock_url="http://peacock.freebaseapps.com/stats/data.labs/spreadsheet/"+job_id;
                $(".freeqLoad").show();
                $(".freeqLoadInProgress").show();
                $("#upload_progressbar").progressbar({value:0});
                $(".peacock_link").attr("href",peacock_url);
                
                var url=freeq_url+job_id;
                var freeqMonitor = new FreeQMonitor(job_id, function(job_id) {
                    $(".freeqLoadInProgress").hide();
                    
                    if ($("input.graphport:checked")[0].value === "otg") {
                        populateCreatedIds(job_id, function() {
                            displaySpreadsheet();
                        });
                        $(".uploadToOTGComplete").show();
                    }
                    else {
                        $(".uploadToSandboxComplete").show();
                    }
                });
            }
            ,complete: function() {
                $(".uploadSpinner").hide();
            }
        });
    }
        
        
    $(".displayTriples").click(function(){$(".triplesDisplay").slideToggle(); return false;});
    $(".uploadLogin button.checkLogin").click(checkLogin);
    $(".loadAgainButton").click(function() {
        $(".freeqLoad").hide();
        $(".uploadToSandboxComplete").hide();
        $(".uploadToFreeQ").show();
    });
    
    $("#assert_naked_properties").change(function() { prepareTriples(); });
    $("#mdo_data_source").suggest({type:"/dataworld/information_source",
                               flyout:true,type_strict:"should"})
                         .bind("fb-select", function(e, data) { 
                               $("#mdo_data_source_id")[0].value = data.id;
                               updateMdoInfo();
                         });
    $("#mdo_name")[0].value = defaultMDOName;
    $("#mdo_name").change(updateMdoInfo);
	$("input.graphport").change(function(){
        var warning = $("#otg_upload_warning"); 
        if (this.value === "otg") 
            warning.show(); 
        else 
            warning.hide();
    });
});
