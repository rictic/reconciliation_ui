function onDisplayRenderScreen() {}

function onHideRenderScreen() {}

/** @param {!tEntity|RecGroup} entity
  * @param {string=} reconciliationMethod
  */
function addReviewItem(entity:EntityLike, reconciliationMethod?:string) {
    var container : JQuery;
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
            console.error("unknown reconciliationMethod in addReviewItem: " + reconciliationMethod);
            return;
    }


    var newTemplate = $(".templates .reviewNewTemplate");
    var skippedTemplate = $(".templates .reviewSkippedTemplate");
    var reconciledTemplate = $(".templates .reviewReconciledTemplate");
    var recGroupTemplate = $(".templates .reviewRecGroupTemplate");

    container.show();
    var template : JQuery;
    if (entity instanceof RecGroup)
        template = recGroupTemplate.clone();
    else {
        switch((<tEntity>(entity)).id){
          case "None": template = newTemplate.clone(); break;
          case ""    : template = skippedTemplate.clone(); break;
          default    : template = reconciledTemplate.clone(); break;
        }
    }

    removeReviewItem(entity);
    template.addClass(getReviewClassSelector(entity));


    if (entity instanceof RecGroup) {
        addReviewRecGroup(<RecGroup>(entity), template);
    }
    else {
        addReviewEntity(<tEntity>(entity), template);
    }


    var freebaseName : string = null;
    if (entity['/rec_ui/freebase_name']){
        $.each(entity['/rec_ui/freebase_name'],function(idx,name){
            if (name.toLowerCase() === textValue(entity).toLowerCase())
                freebaseName = name;
        })
        freebaseName = freebaseName || entity['/rec_ui/freebase_name'][0];
    }
    var handleName = function(freebaseName:string) {
        $(".freebaseName", template).html(freebase.link(freebaseName, entity.getID()));
        if (freebaseName && textValue(entity).toLowerCase() === freebaseName.toLowerCase())
            $(".freebaseName", template).addClass("identicalMatch");
    }
    if (freebaseName) handleName(freebaseName);
    else freebase.getName(entity.getID()).then(handleName);

    container.append(template);
}

function removeReviewItem(item:EntityLike) {
    var container = $('#reviewScreen');
    $("." + getReviewClassSelector(item), container).remove();
}

function getReviewClassSelector(item:EntityLike) {
    return "review" + (item instanceof tEntity ? "Entity" : "RecGroup") + item.getInternalID();
}

function makeInternalLink(content:JQuery, entity:tEntity) {
    var link = node("a", {
            "href": "#" + entity['/rec_ui/id']
           ,"class": "internalLink"
    })
    .click(function(val) {
        $("#tabs ul a:first").click();
        displayReconChoices(entity["/rec_ui/id"]);
        return false;
    })
    .append(content.clone());
    content.html(link);
}

function addReviewRecGroup(recGroup:RecGroup, template:JQuery) {
  var repEntity = recGroup.members[0];
  $(".count", template).html(recGroup.members.length + "");
  freebase.getName(recGroup.type).then((type_name) => {
    $(".type", template).html(type_name);
  });
  var name = $(".name", template).html(recGroup.name);
  makeInternalLink(name, repEntity);
}

function addReviewEntity(entity:tEntity, template:JQuery) {
    var name = $(".candidateName", template);
    makeInternalLink(name.html(textValue(entity)), entity);
}

$(function() {
    tEntity.addListener("reconciled", function(entity:tEntity, automatic:boolean) {
        var recGroup = internalReconciler.getRecGroup(entity);
        var thingToReview : EntityLike;
        if (recGroup.shouldMerge) {
            thingToReview = recGroup;
        } else {
            thingToReview = entity;
        }
        addReviewItem(thingToReview, automatic ? "automatic" : "manual");
    });
});
