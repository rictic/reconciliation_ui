function onDisplayRenderScreen() {}

function onHideRenderScreen() {}

function addReviewItem(entity, reconciliationMethod) {
    var container;
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
    if (!entity) return;
    if (entity.isCVT() || null == entity.id || $.isArray(entity.id))
        return;
    
    container.show();
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