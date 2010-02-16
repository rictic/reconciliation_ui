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

//perform a shallow copy of a JS object
function clone(obj) {
    var copy = {};
    for (var i in obj)
        copy[i] = obj[i];
    return copy;
}

/**constructs a DOM node
  * @param {!string} kind The tag of the created node
  * @param {...*} var_args
  */
function node(kind, var_args) {
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
function idToClass(idName) {
    return idName.replace(/\//g,"_").replace(":","___");
}

function startsWith(needle, haystack) {
    if (haystack.substr(0,needle.length) === needle)
        return true;
    return false;
}

function endsWith(needle, haystack) {
    if (haystack.substr(haystack.length-needle.length) === needle)
        return true;
    return false;
}


function charIn(string, chr) {
    return string.indexOf(chr) !== -1;
}

function isValueProperty(propName) {
    if (Arr.contains(["/type/object/type", "/type/object/name", "id"], propName))
        return true;
    if (freebase.getPropMetadata(propName))
        return isValueType(freebase.getPropMetadata(propName).expected_type);
    return undefined;
}

function isValueType(type) {
    return Arr.contains(type['extends'], "/type/value");
}

function isCVTProperty(propName) {
    var prop = freebase.getPropMetadata(propName);
    if (prop)
        return isCVTType(prop.expected_type);
    return undefined;
}

/** @param {!(string|Object)} type
  * @return {(boolean|undefined)}
  */
function isCVTType(type) {
    if (getType(type) === "string")
        type = freebase.getTypeMetadata(type);
    if (type === undefined) {
        error("type undefined in isCVTType");
        return;
    }
        
    return type["/freebase/type_hints/mediator"] 
        && type["/freebase/type_hints/mediator"].value;
}

function toJSON(value) {
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
function getFirstValue(obj) {
    for (var key in obj)
        return obj[key];
    return undefined;
}

function getSecondValue(obj) {
    var i = 1;
    for (var key in obj){
        if (i > 1)
            return obj[key];
        i++;
    }
    return undefined;
}

function isObjectEmpty(obj) {
    for (var key in obj)
        return false;
    return true;
}

function numProperties(obj) {
    var i = 0;
    for (var key in obj)
        i++;
    return i;
}



function identity(value) {return value;}
function isUndefined(value) {return value === undefined;}

function getChainedProperty(entity, prop) {
    var slots = [entity];
    $.each(prop.split(":"), function(_,part) {
        var newSlots = [];
        $.each(slots, function(_,slot) {
            newSlots = newSlots.concat($.grep($.makeArray(slot[part]),identity))
        })
        slots = newSlots;
    });
    if (slots === []) return undefined;
    return slots;
}

var isMqlProp = (function(){
    var invalidList = ["/type/object/name","/type/object/type","/type/object/id",/(^|:)id$/];
    return function(prop) {
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
function getProperties(headerPaths) {
    var candidates = Arr.unique(Arr.concat($.map(headerPaths, function(headerPath){return headerPath.getProps();})));
    return Arr.filter(candidates, function(header) {
        return header.charAt(0) == "/"
    })
}

/** @constructor */
function OrderedMap() {
    var properties = [];
    var map = {};
    this.set = function(key, value) {
        if (key in map)
            map[key] = value;
        else
            this.add(key,value);
    }
    this.setIfAbsent = function(key,value) {
        if (!(key in map))
            this.set(key,value);
        return this.get(key);
    }
    this.add = function(key, value) {
        properties.push(key);
        map[key] = value;
    }
    this.get = function(key, defaultValue) {
        return map[key] || defaultValue;
    }
    this.getProperties = function() {
        return properties;
    }
    //assumes OrderedMap<String,OrderedMap>
    this.getComplexProperties = function() {
        var self = this;
        return Arr.concatMap(properties, function(prop) {
            var innerProps = self.get(prop).getComplexProperties();
            return [prop].concat($.map(innerProps,function(innerProp){return prop + ":" + innerProp}));
        });
    }
}


/** Wrapper function for setTimeout.  Todo: add error handling
  * @param {function()} f
  * @param {number} millis
  */
function addTimeout(f, millis) {
    return setTimeout(f,millis,"JavaScript");
}

function addInterval(f, millis) {
    return setInterval(f,millis,"JavaScript");
}

/**
  @return {string} 
*/
function getType(v) {
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

//This set implementation preserves order, but just in case
var OrderedSet = Set; 

/**
 * @param {string} url
 * @param {Object} params
 * @param {function(Object)} onSuccess
 * @param {function()} onTimeout
 * @param {number=} millis milliseconds until query times out
 */
function getJSON(url, params, onSuccess, onTimeout, millis) {
    millis = millis || 120000; //default of 2 minute timeout
    var timedOut = false;
    var responded = false;
    function timeout() {
        if (responded) return;
        warn("timed out");
        timedOut = true;
        if (onTimeout) onTimeout();
    }
    var timer = addTimeout(timeout, millis);
    function responseHandler(response) {
        if (timedOut) {
            warn("got response after timeout")
            return;
        }
        responded = true;
        clearTimeout(timer);
        onSuccess(response);
    }

    if (window.location.host === "data.labs.freebase.com")
        $.post(url, params, responseHandler, "jsonp")
    else 
        $.getJSON(url, params, responseHandler);
}

function onSameDomain() {
    return window.location.host === "data.labs.freebase.com";
}

/** Returns the standard form that an id should take.
  * Useful for interfacing with other tools.
  * 
  * @param {!string} id
  * @returns {!string}
  */
function standardizeId(id) {
    return id.replace(/\#([0-9a-f]{32})/, "/guid/$1");
}

/** A wrapper around setInterval that can be reset, so that
  * onTick fires at most once every interval millis.
  *
  * @constructor
  * @param {!number} interval
  * @param {!function()} onTick
  */
function RepeatingTimer(interval, onTick) {
    /** @const */
    this.interval = interval;
    /** @const */
    this.onTick = onTick;
    this.stopped = false;
    this.reset();
}

RepeatingTimer.prototype.reset = function() {
    if (this.stopped) 
        return;
    this.clear();
    this.id = addInterval(this.onTick, this.interval);
}

RepeatingTimer.prototype.stop = function() {
    this.clear();
    this.stopped = true;
}

RepeatingTimer.prototype.clear = function() {
    if (this.id) {
        clearTimeout(this.id)
        this.id = undefined;
    }
}

function copyInto(source, destination) {
    for (var key in source)
        destination[key] = source[key];
}

/*
** create debugging tools if they're not available
*/
function logger(log_level) {
    if (console[log_level])
        return function(message) {
          try {
            return console[log_level](message);
          }
          catch(e) {
            return console[log_level](JsObjDump.annotate(message));
          }
        };
    return function(message){/*node("div",JSON.stringify(message)).appendTo("#" + log_level + "Log");*/ return message;}
}

//These messages don't go anywhere at the moment, but it'd be very easy to create the
// places where they'd go
if (!window.console)
    var console = {};
var error  = logger("error");
var warn   = logger("warn" );
var log    = logger("log"  );
var info   = logger("info" );
var assert = function() {
    if (console.assert)
        return function(bool, message) {return console.assert(bool,message);};
    return function(bool,message){if (!bool) error(message)};
}()


var debug = function(val) {
    log(JSON.stringify(JsObjDump.annotate(val), null, 2))
}

var p = function(val) {
    if (getType(val) === "object" && 'toJSON' in val)
        debug(val.toJSON());
    else
        debug(val);
}