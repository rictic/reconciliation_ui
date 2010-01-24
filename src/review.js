function onDisplayRenderScreen() {}

function onHideRenderScreen() {}

/** @param {!tEntity|RecGroup} entity */
function addReviewItem(entity) {
    var container = $('.reconciliationsToReview');
    var newTemplate = $(".templates .reviewNewTemplate");
    var skippedTemplate = $(".templates .reviewSkippedTemplate");
    var reconciledTemplate = $(".templates .reviewReconciledTemplate");
    if (entity instanceof RecGroup) {
        addReviewRecGroup(entity);
        return;
    }
    
    if (!entity) return;
    if (entity.isCVT() || null == entity.id || $.isArray(entity.id))
        return;
    
    var template;
    switch(entity.id){
      case "None": template = newTemplate.clone(); break;
      case ""    : template = skippedTemplate.clone(); break;
      default    : template = reconciledTemplate.clone(); break;
    }
    
    var classSelector = "reviewEntity" + entity['/rec_ui/id'];
    template.addClass(classSelector);
    $("." + classSelector, container).remove();
    
    $(".candidateName",template).html("<a class='internalLink' href='#" + entity['/rec_ui/id'] + "'>" + textValue(entity) + "</a>");
    var freebaseName = null;
    if (entity['/rec_ui/freebase_name']){
        $.each(entity['/rec_ui/freebase_name'],function(idx,name){
            if (name.toLowerCase() === textValue(entity).toLowerCase())
                freebaseName = name;
        })
        freebaseName = freebaseName || entity['/rec_ui/freebase_name'][0];
    }
    var handleName = function(freebaseName) {
        $(".freebaseName", template).html(entity.freebaseLink(freebaseName));
        if (freebaseName && textValue(entity).toLowerCase() === freebaseName.toLowerCase())
            $(".freebaseName", template).addClass("identicalMatch");
    }
    if (freebaseName) handleName(freebaseName);
    else freebase.getName(entity.id, handleName);
        
    $(".internalLink", template).click(function(val) {
        $("#tabs > ul").tabs("select",0);
        displayReconChoices(entity["/rec_ui/id"]);
        return false;})
    container.append(template);
}

function addReviewRecGroup(recGroup) {
//     TODO: display rec groups
//     - in place of showing the individual item that was reconciled, show that the $n items in the IR Group have been reconciled to $topic. 
//     - allow the IR Group to be reconciled to a different topic 
//     - allow the IR Group to be unmarked as merged and no longer treated as the same topic, but as many
}