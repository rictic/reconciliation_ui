// ========================================================================
// Copyright (c) 2008-2009, Metaweb Technologies, Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY METAWEB TECHNOLOGIES AND CONTRIBUTORS
// ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL METAWEB
// TECHNOLOGIES OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
// OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
// DAMAGE.
// ========================================================================

/*
**  Misc utility functions
*/

var api_key = "AIzaSyCECXPKV-s7vRKzVW_hy5ai4OCnWl86aq4"

//perform a shallow copy of a JS object
function clone<T>(obj:T):T {
    var copy = <T>({});
    for (var i in obj)
        copy[i] = obj[i];
    return copy;
}

/**constructs a DOM node
  * @param {!string} kind The tag of the created node
  * @param {...*} var_args
  */
function node(kind:string, ...args:any[]):JQuery {
    var node = $(document.createElement(arguments[0]));
    var options = arguments[arguments.length-1]
    var len = arguments.length - 1;
    if (typeof options == "object" && options.insertAfter == undefined){
        if (options["onclick"] != undefined) {
            node.click(options["onclick"]);
            delete options["onclick"];
        }
        node.attr(options);
    }
    else
        len = arguments.length;

    for (var i = 1; i < len; i++)
        node.append(arguments[i]);
    return node;
}


/** Maps MQL ids to valid CSS class names
  * @param {!string} idName the MQL id
 */
function idToClass(idName:string):string {
    return idName.replace(/\//g,"_").replace(":","___");
}

function startsWith(needle:string, haystack:string):boolean {
    if (haystack.substr(0,needle.length) === needle)
        return true;
    return false;
}

function endsWith(needle:string, haystack:string):boolean {
    if (haystack.substr(haystack.length-needle.length) === needle)
        return true;
    return false;
}


function charIn(string:string, chr:string):boolean {
    return string.indexOf(chr) !== -1;
}

function toJSON(value:any):any {
    if (typeof value === "object" && 'toJSON' in value)
        return value.toJSON();
    switch(getType(value)){
    case "array":
        return $.map(value, toJSON);
    case "function":
        return undefined;
    default:
        return value;
    }
}

//I can't believe I can't find a better way of doing these
/* Functions for treating an object kinda like a list */
function getFirstValue(obj:Object):any {
    for (var key in obj)
        return obj[key];
    return undefined;
}

function getSecondValue(obj:Object):any {
    var i = 1;
    for (var key in obj){
        if (i > 1)
            return obj[key];
        i++;
    }
    return undefined;
}

function isObjectEmpty(obj:Object):boolean {
    for (var key in obj)
        return false;
    return true;
}

function numProperties(obj:Object):number {
    var i = 0;
    for (var key in obj)
        i++;
    return i;
}



function identity<T>(value:T):T {return value;}
function isUndefined(value:any):boolean {return value === undefined;}

function getChainedProperty(entity:tEntity, prop:string):any {
    var slots = [entity];
    $.each(prop.split(":"), function(_,part) {
        var newSlots : any[] = [];
        $.each(slots, function(_,slot) {
            newSlots = newSlots.concat($.grep($.makeArray(slot[part]),identity))
        })
        slots = newSlots;
    });
    if (slots === []) return undefined;
    return slots;
}

var isMqlProp = (function(){
    var invalidList = [
        /\/type\/object\/name/,
        /\/type\/object\/type/,
        /\/type\/object\/id/
    ];
    invalidList.push(/(^|:)id$/);
    return function(prop:string):boolean {
        for (var i = 0; i<invalidList.length; i++){
            if (prop.match(invalidList[i]))
                return false;
        }
        return true;
    }
})();

/** @param {!Array.<!loader.path>} headerPaths
  * @return !Array.<!string>
  */
function getProperties(headerPaths:loader.path[]):string[] {
    var candidates = Arr.unique(Arr.concat($.map(headerPaths, function(headerPath){return headerPath.getProps();})));
    return Arr.filter(candidates, function(header) {
        return header.charAt(0) == "/"
    })
}

class OrderedMap<V> {
    private properties : any[] = [];
    private map : {[key:string]: V} = {};  // TODO(rictic): generics?
    set(key:any, value:V) {
        if (key in this.map)
            this.map[key] = value;
        else
            this.add(key,value);
    }
    setIfAbsent(key:any, value:V):V {
        if (!(key in this.map))
            this.set(key,value);
        return this.get(key);
    }
    add(key:any, value:V) {
        this.properties.push(key);
        this.map[key] = value;
    }
    get(key:any, defaultValue?:V):V {
        return this.map[key] || defaultValue;
    }
    getProperties():V[] {
        return this.properties;
    }
    //assumes OrderedMap<String,OrderedMap>
    getComplexProperties():string[] {
        var self = this;
        return Arr.concatMap(this.properties, function(prop:any) {
            var innerMap:any = self.get(prop);
            var innerProps = innerMap.getComplexProperties();
            var combined = $.map(innerProps,function(innerProp){return prop + ":" + innerProp})
            return [prop].concat(combined);
        });
    }
    getPropsForRows(): string[] {
      throw new Error('must be overridden');
    }
}

/**
  @return {string}
*/
function getType(v:any):string {
    if (typeof v !== "object") return typeof v;
    if ($.isArray(v)) return "array";
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (v instanceof Date) return "date";
    if (v instanceof RegExp) return "regexp";
    if (v instanceof String) return "string";
    if (v instanceof Function) return "function";
    return "object";
}

/**
 * @param {string} url
 * @param {Object} params
 * @param {function(Object)} onSuccess
 * @param {function()} onTimeout
 * @param {number=} millis milliseconds until query times out
 */
function getJSON(url:string,
                 params:Object,
                 onSuccess:(result:Object)=>void,
                 onTimeout?:()=>void,
                 millis?:number):void {
    millis = millis || 120000; //default of 2 minute timeout
    var timedOut = false;
    var responded = false;
    function timeout() {
        if (responded) return;
        console.warn("timed out");
        timedOut = true;
        if (onTimeout) onTimeout();
    }
    var timer = addTimeout(timeout, millis);
    function responseHandler(response:any) {
        if (timedOut) {
            console.warn("got response after timeout")
            return;
        }
        responded = true;
        clearTimeout(timer);
        onSuccess(response);
    }

    $.getJSON(url, params, responseHandler);
}

/** Returns the standard form that an id should take.
  * Useful for interfacing with other tools.
  *
  * @param {!string} id
  * @returns {!string}
  */
function standardizeId(id:string):string {
    return id.replace(/\#([0-9a-f]{32})/, "/guid/$1");
}

/**
 * A wrapper around setInterval that can be reset, so that
 * onTick fires at most once every interval millis.
 */
class RepeatingTimer {
  stopped = false;
  id : number = undefined;
  constructor(public interval:number, public onTick:()=>void) {
    this.reset();
  }

  reset() {
    if (this.stopped) {
      return;
    }
    this.clear();
    this.id = addInterval(this.onTick, this.interval);
  }

  stop() {
    this.clear();
    this.stopped = true;
  }

  clear() {
    if (this.id) {
      clearTimeout(this.id)
      this.id = undefined;
    }
  }
}



function copyInto(source:Object, destination:Object) {
    for (var key in source)
        destination[key] = source[key];
}


function insertInto(text:string, textarea:JQuery) {
    var selection = new TSelection(textarea[0]).create();
    var val = textarea.val();
    val = val.substring(0,selection.start) + text + val.substring(selection.end);
    textarea.val(val);
    textarea.focus();
}

var debug = function(val:any) {
    console.log(JSON.stringify(JsObjDump.annotate(val), null, 2))
}

var p = function(val:any) {
    if (getType(val) === "object" && 'toJSON' in val)
        debug(val.toJSON());
    else
        debug(val);
}

function combineCallbacks(expected:number, trueCallback:()=>void):()=>void {
  if (expected === 0) {
    setTimeout(trueCallback, 0);
    return function(){};
  }

  var received = 0;
  return function callBack() {
    received += 1;
    if (received === expected) {
      trueCallback();
    }
  }
}
