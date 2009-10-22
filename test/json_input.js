
var tests = {};

var json_examples = [
  /* each of these examples is a triple [name, input, expected_parse]*/
  [ "a name and a type",
    { "/type/object/name": "Joshua Norton",
      "/type/object/type": "/people/person"},
    { "/type/object/name"      : ["Joshua Norton"],
      "/type/object/type"      : ["/people/person"],
      "/rec_ui/headers"        : ["/type/object/name","/type/object/type"],
      "/rec_ui/mql_props"      : [],
      "/rec_ui/cvt_props"      : [],
      "/rec_ui/toplevel_entity": true}
  ]
 ,[ "a name, type, and a value mql property",
    {"/type/object/name": "Joshua Norton",
     "/type/object/type": "/people/person",
     "/people/person/date_of_birth": "1819"},
    {"/type/object/name"           : ["Joshua Norton"],
     "/type/object/type"           : ["/people/person"],
     "/people/person/date_of_birth": ["1819"],
     "/rec_ui/headers"             : ["/type/object/name","/type/object/type","/people/person/date_of_birth"],
     "/rec_ui/mql_props"           : ["/people/person/date_of_birth"],
     "/rec_ui/cvt_props"           : [],
     "/rec_ui/toplevel_entity"     : true}
  ]
 ,[ "a film and its director (direct topic property)",
    {"/type/object/name": "Blade Runner",
     "/type/object/type": "/film/film",
     "/film/film/directed_by": {"/type/object/name": "Ridley Scott"}},
    {"/type/object/name": ["Blade Runner"],
     "/type/object/type": ["/film/film"],
     "/film/film/directed_by": [
        {
            "/type/object/name"  : ["Ridley Scott"],
            "/type/object/type"  : ["/film/director"],
            /* This is, in effect, testing that it points back to its parent object.
               The subset testing method that's used here will confirm it, and this way
               we don't have to worry about cyclical data structures.
            */
            "/film/director/film"    : [{"/type/object/name": ["Blade Runner"]}],
            "/rec_ui/parent"         : [{"/type/object/name": ["Blade Runner"]}],
            "/rec_ui/headers"        : ["/type/object/name", "/type/object/type", "/film/director/film"],
            "/rec_ui/mql_props"      : ["/film/director/film"],
            "/rec_ui/cvt_props"      : [],
            "/rec_ui/toplevel_entity": false
        }],
      "/rec_ui/headers": ["/type/object/name", "/type/object/type", "/film/film/directed_by"],
      "/rec_ui/mql_props": ["/film/film/directed_by"],
      "/rec_ui/cvt_props": [],
      "/rec_ui/toplevel_entity": true
    }
  ]
]


$.each(json_examples, function(_,example) {
    var name = example[0]; var tree = example[1]; var expected = example[2];
    tests["test " + name] = function() {
        var entity = treeToEntity(tree);
        assertSubsetOf(entity, expected);
    }
})    

TestCase("json parsing", tests);