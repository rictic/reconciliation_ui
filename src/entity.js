
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
    this["/rec_ui/mql_paths"] = []
    this["/rec_ui/headers"] = [];
    this["/rec_ui/headerPaths"] = [];
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

/** @param {string} prop
  * @return {Array}
  */
tEntity.prototype.getChainedProperty = function(prop) {
    return getChainedProperty(this,prop);
}

/** @param {loader.path|string} path
  * @param {boolean=} preservePlace
  * @return {Array}
  */
tEntity.prototype.get = function(path, preservePlace) {
    if (getType(path) === "string") 
        return this.get(new loader.path(/**@type string*/(path)), preservePlace);
    var slots = [this];
    $.each(path.parts, function(_,part) {
        var newSlots = [];
        $.each(slots, function(_,slot) {
            if (!slot) {
                newSlots.push(undefined);
                return;
            }
            
            var prop = part.prop;
            if (prop === "id" && ('getIdentifier' in slot)) {
                newSlots.push(slot.getID());
                return;
            }
            
            var vals = slot[part.prop];
            if (vals === undefined) {
                newSlots.push(undefined);
                return;
            }
            
            vals = $.makeArray(vals);
            if (part.index !== undefined)
                newSlots = newSlots.concat($.makeArray(vals[part.index]));
            else
                newSlots = newSlots.concat(vals);
        })
        slots = newSlots;
    });
    if (!preservePlace) {
        return Arr.filter(slots, function(v) {
            return v !== undefined;
        });
    }
    return slots;
}

/** @param {string=} linkText */
tEntity.prototype.freebaseLink = function(linkText) {
    linkText = linkText || this.name || this.getID();
    return freebase.link(linkText,this.getID());
}

tEntity.prototype.displayValue = function() {
    if (!this.id)
        return displayValue(this['/type/object/name'] || this.getID());
    return this.freebaseLink();
};

/** @param {!string} id
  * @param {!boolean} automatic
  */
tEntity.prototype.reconcileWith = function(id, automatic) {
    var recGroup = internalReconciler.getRecGroup(this);
    var self = this;
    freebase.getCanonicalID(id, function(new_id) {
        if (recGroup.shouldMerge) 
            recGroup.setID(new_id);
        else
            self.setID(new_id);
    });
    addReviewItem(recGroup.shouldMerge ? recGroup : this);
    var feedback = {
        query:this['/rec_ui/recon_query'],
        reconciledWith:id,
        automatic:automatic,
        softwareTool: "/guid/9202a8c04000641f800000000df257ed"
    }
    $.getJSON("http://data.labs.freebase.com/recon/feedback", {feedback:JSON.stringify(feedback)}, function(){});
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
    if (!Arr.contains(this['/rec_ui/headers'], prop)) {
        this['/rec_ui/headers'].push(prop);
        this['/rec_ui/headerPaths'].push(new loader.path(prop));
    }
    if (isMqlProp(prop) && !isCVTProperty(prop) && !Arr.contains(this['/rec_ui/mql_props'], prop)) {
        this['/rec_ui/mql_props'].push(prop);
        this['/rec_ui/mql_paths'].push(new loader.path(prop));
    }
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

/** @return {!string|undefined}*/
tEntity.prototype.getID = function() {
    var recGroup = internalReconciler.getRecGroup(this);
    if (recGroup && recGroup.shouldMerge)
        return recGroup.getID();
    return this.id;
}

tEntity.prototype.setID = function(id) {
    this.id = id;
}

tEntity.prototype.getIdentifier = function() {
    var id = this.getID();
    if (id !== "None")
        return id;
    
    var recGroup = internalReconciler.getRecGroup(this);
    if (recGroup && recGroup.shouldMerge)
        return "$recGroup" + recGroup.internal_id
    else
        return "$entity" + this['/rec_ui/id'];
}

tEntity.prototype.getInternalID = function() {
    return this['/rec_ui/id'];
}

/** @return {string} */
tEntity.prototype.toString = function() {
    return textValue(this);
}

/** @return {Object} */
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