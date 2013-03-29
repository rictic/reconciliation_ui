
/**  An index all entities.  entity === entities[entity['/rec_ui/id']] */
var entities: tEntity[];
var internalIDCounter : number;

function resetEntities() {
    entities = [];
    internalIDCounter = 0;
}
resetEntities();

//For tEntity and RecGroups
interface EntityLike {
  setID(string);
}

/** @constructor
  * @param {Object=} initialVals
  */
class tEntity {
  name:string;
  id:string;
  reconResults;
  typelessRecon = false;
  constructor(initialVals?) {
    this["/rec_ui/id"] = internalIDCounter++
    this["/rec_ui/mql_props"] = [];
    this["/rec_ui/mql_paths"] = []
    this["/rec_ui/headers"] = [];
    this["/rec_ui/headerPaths"] = [];
    entities[this["/rec_ui/id"]] = this;
    for (var key in initialVals) {
      this[key] = initialVals[key];
    }
  }

  setInitialHeaders(headers:string[]) {
    var self = this;
    $.each(headers, (_, header) => {
        self.propSeen(header);
    });
  }

  getChainedProperty(prop:string):any[] {
    return getChainedProperty(this, prop);
  }

  get(path, preservePlace?:bool):any[] {
    if (getType(path) === "string") {
      var spath:string = path;
      return this.get(new loader.path(spath), preservePlace);
    }

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

  freebaseLink(linkText?:string) {
    linkText = linkText || this.name || this.getID();
    return freebase.link(linkText,this.getID());
  }

  displayValue() {
    if (!this.id)
      return displayValue(this['/type/object/name'] || this.getID());
    return this.freebaseLink();
  }

  reconcileWith(id:string, automatic:bool) {
    this['/rec_ui/was_automatically_reconciled'] = automatic;
    var recGroup = internalReconciler.getRecGroup(this);
    var self = this;
    freebase.getCanonicalID(id, function(new_id) {
      if (recGroup.shouldMerge)
        recGroup.setID(new_id);
      else
        self.setID(new_id);
    });
    tEntity.emit("reconciled", this, automatic);
  }

  addProperty(prop:string, value) {
    if (getType(prop) !== "string"){
      console.warn("called tEntity.property.addProperty with prop of type `" + getType(prop) + "`, expected string.  The value was: " + JSON.stringify(JsObjDump.annotate(value)));
      return;
    }

    if (prop === "id")
      this[prop] = $.makeArray(value)[0];
    else {
      value = Arr.filter($.makeArray(value), function(v) {return v !== undefined;})
      this[prop] = value;
    }

    if (prop === "/type/object/type") {
      typesSeen.addAll(this[prop]);
    }
    this.propSeen(prop);
  }

  /** Keep up with needed metadata about a given property */
  propSeen(prop:string) {
    if (!Arr.contains(this['/rec_ui/headers'], prop)) {
      this['/rec_ui/headers'].push(prop);
      this['/rec_ui/headerPaths'].push(new loader.path(prop));
    }
    if (isMqlProp(prop) && !isCVTProperty(prop) && !Arr.contains(this['/rec_ui/mql_props'], prop)) {
      this['/rec_ui/mql_props'].push(prop);
      this['/rec_ui/mql_paths'].push(new loader.path(prop));
    }
  }

  addParent(parent:tEntity, prop?:string) {
    this['/rec_ui/parent'] = $.makeArray(parent)[0];
    if (prop != undefined) {
      this.addProperty(prop, parent);
    }
  }

  isCVT():bool {
    //an entity is a CVT if any of its types are CVT types
    return Arr.any($.makeArray(this['/type/object/type']), isCVTType);
  }

  getID():string {
    var recGroup = internalReconciler.getRecGroup(this);
    if (recGroup && recGroup.shouldMerge)
      return recGroup.getID();
    return this.id;
  }

  setID(id) {
    this.id = id;
  }

  getIdentifier():string {
    var id = this.getID();
    if (!Arr.contains(["None", "None (merged)"], id))
      return id;

    var recGroup = internalReconciler.getRecGroup(this);
    if (recGroup && recGroup.shouldMerge)
      return "$recGroup" + recGroup.internal_id
    else
      return "$entity" + this['/rec_ui/id'];
  }

  getInternalID():number {
      return this['/rec_ui/id'];
  }

  toString():string {
    return textValue(this);
  }

  /** @return {Object} */
  toJSON() {
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

  unreconcile() {
    this.id = undefined;
    var recGroup = internalReconciler.getRecGroup(this);
    removeReviewItem(this);
    if (recGroup) {
      removeReviewItem(recGroup);
      if (recGroup.shouldMerge)
        recGroup.unreconcile();
    }
  }

  //TODO(rictic): this is really hacky:
  static addListener(name:string, handler:Function) { }
  static emit(name:string, ...args:any[]) { }
}

copyInto(new EventEmitter(), tEntity);
