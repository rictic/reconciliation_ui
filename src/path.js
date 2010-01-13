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
loader.path = function(pathString) {
    var sections = pathString.split(/[:.]/)
    this.parts = $.map(sections, function(section) {
        return new loader.path.part(section);
    });
}

/** @type {Array.<loader.path.part>} */
loader.path.prototype.parts;

/** @return {!string} */
loader.path.prototype.toString = function() {
    var result = "";
    var segments = $.map(this.parts, function(part) {
        return part.toString();
    });
    return segments.join(":");
}

loader.path.prototype.getDisplayName = function() {
    var lastPart = this.parts[this.parts.length-1];
    return getPropName(lastPart.prop);
}

loader.path.prototype.getProps = function() {
    return $.map(this.parts, function(part) {return part.prop})
}


/** @constructor
  * @param {!string} segmentString
  * @return !loader.path.part
  */
loader.path.part = (function() {
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
    
    //the constructor;
    /** @constructor */
    return function(segmentString) {
        this.index = parseIndex(segmentString);
        this.prop = parseProp(segmentString);
    }
})();

loader.path.part.prototype.toString = function() {
    var s = this.prop;
    if (this.index !== undefined)
        s += "[" + this.index + "]";
    return s;
}