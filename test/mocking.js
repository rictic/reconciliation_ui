Yielder = function() {
	return {shouldYield: function(){return false;}}
}

var value_prop = {
    "expected_type" : {
        "extends" : ["/type/value"],
        "id" : null,
        "/freebase/type_hints/mediator" : {"optional":true, "value":null}
    },
    "reverse_property" : null,
    "master_property"  : null,
    "type" : "/type/property",
    "name":null,
    "id" : null
};
var topic_prop = {
    "expected_type" : {
        "extends" : [],
        "id" : null,
        "/freebase/type_hints/mediator" : {"optional":true, "value":null}
    },
    "reverse_property" : null,
    "master_property"  : null,
    "type" : "/type/property",
    "name":null,
    "id" : null
};

var cvt_type = {
    type:'/type/type',
    "/freebase/type_hints/mediator" : {value:true},
    "/freebase/type_hints/included_types":[]
}


var mocked_properties = {
  "/film/film/directed_by": {
        "expected_type": {
            "/freebase/type_hints/mediator": null,
            "extends":       [],
            "id":            "/film/director"
        },
        "id":            "/film/film/directed_by",
        "master_property": null,
        "name":          "Directed by",
        "reverse_property": "/film/director/film",
        "inverse_property": "/film/director/film",
        "type":          "/type/property"
    }
};
freebase.fetchPropertyInfo = function(props,onComplete,onError){onComplete();},
freebase.getPropMetadata = function(prop){
    if (prop in mocked_properties && !(mocked_properties[prop] instanceof Function)) return mocked_properties[prop];
    if (startsWith("/rec_ui/", prop)) return undefined;
    if (endsWith("topic", prop)) return topic_prop;
    return value_prop;
}
freebase.fetchTypeInfo = function(types, onComplete, onError) {onComplete();}

freebase.getTypeMetadata = function(type) {
    if (startsWith("/cvt", type)) {
        var result = clone(cvt_type);
        result.id = type;
        return result;
    }
    return {
        id:type,
        type:'/type/type',
        "/freebase/type_hints/included_types":[],
        "/freebase/type_hints/mediator":{}
    }
}

/** @param {*} context
  * @param {!string} name
  * @param {*} value
  * @returns function()
  */
function temporaryMock(context, name, value) {
    var oldValue = context[name];
    if (oldValue === undefined) {
        error("mocking " + name + " which is undefined");
    }
    context[name] = value;
    return function unmock() {
        context[name] = oldValue;
    }
}

/** @type function(...) */
function mockingFunction(var_args) {}

//stub out network access functions
$.getJSON = mockingFunction;
getJSON = mockingFunction;
$.ajax = mockingFunction;