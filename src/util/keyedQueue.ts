//A FIFO that holds each value at most once.
//KeyedQueue only stores values (numbers, booleans, strings, etc)
//override getKey to return a unique, identifying value to store non-values

// TODO(rictic): generics
class KeyedQueue extends EventEmitter {
  private _set = new PSet();
  private _array : any[] = [];

  peek(n?:number):any {
    n = n || 1;
    return this._array[n-1];
  }

  shift():any {
    var val = this._array.shift();
    this._set.remove(this.getKey(val));
    this.emit("changed");
    this.emit("removed", val);
    return val;
  }

  //adds to the end of the queue
  push(val:any):boolean {
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
  unshift(val:any):boolean {
    var key = this.getKey(val);
    if (this._set.contains(key))
        return false;
    this._set.add(key);
    this._array.unshift(val);
    this.emit("changed");
    this.emit("added", val);
    return true;
  }

  remove(val:any):any {
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

  getKey(val:any):any {
    return val;
  }

  size():number { return this._array.length; }
}

class EntityQueue extends KeyedQueue {
  getKey(entity:tEntity):number {
    return entity['/rec_ui/id'];
  }
}

