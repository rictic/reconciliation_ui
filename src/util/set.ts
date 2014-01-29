/** @constructor
  * @param {...*} var_args the initial elements of the set
  */
class PSet {
  private set = {};
  add(val: string) {
    this.set[val] = true;
  }
  addAll(vals) {
    for(var i = 0; i < vals.length; i++)
      this.add(vals[i]);
  }
  remove(val: string) {delete this.set[val];}
  contains(val: string) {return val in this.set;}
  getAll() {
    var all = [];
    for (var val in this.set) all.push(val);
    return all;
  }
  constructor(...args:string[]) {
    this.addAll(args);
  }
}
