/** @constructor */
function InternalReconciler() {
    /** @type !Object.<!string,!Object.<!string,!RecGroup>> */
    this.byType = {};
}

/** @param {!tEntity} entity */
InternalReconciler.prototype.register = function(entity) {
    var recGroup = this.getRecGroup(entity);
    if (recGroup === undefined)
        return;
    recGroup.register(entity);
}

/** @param {!tEntity} entity
  * @param {!boolean} shouldMerge*/
InternalReconciler.prototype.setMerged = function(entity, shouldMerge) {
    this.getRecGroup(entity).shouldMerge = shouldMerge;
}

/** @param {!tEntity} entity 
  * @return {(!RecGroup|undefined)}
  */
InternalReconciler.prototype.getRecGroup = function(entity) {
    var type = entity.get(new loader.path("/type/object/type"))[0];
    var name = entity.get(new loader.path("/type/object/name"))[0];
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
        byName[name] = new RecGroup();
    return byName[name];
}

RecGroup.groups = [];
RecGroup.id_counter = 0;
/** @constructor */
function RecGroup() {
    /** @type !Array.<!tEntity> */
    this.members = [];
    /** @type boolean */
    this.shouldMerge = false;
    this.internal_id = RecGroup.id_counter++;
    RecGroup.groups[this.internal_id] = this;
}

RecGroup.prototype.register = function(entity) {
    this.members.push(entity);
}

RecGroup.prototype.setID = function(id) {
    this.reconciledTo = id;
}
