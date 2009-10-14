
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
    this["/rec_ui/mql_props"] = [];
    this["/rec_ui/headers"] = [];
    this["/rec_ui/cvt_props"] = [];
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

Entity.prototype.addProperty = function(prop, value) {
    if (value !== undefined)
        this[prop] = value;

    if (!Arr.contains(this['/rec_ui/headers'], prop))
        this['/rec_ui/headers'].push(prop);
    if (isMqlProp(prop) && !isCVTProperty(prop) && !Arr.contains(this['/rec_ui/mql_props'], prop))
        this['/rec_ui/mql_props'].push(prop);
    if (this.isCVT() && !Arr.contains(this['/rec_ui/cvt_props'], prop))
        this['/rec_ui/cvt_props'].push(prop);
        
}

Entity.prototype.addParent = function(parent, prop) {
    this['/rec_ui/parent'] = parent;
    if (prop != undefined)
        this.addProperty(prop, parent);
}

Entity.prototype.isCVT = function() {
    return !!this['/rec_ui/is_cvt'];
}