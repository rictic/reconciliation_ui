
/* A simple database of all entities */
var entities;
var internalIDCounter;
function resetEntities() {
    entities = [];
    internalIDCounter = 0;
}
resetEntities();

function Entity(initialVals) {
    this["/rec_ui/id"] = internalIDCounter++
    entities[this["/rec_ui/id"]] = this;
    for (var key in initialVals)
        this[key] = initialVals[key];
}

Entity.prototype.getChainedProperty = function(prop) {
    return getChainedProperty(this,prop);
}

Entity.prototype.freebaseLink = function(linkText) {
    linkText = linkText || this.name || this.id;
    return freebase.link(linkText,this.id);
}

Entity.prototype.displayValue = function() {
    if (!this.id)
        return displayValue(this['/type/object/name'] || this.id);
    return this.freebaseLink();
};

Entity.prototype.reconcileWith = function(id, automatic) {
    this.id = id;
    var feedback = {
        query:this['/rec_ui/recon_query'],
        reconciledWith:id,
        automatic:automatic,
        softwareTool: "/guid/9202a8c04000641f800000000df257ed"
    }
    $.getJSON("http://data.labs.freebase.com/recon/feedback", {feedback:JSON.stringify(feedback)}, function(){});
    addReviewItem(this);
}

