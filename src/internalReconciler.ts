class InternalReconciler {
    /** @type !Object.<!string,!Object.<!string,!RecGroup>> */
    private byType = {};

    register(entity) {
      var recGroup = this.getRecGroup(entity);
      if (recGroup === undefined)
          return;
      recGroup.register(entity);
    }
}

/** @param {!tEntity} entity */
InternalReconciler.prototype.register = function(entity) {
}

/** @param {!tEntity} entity
  * @param {!boolean} shouldMerge*/
InternalReconciler.prototype.setMerged = function(entity, shouldMerge) {
    var recGroup = this.getRecGroup(entity);
    recGroup.shouldMerge = shouldMerge;
    if (shouldMerge === false) {
        recGroup.setID(undefined);
        $.each(recGroup.members, function(_, member) {
            //this may add duplicates, but that's ok
            automaticQueue.push(member);
        });
        removeReviewItem(recGroup);
    }
    else {
        $.map(recGroup.members, removeReviewItem);
    }
}

/** @param {!tEntity} entity
  * @return {(!RecGroup|undefined)}
  */
InternalReconciler.prototype.getRecGroup = function(entity) {
    var type = entity.get("/type/object/type")[0];
    var name = this.normalizeName(entity.get("/type/object/name")[0]);
    if (Arr.any([type, name], isUndefined))
        return undefined;
    return this._getRecGroup(type, name);
}

/** @param {!string} type
  * @param {!string} name
  * @return {!RecGroup}
  */
InternalReconciler.prototype._getRecGroup = function(type, name) {
    if (!(type in this.byType))
        this.byType[type] = {};
    var byName = this.byType[type];
    if (!(name in byName))
        byName[name] = new RecGroup(type, name);
    return byName[name];
}

InternalReconciler.prototype.normalizeName = function(name) {
    if (name)
        return $.trim(name)
    return name;
}

RecGroup.groups = [];
RecGroup.id_counter = 0;
/** @constructor */
function RecGroup(type, name) {
    this.type = type; this.name = name;
    /** @type !Array.<!tEntity> */
    this.members = [];
    /** @type boolean */
    this.shouldMerge = false;
    this.internal_id = RecGroup.id_counter++;
    RecGroup.groups[this.internal_id] = this;
}

RecGroup.prototype.register = function(entity) {
    if (entity.getID() === "None (merged)") {
        entity.setID(undefined);
        this.reconciledTo = "None";
        this.shouldMerge = true;
    }

    this.members.push(entity);
}

RecGroup.prototype.setID = function(id) {
    this.reconciledTo = id;
    politeEach(this.members, function(_, member) {
        addColumnRecCases(member);
    });
}

RecGroup.prototype.getID = function() {
    var id = this.reconciledTo;
    if (id === "None" && this.shouldMerge)
        return "None (merged)";
    return id;
}

RecGroup.prototype.getInternalID = function() {
    return this.internal_id;
}

RecGroup.prototype.unreconcile = function() {
    this.reconcileTo = undefined;
}
