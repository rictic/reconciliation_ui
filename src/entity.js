
/**  An index all entities.  entity === entities[entity['/rec_ui/id']]
 *   @type {Array.<(!tEntity|undefined)>}
*/
var entities;
/** @type {number}*/
var internalIDCounter;

function resetEntities() {
    entities = [];
    internalIDCounter = 0;
}
resetEntities();

/** @constructor
  * @param {Object=} initialVals
  */
function tEntity(initialVals) {
    this["/rec_ui/id"] = internalIDCounter++
    this["/rec_ui/mql_props"] = [];
    this["/rec_ui/headers"] = [];
    entities[this["/rec_ui/id"]] = this;
    for (var key in initialVals)
        this[key] = initialVals[key];
}

tEntity.prototype.setInitialHeaders = function(headers) {
    headers = headers.slice();
    var self = this;
    $.each(headers, function(_,header) {
        self.propSeen(header);
    });
}

/** @param {string} prop */
tEntity.prototype.getChainedProperty = function(prop) {
    return getChainedProperty(this,prop);
}

/** @param {string=} linkText */
tEntity.prototype.freebaseLink = function(linkText) {
    linkText = linkText || this.name || this.id;
    return freebase.link(linkText,this.id);
}

tEntity.prototype.displayValue = function() {
    if (!this.id)
        return displayValue(this['/type/object/name'] || this.id);
    return this.freebaseLink();
};

/** @param {!string} id
  * @param {!boolean} automatic
  */
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

/** @param {!string} prop
  * @param {*} value
  */
tEntity.prototype.addProperty = function(prop, value) {
    if (getType(prop) !== "string"){
        warn("called tEntity.property.addProperty with prop of type `" + getType(prop) + "`, expected string.  The value was: " + JSON.stringify(JsObjDump.annotate(value)));
        return;
    }

    if (prop === "id")
        this[prop] = $.makeArray(value)[0];
    else {
        value = Arr.filter($.makeArray(value), function(v) {return v !== undefined;})
        this[prop] = value;
    }

    if (prop === "/type/object/type")
        typesSeen.addAll(this[prop]);
    this.propSeen(prop);
}

/** Keep up with needed metadata about a given property
  * @param {string} prop
  */
tEntity.prototype.propSeen = function(prop) {
    if (!Arr.contains(this['/rec_ui/headers'], prop))
        this['/rec_ui/headers'].push(prop);
    if (isMqlProp(prop) && !isCVTProperty(prop) && !Arr.contains(this['/rec_ui/mql_props'], prop))
        this['/rec_ui/mql_props'].push(prop);
}

/** @param {tEntity} parent
  * @param {string=} prop
  */
tEntity.prototype.addParent = function(parent, prop) {
    this['/rec_ui/parent'] = $.makeArray(parent)[0];
    if (prop != undefined)
        this.addProperty(prop, parent);
}

/** @return {boolean} */
tEntity.prototype.isCVT = function() {
    //an entity is a CVT if any of its types are CVT types
    return Arr.any($.makeArray(this['/type/object/type']), isCVTType);
}

tEntity.prototype.toString = function() {
    return textValue(this);
}

tEntity.prototype.toJSON = function() {
    var js = {};
    for (var key in this) {
        if (startsWith("/rec_ui/",key) || key === "reconResults")
            continue;
        var value = this[key];
        
        //remove cyclic links
        var parent = this['/rec_ui/parent'];
        if (parent && Arr.filter(value, function(e) {return e !== parent;}).length === 0)
            continue;
        
        value = toJSON(value);
        if (value !== undefined)
            js[key] = value; 
    }
    return js;
}