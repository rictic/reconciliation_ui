
/**  An index all entities.  entity === entities[entity['/rec_ui/id']]
 *   @type {Array.<?tEntity>}
*/
var entities;
/** @type {Number}*/
var internalIDCounter;

function resetEntities() {
    entities = [];
    internalIDCounter = 0;
}
resetEntities();

/** @constructor */
function tEntity(initialVals) {
    this["/rec_ui/id"] = internalIDCounter++
    this["/rec_ui/mql_props"] = [];
    this["/rec_ui/headers"] = [];
    this["/rec_ui/cvt_props"] = [];
    entities[this["/rec_ui/id"]] = this;
    for (var key in initialVals)
        this[key] = initialVals[key];
}

tEntity.prototype.getChainedProperty = function(prop) {
    return getChainedProperty(this,prop);
}

tEntity.prototype.freebaseLink = function(linkText) {
    linkText = linkText || this.name || this.id;
    return freebase.link(linkText,this.id);
}

tEntity.prototype.displayValue = function() {
    if (!this.id)
        return displayValue(this['/type/object/name'] || this.id);
    return this.freebaseLink();
};

tEntity.prototype.reconcileWith = function(id, automatic) {
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

tEntity.prototype.addProperty = function(prop, value) {
    if (getType(prop) !== "string")
        return warn("called tEntity.property.addProperty with prop not string");
    if (prop === "id")
        this[prop] = $.makeArray(value)[0];
    else {
        value = Arr.filter($.makeArray(value), function(v) {return v !== undefined;})
        this[prop] = value;
    }
    
    if (prop === "/type/object/type") {
        typesSeen.addAll(this[prop]);
    }
    if (!Arr.contains(this['/rec_ui/headers'], prop))
        this['/rec_ui/headers'].push(prop);
    if (isMqlProp(prop) && !isCVTProperty(prop) && !Arr.contains(this['/rec_ui/mql_props'], prop))
        this['/rec_ui/mql_props'].push(prop);
    if (this.isCVT() && !Arr.contains(this['/rec_ui/cvt_props'], prop))
        this['/rec_ui/cvt_props'].push(prop);
        
}

tEntity.prototype.addParent = function(parent, prop) {
    this['/rec_ui/parent'] = parent;
    if (prop != undefined)
        this.addProperty(prop, parent);
}

tEntity.prototype.isCVT = function() {
    return !!this['/rec_ui/is_cvt'];
}