/**
 * An object for encoding a path through a loader.tree or
 * tEntity.
 *
 * The tree/entity's properties, are all arrays of tree/entities or
 * undefineds (except at the leaves, where they can be strings).
 *
 *
 * The index is sometimes undefined because knowing that
 * it wasn't specified is useful in reconstructing the
 * original spreadsheet.  This is treated as "take every branch"
 *
 * "/foo/bar:/baz/asdf[1]:/fdsa[2]" returns
 *   [ {"prop":"/foo/bar", "index":undefined},
 *     {"prop":"/baz/asdf", "index":1},
 *     {"prop":"/fdsa", "index":2} ]
 *
 * @constructor
 * @param {!string} pathString
 * @return !loader.path
 */
module loader {
  export class path {
    parts : part[];

    constructor(pathString:string) {
      var sections = pathString.split(/[:.]/)
      this.parts = $.map(sections, function(section) {
        return new part(section);
      });
    }

    toString():string {
      var result = "";
      var segments = $.map(this.parts, function(part) {
        return part.toString();
      });
      return segments.join(":");
    }

    getDisplayName():string {
      return getPropName(this.toComplexProp());
    }

    //a string representation without indices, for calling legacy
    //functions.  should be removed eventually
    toComplexProp():string {
        return $.map(this.parts, function(part){return part.prop}).join(":");
    }

    getProps():string[] {
        return $.map(this.parts, function(part) {return part.prop})
    }

  }
  export class part {
    public index : number;
    public prop : string;
    constructor(segment:string) {
      this.index = parseIndex(segment);
      this.prop = parseProp(segment);

      /**
       * Returns the index or undefined
      */
      function parseIndex(part) {
        var numsearch = part.match(/\[(\d+)\]/)
        if(numsearch == null || numsearch.length !== 2) return undefined
        else return parseInt(numsearch[1], 10)
      }

      /**
       * Returns the property without the index.
       */
      function parseProp(part) {
          var propsearch = part.match(/(.+)\[\d+\]/)
          if(propsearch == null || propsearch.length != 2) return part
          else return propsearch[1]
      }
    }

    toString() {
      var s = this.prop;
      if (this.index !== undefined)
        s += "[" + this.index + "]";
      return s;
    }
  }
}

