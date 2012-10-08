var inputProcessingYielder = new Yielder;

function initialInputChanged() {
    cancelInputProcessing();
    resetEntities();
    $("#inputWindow").addClass("disabled");
    $("#inputWindow button").attr("disabled","disabled");
}
function initialInputUpdated() {
    $(".inputLoading").show()

    if ($("#initialInput").val() === "") {
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
    inputProcessingYielder = new Yielder();
    var input = $('#initialInput').val();
    function onProgressMade() {
        $(".inputLoading").hide();
        $("#inputWindow .screen").hide();
        $("#inputWindow").removeClass("disabled");
        $("#inputWindow button").removeAttr("disabled");
    }
    function onAmbiguity(ambiguousRecord, onAmbiguityResolved) {
        onProgressMade();
        showAmbiguousRowPrompt(ambiguousRecord, onAmbiguityResolved);
    }
    function onComplete() {
        showConfirmationSpreadsheet(onProgressMade);
    }
    parseInput(input, onAmbiguity, onComplete, inputProcessingYielder);
}


function showAmbiguousRowPrompt(ambiguousRecord, onAmbiguityResolved) {
    //an ugly hack, should rework groupProperties and friends to understand headerPaths
    var headers = $.map(headerPaths, function(headerPath) {return headerPath.toComplexProp()});
    var groupedHeaders = groupProperties(headers);
    var context = $("#formatDisambiguation");
    $("table thead",context).replaceWith(buildTableHeaders(groupedHeaders));

    var headerProps = groupedHeaders.getPropsForRows();
    var rowHTML = function(row){
        var html = "<tr>";
        for (var i = 0; i < headerProps.length; i++) {
            html += "<td>"
            var val = row[$.inArray(headerProps[i],headers)] || "";
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

    var separateRows = $.map(ambiguousRecord, rowHTML).join("");
    var numThings = ambiguousRecord.length;

    $("table tbody", context).html(separateRows);

    var tree = mapTreeToEntity(recordToTree(ambiguousRecord));
    $(".thingName", context).html(textValue(tree));
    var thingType = tree['/type/object/type'];
    if (thingType){
        var thingTypeEl = $(".thingType", context);
        freebase.getName(thingType[0],function(name){
            thingTypeEl.html(name);
        });
    }
    $(".numThings", context).html(numThings);

    function ambiguityWrapper(shouldCombine) {
        $("button", context).attr("disabled","disabled");
        onAmbiguityResolved(shouldCombine);
    }
    $(".doCombine", context).unbind("click").click(function() {ambiguityWrapper(true);});
    $(".dontCombine", context).unbind("click").click(function() {ambiguityWrapper(false);});

    $('table tbody tr:odd', context).addClass('odd');
    $('table tbody tr:even', context).addClass('even');
    context.show();
}
function showConfirmationSpreadsheet(beforeDisplay) {
    var spreadSheetData = {"aoColumns":[], "aaData":[]};
    var columnNames = $.map(headerPaths, function(header) {return header.getDisplayName();});
    for (var i = 0; i < columnNames.length; i++)
        spreadSheetData.aoColumns.push({"sTitle":columnNames[i]});
    politeEach(rows, function(_,entity) {
        var row = [];
        for (var j = 0; j < headerPaths.length; j++){
            var val = entity.get(headerPaths[j]);
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
    }, function() {
        if (beforeDisplay) beforeDisplay();
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
    initializeReconciliation(beginAutoReconciliation);
}
var reconciliationBegun = false;
var defaultMDOName = "Spreadsheet Upload about (kind of data)"

var onReady = combineCallbacks(2, initialSetup);

function OnGoogleClientLoaded() {
  gapi.client.setApiKey(api_key);
  gapi.client.load('freebase', 'v1dev', onReady);
}

$(document).ready(onReady)

function initialSetup() {
    jQuery.ajaxSettings.cache = true; //keeps jquery from inserting cache-busting timecodes into json requests

    $("#progressbar").progressbar({value:0});
    window.onbeforeunload = function() {
        if (reconciliationBegun)
            return "You may have unsaved changes.  Make sure to copy your updated spreadsheet or upload your data to Freebase on the Retrieve Your Data tab.";
    };

    if ("LOADER_VERSION" in window) {
        var version = window['LOADER_VERSION'];
        $(".versionLink").attr("href","http://github.com/freebase/reconciliation_ui/commit/" + version);
        var bugReportDetails = "&description=" + escape("Found in version: " + version + "\r\n\r\n");
        $(".bugReportLink").attr("href", $(".bugReportLink").attr("href") + bugReportDetails);
        freebase.beacon("ready");
    }

    var capture_tab = function(event) {
        if (event.keyCode == 9) {
            if (event.type === "keydown")
                insertInto("\t", $("#initialInput"));
            event.returnValue = false;
            return false;
        }
        return true;
    }
    $("#initialInput").keypress(capture_tab).keydown(capture_tab);

    var inputThrottler = throttler(initialInputChanged, initialInputUpdated);
    var harmlessKeys = new Set('37','38','39','40','91','93','20','35','36',
                               '33','34','27','18','17','16','224');
    var inputFilterer = function(event) {
        if (harmlessKeys.contains(event.keyCode))
            return;
        //ctrl-a or cmd-a
        if ((event.metaKey || event.ctrlKey) && event.keyCode === 65)
            return;
        inputThrottler();
    }

    $("#initialInput").keyup(inputFilterer).keydown(inputFilterer);
    $("#initialInput").bind("paste", null, inputThrottler);
    //for IE
    $("#initialInput")[0].onpaste = inputThrottler;
    //for most everyone else's browsers
    $("#initialInput")[0].oninput = inputThrottler;
    if ($("#initialInput").val() != "") inputThrottler();

    $("#spreadsheetPreview button.continue").click(continueToReconciliation);

    //send feedback to the recon server when a reconciliation takes place
    tEntity.addListener("reconciled", function(entity, automatic) {
        var feedback = {
            query:entity['/rec_ui/recon_query'],
            reconciledWith:entity.id,
            automatic:automatic,
            softwareTool: "/guid/9202a8c04000641f800000000df257ed"
        }
        $.getJSON(reconciliation_url + "feedback", {feedback:JSON.stringify(feedback)}, function(){});
    });
};

function updateMdoInfo() {
    var mdo_info = {
      software_tool:"/guid/9202a8c04000641f800000000df257ed",
      name: undefined,
      info_source: undefined
    };
    var name = $("#mdo_name").val()
    if (name != "" && name != defaultMDOName)
       mdo_info.name = name;
    var info_source = $("#mdo_data_source_id").val();
    if (info_source != "")
       mdo_info.info_source = info_source;
    $("#mdo_info").val(JSON.stringify(mdo_info));
}

var freebase_url = "https://www.freebase.com/";
var fbapi_url = "https://www.googleapis.com/freebase/v1/";
var reconciliation_url = "https://www.googleapis.com/freebase/v1dev/reconcile?"
var freeq_url = "http://data.labs.freebase.com/freeq/spreadsheet/";

/* Takes a string and populates the initialInput textarea. */
function handlePOSTdata(data) {
    $('#initialInput').val(data);
    initialInputUpdated();
}

var inputWarnings = {};
function addInputWarning(text) {
    if (numProperties(inputWarnings) >= 4)
        displayInputWarning("Additional warnings hidden");
    else
        displayInputWarning(text);

    function displayInputWarning(text) {
        if (text in inputWarnings)
            return;
        else
            inputWarnings[text] = true;

        $(".inputWarnings").show()
        $(".inputWarnings ul").append(node("li", text));
    }
}

function clearInputWarnings() {
    inputWarnings = {};
    $(".inputWarnings").hide()
    $(".inputWarnings ul").empty();
}
