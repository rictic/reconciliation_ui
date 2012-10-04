function onDisplayRenderScreen() {}

function onHideRenderScreen() {}

/** @param {!tEntity|RecGroup} entity
  * @param {string=} reconciliationMethod
  */
function addReviewItem(entity, reconciliationMethod?) {
    var container;
    if (!reconciliationMethod) {
        var was_auto = entity['/rec_ui/was_automatically_reconciled'];
        if (was_auto === undefined) reconciliationMethod = "previously";
        else if (was_auto === false) reconciliationMethod = "manual";
        else reconciliationMethod = "automatic";
    }
    switch (reconciliationMethod) {
        case "automatic":
            container = $(".automaticReconciliationsToReview");
            break;
        case "manual":
            container = $(".manualReconciliationsToReview");
            break;
        case "previously":
            container = $(".oldReconciliationsToReview");
            break;
        default:
            error("unknown reconciliationMethod in addReviewItem: " + reconciliationMethod);
            return;
    }


    var newTemplate = $(".templates .reviewNewTemplate");
    var skippedTemplate = $(".templates .reviewSkippedTemplate");
    var reconciledTemplate = $(".templates .reviewReconciledTemplate");
    var recGroupTemplate = $(".templates .reviewRecGroupTemplate");

    container.show();
    var template;
    if (entity instanceof RecGroup)
        template = recGroupTemplate.clone();
    else {
        switch(entity.id){
          case "None": template = newTemplate.clone(); break;
          case ""    : template = skippedTemplate.clone(); break;
          default    : template = reconciledTemplate.clone(); break;
        }
    }

    removeReviewItem(entity);
    template.addClass(getReviewClassSelector(entity));


    if (entity instanceof RecGroup)
        addReviewRecGroup(entity, template);
    else
        addReviewEntity(entity, template);


    var freebaseName = null;
    if (entity['/rec_ui/freebase_name']){
        $.each(entity['/rec_ui/freebase_name'],function(idx,name){
            if (name.toLowerCase() === textValue(entity).toLowerCase())
                freebaseName = name;
        })
        freebaseName = freebaseName || entity['/rec_ui/freebase_name'][0];
    }
    var handleName = function(freebaseName) {
        $(".freebaseName", template).html(freebase.link(freebaseName, entity.getID()));
        if (freebaseName && textValue(entity).toLowerCase() === freebaseName.toLowerCase())
            $(".freebaseName", template).addClass("identicalMatch");
    }
    if (freebaseName) handleName(freebaseName);
    else freebase.getName(entity.getID(), handleName);

    container.append(template);
}

function removeReviewItem(item) {
    var container = $('#reviewScreen');
    $("." + getReviewClassSelector(item), container).remove();
}

function getReviewClassSelector(item) {
    return "review" + (item instanceof tEntity ? "Entity" : "RecGroup") + item.getInternalID();
}

function makeInternalLink(content, entity) {
    var link = node("a", {
            "href": "#" + entity['/rec_ui/id']
           ,"class": "internalLink"
    })
    .click(function(val) {
        $("#tabs > ul").tabs("select",0);
        displayReconChoices(entity["/rec_ui/id"]);
        return false;
    })
    .append(content.clone());
    content.html(link);
}

function addReviewRecGroup(recGroup, template) {
    var repEntity = recGroup.members[0];
    $(".count", template).html(recGroup.members.length + "");
    freebase.getName(recGroup.type, function(type_name) {
        $(".type", template).html(type_name);
    });
    var name = $(".name", template).html(recGroup.name);
    makeInternalLink(name, repEntity);
}

function addReviewEntity(entity, template) {
    var name = $(".candidateName", template);
    makeInternalLink(name.html(textValue(entity)), entity);
}

$(function() {
    tEntity.addListener("reconciled", function(entity, automatic) {
        var recGroup = internalReconciler.getRecGroup(entity);
        addReviewItem(recGroup.shouldMerge ? recGroup : entity, automatic ? "automatic" : "manual");
    });
});
