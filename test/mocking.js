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
    if (startsWith("topic", prop)) return topic_prop;
    return value_prop;
}
freebase.fetchTypeInfo = function(types, onComplete, onError) {onComplete();}
