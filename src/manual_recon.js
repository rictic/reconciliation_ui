/*
** Manual Reconciliation
*/

function addToManualQueue(entity) {
    if (manualQueue[entity['/rec_ui/id']])
        return;
    var wasEmpty = isObjectEmpty(manualQueue);
    var wasSingleton = getSecondValue(manualQueue) === undefined;
    manualQueue[entity["/rec_ui/id"]] = entity;
    if (wasEmpty)
        manualReconcile();
    else if (wasSingleton)
        renderReconChoices(entity)
    updateUnreconciledCount();
}

function manualReconcile() {
    if ($(".manualReconChoices:visible").length === 0) {
        var val = getFirstValue(manualQueue);
        while (val && val.getID() !== undefined) {
            delete manualQueue[val['/rec_ui/id']];
            if (!internalReconciler.getRecGroup(val).shouldMerge)
                addReviewItem(val);
            val = getFirstValue(manualQueue);
        }
        updateUnreconciledCount();
        if(val != undefined) {
            displayReconChoices(val["/rec_ui/id"])
            renderReconChoices(getSecondValue(manualQueue)); //render-ahead the next one
        }
        else{
            $(".manualQueueEmpty").show();
            $(".manualReconciliation").hide();
        }
    }
}

function displayReconChoices(entityID) {
    var entity = entities[entityID];
    if (entity === undefined) return;
    $(".manualQueueEmpty").hide();
    $(".manualReconciliation").show();
    if (! $("#manualReconcile" + entityID)[0])
        renderReconChoices(entity);
    $(".manualReconChoices:visible").remove();
    $("#manualReconcile" + entityID).show();
}

function renderReconChoices(entity) {
    if (entity == undefined) return;
    var template = $("#manualReconcileTemplate").clone();
    template[0].id = "manualReconcile" + entity['/rec_ui/id'];
    var headerPaths = entity["/rec_ui/headerPaths"];
    var mqlPaths = entity["/rec_ui/mql_paths"];
    var uniqueMqlProps = Arr.unique($.map(mqlPaths, function(path){return path.toComplexProp()}));
    
    var currentRecord = $(".recordVals",template);
    for(var i = 0; i < headerPaths.length; i++) {
        currentRecord.append(node("label", headerPaths[i].getDisplayName() + ":"));
        currentRecord.append(node("div", {"class":"propertyGroup"}).append(displayValue(entity.get(headerPaths[i]))));
    }
    
    var tableHeader = $(".reconciliationCandidates table thead", template).empty();
    var columnHeaders = ["","Image","Name","Type"].concat($.map(uniqueMqlProps,getPropName)).concat(["Score"]);
    for (var i = 0; i < columnHeaders.length; i++)
        tableHeader.append(node("th",columnHeaders[i],{"class":"bottomHeader"}));


    var tableBody = $(".reconciliationCandidates table tbody", template).empty();
    for (var i = 0; i < entity.reconResults.length; i++)
        tableBody.append(renderCandidate(entity.reconResults[i], uniqueMqlProps, entity));

    var numCandidates;
    function updateCandidates() {
        $('.reconciliationCandidates table tbody tr:odd', template).addClass('odd');
        $('.reconciliationCandidates table tbody tr:even', template).addClass('even');
        numCandidates = entity.reconResults.length;
    }
    updateCandidates();

    renderInternalReconciliationDialog(entity, template);

    $(".find_topic", template)[0].value = entity['/type/object/name'];
    $(".find_topic", template)
        .suggest({type:entity['/type/object/type'],
                  type_strict:"should",
                  flyout:true})
        .bind("fb-select", function(e, data) { 
          entity['/rec_ui/freebase_name'] = $.makeArray(data.name);
          handleReconChoice(entity, data.id);
        });

    $(".otherSelection", template).click(function() {handleReconChoice(entity, this.name)});
    
    $(".moreButton",template).click(function() {
        $(".loadingMoreCandidates", template).fadeIn();
        getCandidates(entity, function() {
            $(".loadingMoreCandidates", template).hide();
            if (entity.reconResults.length <= numCandidates)
                return $(".moreButton",template).fadeOut();
            for (var i = numCandidates; i < entity.reconResults.length; i++)
                var candidate = renderCandidate(entity.reconResults[i], uniqueMqlProps, entity).appendTo(tableBody);
            updateCandidates();
        }, function(){;});
    });
    template.insertAfter("#manualReconcileTemplate")
}

function renderInternalReconciliationDialog(entity, template) {
    var recGroup = internalReconciler.getRecGroup(entity);
    //don't prompt if there isn't a RecGroup to speak of
    if (!recGroup || recGroup.members.length <= 1)
        return;
    
    var context = $(".internalReconciliationPrompt", template);
    $(".count", context).html(recGroup.members.length + "");
    freebase.getName(recGroup.type, function(type_name) {
        $(".type", context).html(type_name);
    });
    $(".name", context).html(recGroup.name);
    
    //set up the mapping between the lable and the check box, so that you can click
    //on the label and check/uncheck the box
    var input_id = "treat_same" + entity['/rec_ui/id'];
    $("label.treat_the_same", context).attr("for", input_id);
    var checkbox = $("input.treat_the_same", context);
    checkbox.attr("checked", recGroup.shouldMerge)
    checkbox.change(function() {
        internalReconciler.setMerged(entity, this.checked);
    });
    checkbox[0].id = input_id;
    
    context.removeClass("invisible");
}

function renderCandidate(result, mqlProps, entity) {
    var url = freebase_url + "/view/" + result['id'];
    var tableRow = node("tr", {"class":idToClass(result["id"])});
    
    var button = node("button", "Select", 
       {"class":'manualSelection', 
        "name":result.id})
    tableRow.append(node("td",button));
    button.click(function(val) {entity['/rec_ui/freebase_name'] = result.name; handleReconChoice(entity, result.id)})
    
    node("td",
         node("img",{src:freebase_url + "/api/trans/image_thumb/"+result['id']+"?maxwidth=100&maxheight=100"})
    ).appendTo(tableRow);
    
    tableRow.append(node("td",displayValue(result)));
    var displayTypes = [];
    $.each($.makeArray(result.type), function(_,typeId) {
        //types that end in /topic are uninteresting
        if (typeId.match(/\/topic$/)) return;
        displayTypes.push(freebase.makeLink(typeId));
    })
    node("td").append(wrapForOverflow(displayTypes)).appendTo(tableRow);

    mqlProps = groupProperties(mqlProps).getPropsForRows();
    for(var j = 0; j < mqlProps.length; j++)
        tableRow.append(
            node("td", node("img",{src:"resources/spinner.gif"}),
                 {"class":"replaceme "+idToClass(mqlProps[j])})
        );
    tableRow.append(node("td",result["score"]));
    fetchMqlProps(result, mqlProps, entity, tableRow);
    
    return tableRow;
}

function fetchMqlProps(reconResult, mqlProps, entity, context) {
    var query = {"id":reconResult["id"]};
    $.each(mqlProps, function(_, prop) {
        var slot = query;
        var parts = prop.split(":");
        $.each(parts.slice(0,parts.length-1), function(_, part) {
            slot[part] = slot[part] || [{optional:true}];
            slot = slot[part][0];
        });
        var lastPart = parts[parts.length-1];
        if (isValueProperty(lastPart))
            slot[lastPart] = [];
        else {
            slot[lastPart] = slot[lastPart] || [{}];
            var queryObj = slot[lastPart][0];
            queryObj['name'] = null;
            queryObj['id'] = null;
            queryObj['optional'] = true;
        }
            
    })
    var envelope = {query:query};
    function handler(results) {
        fillInMQLProps(entity, mqlProps, results);
        //don't show annoying loading symbols indefinitely if there's an error
        $("#manualReconcile" + entity["/rec_ui/id"] + " .replaceme").empty();
    }
    freebase.mqlRead(envelope,handler);
}

function fillInMQLProps(entity, mqlProps, mqlResult) {
    var context = $("#manualReconcile" + entity["/rec_ui/id"]);
    if (!mqlResult || mqlResult["code"] != "/api/status/ok" || mqlResult["result"] == null) {
        error(mqlResult);
        return;
    }

    var result = mqlResult.result;
    var row = $("tr." + idToClass(result.id),context);
    
    
    for (var i = 0; i < mqlProps.length; i++) {
        var cell = $("td." + idToClass(mqlProps[i]), row).empty();
        cell.append(displayValue(getChainedProperty(result, mqlProps[i])));
        cell.removeClass("replaceme");
    }
}