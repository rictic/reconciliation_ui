//define and test our testing helpers

function pass() {
    assertTrue(true);
}

function assertEq(msg, a1, a2) {
    if (arguments.length == 2){
        a2 = a1;
        a1 = msg;
        msg = "";
    }
        
    var message = areNotEq(a1,a2);
    if (message)
        fail(msg + " " + message);
    else
        pass();
}

function areNotEq(a1,a2){
    if (a1 == a2) return;
    if ($.isArray(a1) || $.isArray(a2)){
        if (!($.isArray(a1) && $.isArray(a2)))
            return "one is an array, the other isn't: " + a1 + " " + a2;

        if (a1.length != a2.length) return "lengths of arrays were different: " + a1 + " " + a2;
        for (var i = 0; i < a1.length; i++){
            var message = areNotEq(a1[i], a2[i]);
            if (message)
                return i + "th value different in arrays: " + message;
        }
        return;
    }
    if (typeof a1 != typeof a2) return "differently typed: " + a1 + " " + a2;
    if (typeof a1 != "object")
        return "Expected " + a1 + " but got " + a2;
    
    if ("equals" in a1)
        if (a1.equals(a2))
            return;
        else
            return "Expected " + a1 + " but got " + a2;
    
    for (var prop in a1){
        var message = areNotEq(a1[prop],a2[prop]);
        if (message)
            return a1 + " and " + a2 + " differ in prop `" + prop + "': " + message;
    }
    for (var prop in a2){
        var message = areNotEq(a1[prop],a2[prop]);
        if (message)
            return a1 + " and " + a2 + " differ in prop `" + prop + "': " + message;
    }
}

function Yielder() {
	return {shouldYield: function(){return false;}}
}


TestCase("MetaTest",{
    testIntEq: function() {
        assertEq("one is one",1,1);
    },
    testStringEq: function() {
        assertEq("'a' is 'a'",'a','a');
    },
    testBooleanEq: function() {
        assertEq("true is true",true,true);
        assertEq("false is false",false,false);
    },
    testArrayEq: function() {
        assertEq("empty list is empty list",[],[]);
        assertEq("[1,2,3] is [1,2,3]",[1,2,3],[1,2,3]);
    },
    testObjEq:function() {
        assertEq("{} is {}",{},{});
        assertEq("{a:1} is {a:1}",{a:1},{a:1});
        assertEq("{a:[1,2,3]} is {a:[1,2,3]}",{a:[1,2,3]},{a:[1,2,3]});
    }
});

