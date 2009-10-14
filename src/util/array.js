/* Convenient functions for handling arrays */
var Arr = (function() {
    var Arr = {};
    Arr.difference = function(source, toRemove) {
        source = $.makeArray(source); toRemove = $.makeArray(toRemove);
        var result = [];
        $.each(source, function(_,val){
            if (!Arr.contains(toRemove,val))
                result.push(val);
        })
        return result;
    }

    Arr.union = function(a, b) {
        a = $.makeArray(a); b = $.makeArray(b);
        var result = [];
        $.each(a, function(_,val) {
            if (Arr.contains(b,val))
                result.push(val);
        });
        return result;
    }

    Arr.removeAt = function(a, i) {
        assert(i >= 0);
        assert(i <= a.length);
        return a.slice(0,i).concat(a.slice(i+1));
    }

    //Is value in array?
    Arr.contains = function(array, value) {
        return $.inArray(value, array) !== -1;
    }

    /* Returns a copy of the array with those elements of that
      don't satisfy the predicate filtered out*/
    Arr.filter = function(array, predicate) {
        return $.grep(array, predicate);
    }

    /* Returns two new arrays, the first with those elements that satisfy the 
      predicate, the second with those that don't */
    Arr.partition = function(array, predicate) {
        var good = [];
        var bad = [];
        $.each(array, function(i, val) {
            if (predicate(val))
                good.push(val);
            else
                bad.push(val);
        });
        return [good,bad];
    }

    Arr.all = function(array, predicate) {
        if (!predicate) predicate = identity;
        for (var i = 0; i < array.length; i++)
            if (!predicate(array[i]))
                return false;
        return true;
    }

    Arr.any = function(array, predicate) {
        if (!predicate) predicate = identity;
        for (var i = 0; i < array.length; i++)
            if (predicate(array[i]))
                return true;
        return false;
    }

    Arr.none = function(array, predicate) {
        return !Arr.any(array,predicate);
    }

    Arr.unique = function(array) {
        var lookup = {};
        var result = [];
        for (var i = 0; i < array.length; i++) {
            var val = array[i];
            if (lookup[val])
                continue;
            lookup[val] = true;
            result.push(val);
        }
        return result;
    }

    Arr.concat = function(arrays) {
        var result = [];
        $.each(arrays, function(_,array) {
            result = result.concat(array);
        });
        return result;
    }

    Arr.concatMap = function(array, f) {
        return Arr.concat($.map(array,f));
    }
    
    return Arr;
})();
