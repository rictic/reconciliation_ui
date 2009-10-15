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
}
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
}
freebase.fetchPropertyInfo = function(props,onComplete,onError){onComplete();},

freebase.getPropMetadata = function(prop){
    if (prop.substr(0,8) == "/rec_ui/") return undefined;
    if (prop.substr(0,5) == "topic") return topic_prop;
    return value_prop;
}
freebase.fetchTypeInfo = function(types, onComplete, onError) {onComplete();}
