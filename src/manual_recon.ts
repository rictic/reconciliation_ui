/*
** Manual Reconciliation
*/

function manualReconcile() {
    if ($(".manualReconChoices:visible").length === 0) {
        var val:tEntity = manualQueue.peek();
        while (val && val.getID() !== undefined) {
            manualQueue.shift();
            if (!internalReconciler.getRecGroup(val).shouldMerge)
                addReviewItem(val);
            val = manualQueue.peek();
        }
        if(val != undefined) {
            displayReconChoices(val["/rec_ui/id"])
            renderReconChoices(manualQueue.peek(2)); //render-ahead the next one
        }
        else{
            $(".manualQueueEmpty").show();
            $(".manualReconciliation").hide();
        }
    }
}

function getManualReconId(entity) {
    return "manualReconcile" + entity['/rec_ui/id'];
}

function displayReconChoices(entityID) {
    var entity = entities[entityID];
    if (entity === undefined) return;
    $(".manualQueueEmpty").hide();
    $(".manualReconciliation").show();
    var selector = "#" + getManualReconId(entity);
    //if the screen doesn't exist, render it
    if (! $(selector)[0])
        renderReconChoices(entity);
    //if the screen isn't already in the display area, empty that and put it in
    if (!$(".displayArea " + selector)[0])
        $(".displayArea").empty().append($("#" + getManualReconId(entity)))
}

function renderReconChoices(entity:tEntity) {
    if (entity == undefined) return;
    var template = $("#manualReconcileTemplate").clone();
    template[0].id = getManualReconId(entity);
    var headerPaths = entity["/rec_ui/headerPaths"];
    var mqlPaths = entity["/rec_ui/mql_paths"];
    var uniqueMqlProps = Arr.unique($.map(mqlPaths, function(path){return path.toComplexProp()}));
    var uniqueMqlPaths = $.map(["/type/object/name","/type/object/type"].concat(uniqueMqlProps), function(prop) {return new loader.path(prop)});

    var currentRecord = $(".recordVals",template);
    for(var i = 0; i < uniqueMqlPaths.length; i++) {
        currentRecord.append(node("td", {"class":"propertyGroup"}).append(displayValue(entity.get(uniqueMqlPaths[i]))));
    }
    currentRecord.append(node("td"));

    var tableHeader = $("table thead tr", template);
    var columnHeaders = ["Name","Type"].concat($.map(uniqueMqlProps,getPropName)).concat();
    $.each(columnHeaders, function(_, header) {
        tableHeader.append(node("th",header, {"class": "propHeader"}))
    })
    tableHeader.append(node("th"));


    var tableBody = $(".manualReconciliationChoices", template).empty();
    var reconResultsFetched = entity.reconResults !== undefined;
    entity.reconResults = entity.reconResults || [];
    for (i = 0; i < entity.reconResults.length; i++)
        tableBody.append(renderCandidate(entity.reconResults[i], uniqueMqlProps, entity));

    var numCandidates;
    function updateCandidates() {
        $('tr:odd', tableBody).addClass('odd');
        $('tr:even', tableBody).addClass('even');
        numCandidates = entity.reconResults.length;
    }
    updateCandidates();

    renderInternalReconciliationDialog(entity, template);

    var search = entity['/type/object/name'];
    $.each($.makeArray(entity['/type/object/type']), function(_,type) {
      search += " type:" + type;
    })
    $(".find_topic", template).val(search);
    $(".find_topic", template)
        .suggest({flyout:true,
                  key: api_key})
        .bind("fb-select", function(e, data) {
          entity['/rec_ui/freebase_name'] = $.makeArray(data.name);
          handleReconChoice(entity, data.id);
        });

    $("button.undo", template).click(undoReconciliation);
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
    if (!reconResultsFetched)
        $(".moreButton", template).click();
    template.insertAfter("#manualReconcileTemplate");
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
    $(".internalReconMoved", template).removeClass("invisible");

    context.removeClass("invisible");
}

function renderCandidate(result, mqlProps, entity) {
    var url = freebase_url + "/view/" + result['id'];
    var tableRow = node("tr", {"class":idToClass(result["id"])});

    var button = node("button", "Choose",
       {"class":'manualSelection',
        "name":result.id})
    var score = node("span", Math.round(result["score"] * 100) + "%", {"class": 'score'});
    tableRow.append(node("td",node("div").append(button).append("<br>").append(score), {"class":"buttonColumn"}));
    button.click(function(val) {entity['/rec_ui/freebase_name'] = result.name; handleReconChoice(entity, result.id)})

    node("td",
         node("img",{src: freebase.imageUrl(result['id'], {maxwidth:100,maxheight:100})})
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

    fetchMqlProps(result, mqlProps, entity, tableRow);

    node("td", {"class": "blurb"}).appendTo(tableRow);

    return tableRow;
}

function fetchMqlProps(reconResult, mqlProps, entity, context) {
    var query = {"id":reconResult["id"],
                 "/common/topic/article" : { "id" : null, "optional" : true, "limit" : 1 }};
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
    if (!mqlResult || mqlResult["result"] == null) {
        console.error(mqlResult);
        return;
    }

    var result = mqlResult.result;
    var row = $("tr." + idToClass(result.id),context);

    var article = result['/common/topic/article'];
    if (article && article.id) {
        freebase.getBlurb(article.id, {maxlength: 200, break_paragraphs: true}, function(text) {
            $("td.blurb", row).html(text);
        });
    }

    for (var i = 0; i < mqlProps.length; i++) {
        var cell = $("td." + idToClass(mqlProps[i]), row).empty();
        cell.append(displayValue(getChainedProperty(result, mqlProps[i])));
        cell.removeClass("replaceme");
    }
}
