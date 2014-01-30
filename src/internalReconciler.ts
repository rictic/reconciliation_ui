class InternalReconciler {
    /** @type !Object.<!string,!Object.<!string,!RecGroup>> */
    private byType = {};

    register(entity:tEntity) {
      var recGroup = this.getRecGroup(entity);
      if (recGroup === undefined)
          return;
      recGroup.register(entity);
    }

  setMerged(entity:tEntity, shouldMerge:boolean) {
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
  getRecGroup(entity:tEntity):RecGroup {
    var type = this.typeEquivalence(
      entity.get("/type/object/type")[0]);
    var name = this.normalizeName(entity.get("/type/object/name")[0]);
    if (Arr.any([type, name], isUndefined))
      return undefined;
    return this._getRecGroup(type, name);
  }

  typeEquivalence(type:string):string {
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
    if (type in equivalences) {
      return equivalences[type];
    }
    return type;
  }


  /** @param {!string} type
  * @param {!string} name
  * @return {!RecGroup}
  */
  private _getRecGroup(type:string, name:string):RecGroup {
    if (!(type in this.byType))
      this.byType[type] = {};
    var byName = this.byType[type];
    if (!(name in byName))
      byName[name] = new RecGroup(type, name);
    return byName[name];
  }

  normalizeName(name:string):string {
    if (name)
      return $.trim(name)
    return name;
  }
}


class RecGroup implements EntityLike {
  static groups:RecGroup[] = [];
  static id_counter = 0;

  members:tEntity[] = [];
  shouldMerge = false;
  reconciledTo:string;
  internal_id:number;
  constructor(public type:string, public name:string) {
    this.internal_id = RecGroup.id_counter++;
    RecGroup.groups[this.internal_id] = this;
  }

  register(entity:tEntity) {
    if (entity.getID() === "None (merged)") {
      entity.setID(undefined);
      this.reconciledTo = "None";
      this.shouldMerge = true;
    }

    this.members.push(entity);
  }

  setID(id:string) {
    this.reconciledTo = id;
    politeEach(this.members, function(_, member) {
      addColumnRecCases(member);
    });
  }

  getID():string {
    var id = this.reconciledTo;
    if (id === "None" && this.shouldMerge)
      return "None (merged)";
    return id;
  }

  getInternalID():number {
    return this.internal_id;
  }

  unreconcile() {
    this.reconciledTo = undefined;
  }
}
