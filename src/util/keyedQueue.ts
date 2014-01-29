//A FIFO that holds each value at most once.
//KeyedQueue only stores values (numbers, booleans, strings, etc)
//override getKey to return a unique, identifying value to store non-values

class KeyedQueue extends EventEmitter {
  private _set = new PSet();
  private _array = [];

  peek(n) {
    n = n || 1;
    return this._array[n-1];
  }

  shift() {
    var val = this._array.shift();
    this._set.remove(this.getKey(val));
    this.emit("changed");
    this.emit("removed", val);
    return val;
  }

  //adds to the end of the queue
  push(val) {
    var key = this.getKey(val);
    if (this._set.contains(key))
        return false;
    this._set.add(key);
    this._array.push(val);
    this.emit("changed");
    this.emit("added", val);
    return true;
  }

  //adds to the front of the queue
  unshift(val) {
    var key = this.getKey(val);
    if (this._set.contains(key))
        return false;
    this._set.add(key);
    this._array.unshift(val);
    this.emit("changed");
    this.emit("added", val);
    return true;
  }

  remove(val) {
    var key = this.getKey(val);
    if (!this._set.contains(key))
        return undefined;

    //remove the value with matching key from the array by simply walking it
    var getKey = this.getKey;
    this._array = Arr.removeOneMatching(this._array, function(array_val) {
        return getKey(array_val) === key;
    });

    this._set.remove(key);

    this.emit("changed");
    this.emit("removed", val);
    return val;
  }

  getKey(val) {
    return val;
  }

  size() { return this._array.length; }
}

class EntityQueue extends KeyedQueue {
  getKey(entity) {
    return entity['/rec_ui/id'];
  }
}

