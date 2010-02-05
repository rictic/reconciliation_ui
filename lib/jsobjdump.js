
var JsObjDump = (function() {

  var seen;
  var newseen; // same as seen, but points to newobjs
  var arraysToTag; //list of [array, tag] pairs
  var line_count;
  var DEFAULT_SKIP = []; //TODO: init with contents of 'this'

  var MAX_LINE_COUNT, MAX_DEPTH, FUNCTION_SOURCE, SKIP, SKIP_FUNCTIONS, SHOW_PROTO, SHOW_CONS;
  var BORING_CONS  = [Object, Function];
  var BORING_PROTO = [Object.prototype, Function.prototype];
  function set_prefs() {
    var o = {};
    if (this.console && this.console.options) {
        o = this.console.options;
    }
    MAX_LINE_COUNT  = o.MAX_LINE_COUNT  || 3000;         // bail if we generate more lines than this
    MAX_DEPTH       = o.MAX_DEPTH       || 8;            // bail if we go deeper than x levels
    FUNCTION_SOURCE = o.FUNCTION_SOURCE || false;        // show full source code of functions
    SKIP            = o.SKIP            || DEFAULT_SKIP; // list of objects to ignore (defaults set by acreboot.js)
    SKIP_FUNCTIONS  = o.SKIP_FUNCTIONS  || false;        // show properties that are functions
    SHOW_PROTO      = o.SHOW_PROTO      || false;        // walk .prototype & .__proto__
    SHOW_CONS       = o.SHOW_CONS       || false;        // walk .constructor
  }

  var toString = Object.prototype.toString;
  function isArray( obj ) {
    return toString.call(obj) === "[object Array]";
  }

  function get_function_sig(value) {
    var code = value.toString();
    if (FUNCTION_SOURCE) {
      return code;
    } else {
      var r = /function\s+(.+?)\s*\{/.exec(code); /*} - needed for textmate format bug */
      if (!r || !r.length) { return "ERROR: invalid function "+code; }
      return r[1];
    }
  }

  function ensureIDTagged(obj, id) {
    if (isArray(obj)) {
      arraysToTag.push([obj,'~~ID:'+id+'~~']);
    } else {
      obj['~~ID~~']=id;
    }
  }
  function annotate_prim(obj,depth) {
    if (!depth) { throw new Error("Missing depth"); }
    var typ, // object's type
    newobj;  // a copy of obj

    line_count++;
    if (line_count>MAX_LINE_COUNT) { return '~~TOO_MANY_LINES~~'; }

    typ = typeof obj;
    if (typ==='object') {
      // JS spec bugs
      if (!obj) { typ = 'null'; }
      if (obj instanceof Date) { typ = 'date';}
      else if (isArray(obj)) { typ = 'array'; } // WILL: this will stop full dump on a = new Array(11,22,33); a.will=true;
    }
    if (obj instanceof RegExp) { typ = 'regexp';}
    if (typ!=='object' && typ!=='function' && typ!=='array') { // is it a boolean, number, string, date, regexp, undefined, null
      if (typ==='undefined') { return '~~UNDEFINED~~'; }
      else {                  return obj; }
    }

    // should we ignore this object?
    if (depth>1 && SKIP.indexOf(obj)!==-1 ) {
      return '~~SKIPPED~~';
    }
    if (depth>MAX_DEPTH) {
      return '~~TOO_DEEP~~';
    }

    // have we already seen this object?
    var id = seen.indexOf(obj);
    if (id !== -1) {
      // yes, then link to it
      ensureIDTagged(newseen[id], id);
      return '~~LINK:'+id+'~~';
    } else {
      // no, give it a new id
      id = seen.length;
    }

    // Create a new object (or array) reference
    // and mark it as visited before going further
    newobj = (typ==='array') ? [] : {};
    seen[id]=obj;
    newseen[id]=newobj;

    try {
      if (typ==='array') {
        //DOC:
        for (var i=obj.length-1;i>=0;i--) {
          newobj[i] = annotate_prim(obj[i], depth+1);
        }
      } else {
        //object or function
        if (typ==='function') { newobj['~~FUNC~~'] = get_function_sig(obj); }
        if (SHOW_CONS) {
          var cons = obj.constructor;
          if (cons && BORING_CONS.indexOf(cons)===-1) {
            newobj['~~CONS~~'] = annotate_prim(cons, depth+1);
          }
        }
        if (SHOW_PROTO) {
          var proto = obj['__proto__'];
          if (proto && BORING_PROTO.indexOf(proto)===-1) {
            newobj['~~PROTO~~'] = annotate_prim(proto,depth+1); //TODO: more boring protos? Date, Regexp?
          }
        }
        for (var key in obj) {
          // Ignore .prototype?
          if (key==='prototype' && !SHOW_PROTO) { continue; }

          // Ignore inherited keys?
          if (!Object.hasOwnProperty.call(obj,key)) { continue; }
          
          var value = obj[key];
          
          // Ignore functions?
          if (typeof value === "function" && SKIP_FUNCTIONS) { continue; }
          
          newobj[key] = annotate_prim(value, depth+1);
        }
      }
      return newobj;
    } catch(e) {
      return "~~ERROR~~:"+e;
    }
  }
  
  function init() {
    set_prefs(); 
    line_count = 0;
    seen = [];    // list of objects seen since init() was last called
    newseen = [];
    arraysToTag = [];
  }
  
  function post() {
    for (var i = 0; i < arraysToTag.length; i++) {
      arraysToTag[i][0].unshift(arraysToTag[i][1]);
    }
    arraysToTag = null;
  }
  
  function annotate() { /*arguments*/
    init();

    var annotated = []; // copy of arguments, annotated with links to cycles, functions, undefined

    for (var i=0;i<arguments.length;i++) {
      line_count = 0;  // number of properties to show per object
      annotated[i] = annotate_prim( arguments[i] , 1 );
    }

    post();
  
    if (annotated.length === 1) {
      return annotated[0];
    }
    else {
      return annotated;
    }
  }
  
  function annotate_list () { /*arguments*/
    var annotated = annotate.apply(null,arguments);
    if (arguments.length === 1){
      return [annotated];
    }
    else {
      return annotated;
    }
  }
  return {annotate_list:annotate_list, annotate:annotate, DEFAULT_SKIP:DEFAULT_SKIP}; // JsObjDump
}
)
();
