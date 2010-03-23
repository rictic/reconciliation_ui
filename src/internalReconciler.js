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
    var type = this.typeEquivalence(entity.get("/type/object/type")[0]);
    var name = this.normalizeName(entity.get("/type/object/name")[0]);
    if (Arr.any([type, name], isUndefined))
        return undefined;
    return this._getRecGroup(type, name);
}

InternalReconciler.prototype.typeEquivalence = function(type) {
    var equivalences = {
        "/film/director"                 : "/people/person",
        "/film/producer"                 : "/people/person",
        "/film/writer"                   : "/people/person",
        "/film/film_story_contributor"   : "/people/person",
        "/film/cinematographer"          : "/people/person",
        "/film/editor"                   : "/people/person",
        "/film/film_casting_director"    : "/people/person",
        "/film/film_production_designer" : "/people/person",
        "/film/film_art_director"        : "/people/person",
        "/film/film_set_decorator"       : "/people/person",
        "/film/film_costume_designer"    : "/people/person",
        "/film/music_contributor"        : "/people/person",
        "/film/film_crewmember"          : "/people/person"
    }
    if (type in equivalences)
        return equivalences[type];
    return type;
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