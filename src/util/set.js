/** @constructor 
  * @param {...*} var_args the initial elements of the set
  */
var Set = function(var_args) {
    var set = {};
    this.add = function(val) {set[val] = true;};
    this.addAll = function(array) {
        for(var i = 0; i < array.length; i++) 
            this.add(array[i]);
    }
    this.remove = function(val) {delete set[val]}
    this.contains = function(val) {return val in set;};
    //getAll only valid for 
    this.getAll = function() {var all = []; for (var val in set) all.push(val); return all;};
    this.addAll(arguments);
}
