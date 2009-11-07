var inputProcessingYielder = new Yielder();

function initialInputChanged() {
    cancelInputProcessing();
    resetEntities();
    $("#inputWindow").addClass("disabled");
    $("#inputWindow button").attr("disabled","disabled");
}
function initialInputUpdated() {
    $(".inputLoading").show()
    
    if ($("#initialInput")[0].value === "") {
        $(".inputLoading").hide();
        $("#inputWindow").removeClass("disabled");
        $("#inputWindow button").removeAttr("disabled");
        $("#inputWindow .screen").hide();
    }
    handleInput(function() {
        $(".inputLoading").hide()
        $("#inputWindow").removeClass("disabled");
        $("#inputWindow button").removeAttr("disabled");
    });
}
function inputError(text) {
    addInputWarning(text);
    $(".inputLoading").hide();
    $("#inputWindow").removeClass("disabled");
    $("#inputWindow button").removeAttr("disabled");
    $("#inputWindow .screen").hide();
}
function cancelInputProcessing() {
    $(".inputLoading").hide()
    inputProcessingYielder.cancel();
}

function handleInput(callback) {
    var input = $('#initialInput')[0].value;
    function onProgressMade() {
        $("#inputWindow .screen").hide();
        $(".inputLoading").hide();
        $("#inputWindow").removeClass("disabled");
        $("#inputWindow button").removeAttr("disabled");
    }
    function onAmbiguity(ambiguousRowIdx, handleAmbiguity) {
        onProgressMade();
        showAmbiguousRowPrompt(ambiguousRowIdx, handleAmbiguity);
    }
    function onComplete() {
        onProgressMade();
        showConfirmationSpreadsheet();
    }
    parseInput(input, onAmbiguity, onComplete, inputProcessingYielder);
}


function showAmbiguousRowPrompt(startingRowIdx, handleAmbiguity) {
    var groupedHeaders = groupProperties(headers);
    var context = $("#formatDisambiguation");
    $("table thead",context).replaceWith(buildTableHeaders(groupedHeaders));

    var headerProps = groupedHeaders.getPropsForRows();
    var rowHTML = function(row){
        var html = "<tr>";
        for (var i = 0; i < headerProps.length; i++) {
            html += "<td>" 
            var val = row[headerProps[i]] || "";
            if (typeof val == "string")
                html += val;
            else
                for (var j = 0; j < val.length; j++)
                    if (val[j] != undefined)
                      html += val[j] + "<br>";
            html += "<\/td>";
        }
        return html + "<\/tr>";
    }

    var separateRows = rowHTML(rows[startingRowIdx]);
    var numThings = 1;
    for (var i = startingRowIdx + 1; i < rows.length && rows[i][headerProps[0]][0] == undefined; i++) {
        separateRows += rowHTML(rows[i]);
        numThings++;
    }
    $("table tbody", context).html(separateRows);

    $(".thingName", context).html(textValue(rows[startingRowIdx]));
    var thingType = rows[startingRowIdx]['/type/object/type'];
    if (thingType){
        var thingTypeEl = $(".thingType", context);
        freebase.getName(thingType[0],function(name){
            thingTypeEl.html(name);
        });
    }
    $(".numThings", context).html(numThings);
    
    function ambiguityWrapper(shouldCombine) {
        $("button", context).attr("disabled","disabled");
        handleAmbiguity(shouldCombine);
    }
    $(".doCombine", context).click(function() {ambiguityWrapper(true);});
    $(".dontCombine", context).click(function() {ambiguityWrapper(false);});
    
    $('table tbody tr:odd', context).addClass('odd');
    $('table tbody tr:even', context).addClass('even');
    context.show();
}
function doCombineRows() {
    $("#inputWindow .screen button").attr("disabled","disabled");
    combineRows(function(){
        $("#formatDisambiguation").hide(); 
        $("button").removeAttr("disabled");
        showConfirmationSpreadsheet();
    });
}
function showConfirmationSpreadsheet() {
    var spreadSheetData = {"aoColumns":[], "aaData":[]};
    var columnNames = $.map(headers, getPropName);
    for (var i = 0; i < columnNames.length; i++)
        spreadSheetData.aoColumns.push({"sTitle":columnNames[i]});
    politeEach(rows, function(_,entity) {
        var row = [];
        for (var j = 0; j < headers.length; j++){
            var val = entity[headers[j]];
            if (val == undefined)
                val = "";
            else if ($.isArray(val)){
                var arr = Arr.filter(val, function(elem) {return elem !== undefined;});
                if (arr.length === 0)
                    val = "";
                else if (arr.length === 1)
                    val = "" + textValue(arr[0]);
                else
                    val = textValue(val);
            }

            row[j] = val;
        }
        spreadSheetData.aaData.push(row);
    },
    function() {
        updateUnreconciledCount();
        spreadSheetData["bAutoWidth"] = false;
        spreadSheetData["bSort"] = false;
        $("#spreadsheetDiv").html('<table class="display" id="spreadsheetTable"><\/table>');
        $('#spreadsheetTable').dataTable(spreadSheetData);
        $('#spreadsheetPreview').show();                    
    });

}
var previousSelectedTab = 0;
function initializeTabs() {
    var tabs = $("#tabs > ul");
    tabs.tabs();
    tabs.bind("tabsselect", function(event, ui) {
        switch(previousSelectedTab){
          case 1: onHideRenderScreen(); break;
          case 2: onHideOutputScreen(); break;
        }
        switch(ui.index){
          case 0: manualReconcile(); break;
          case 1: onDisplayRenderScreen(); break;
          case 2: onDisplayOutputScreen(); break;
        }
        previousSelectedTab = ui.index;
    });
    $("#tabs").show();
    tabs.tabs("select", 0);
}
function continueToReconciliation() {
    $("#gettingInput").remove();
    initializeTabs();
    addIdColumns();
    objectifyRows(function() {
        initializeReconciliation(beginAutoReconciliation);
    });
}
var reconciliationBegun = false;
var defaultMDOName = "Spreadsheet Upload about (kind of data)"
$(document).ready(function() {
    jQuery.ajaxSettings.cache = true; //keeps jquery from inserting cache-busting timecodes into json requests

    //handle the options panel
    $("#optionsPanel input").each(function(idx, input) {
      $(input).change(function(){
        eval(input.id + '="' + input.value + '"');
      });
      input.value = eval(input.id);
    });
    $("#progressbar").progressbar({value:0});
    window.onbeforeunload = function() {
        if (reconciliationBegun)
            return "You may have unsaved changes.  Make sure to copy your updated spreadsheet or upload your data to Freebase on the Retrieve Your Data tab.";
    };
    $("#mdo_data_source").suggest({type:"/dataworld/information_source",
                               flyout:true,type_strict:"should"})
                         .bind("fb-select", function(e, data) { 
                               $("#mdo_data_source_id")[0].value = data.id;
                               updateMdoInfo();
                         });
    $("#mdo_name")[0].value = defaultMDOName;
    $("#mdo_name").change(updateMdoInfo);
	$("input:name='option_layout'").change(function(){
        var warning = $("#otg_upload_warning"); 
        if (this.value === "otg") 
            warning.show(); 
        else 
            warning.hide();
    });
	$(".triplesDisplayButton").click(function(){$(".triplesDisplay").slideToggle()})
	if ("LOADER_VERSION" in window) {
	    var version = window['LOADER_VERSION'];
	    $(".versionLink").attr("href","http://github.com/freebase/reconciliation_ui/commit/" + version);
	    var bugReportDetails = "&description=" + escape("Found in version: " + version + "\r\n\r\n");
	    $(".bugReportLink").attr("href", $(".bugReportLink").attr("href") + bugReportDetails);
	    freebase.beacon();
	}

    var capture_tab = function(event) {
        if (event.keyCode == 9) {
            if (event.type === "keydown")
                $("#initialInput").insertAtCaret("\t");
            event.returnValue = false;
            return false;
        }
        return true;
    }
    $("#initialInput").keypress(capture_tab).keydown(capture_tab);

    var inputThrottler = throttler(initialInputChanged, initialInputUpdated);
    var harmlessKeys = new Set(37,38,39,40,91,93,20,35,36,33,34,27,18,17,16,224);
    var inputFilterer = function(event) {
        if (harmlessKeys.contains(event.keyCode))
            return;
        //ctrl-a or cmd-a
        if ((event.metaKey || event.ctrlKey) && event.keyCode === 65)
            return;
        inputThrottler(event);
    }
    
    $("#initialInput").keyup(inputFilterer).keydown(inputFilterer);
	//for IE
	$("#initialInput")[0].onpaste = inputThrottler;
    //for most everyone else's browsers
	$("#initialInput")[0].oninput = inputThrottler;
    if ($("#initialInput")[0].value != "") inputThrottler();
});

function updateUnreconciledCount() {
    var pctProgress = (((totalRecords - automaticQueue.length) / totalRecords) * 100);
    $("#progressbar").progressbar("value", pctProgress);
    $("#progressbar label").html(pctProgress.toFixed(1) + "%");
    $(".manual_count").html("("+numProperties(manualQueue)+")");
}

function updateMdoInfo() {
    var mdo_info = {software_tool:"/guid/9202a8c04000641f800000000df257ed"};
    var name = $("#mdo_name")[0].value;
    if (name != "" && name != defaultMDOName)
       mdo_info.name = name;
    var info_source = $("#mdo_data_source_id")[0].value;
    if (info_source != "")
       mdo_info.info_source = info_source;
    $("#mdo_info")[0].value = JSON.stringify(mdo_info);
}

var freebase_url = "http://www.freebase.com/";
var reconciliation_url = "http://data.labs.freebase.com/recon/";

/* Takes a string and populates the initialInput textarea. */
function handlePOSTdata(data) {
    $('#initialInput')[0].value = data;
    initialInputUpdated();
}

function addInputWarning(text) {
    $(".inputWarnings").show()
    $(".inputWarnings ul").append(node("li", text));
}

function clearInputWarnings() {
    $(".inputWarnings").hide()
    $(".inputWarnings ul").empty();
}