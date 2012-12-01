/* Convenient functions for handling arrays */
module Arr {
  /** @param {!Array} source
      @param {!Array} toRemove
      @return {!Array}
  */
  export function difference(source, toRemove) {
      source = $.makeArray(source); toRemove = $.makeArray(toRemove);
      var result = [];
      $.each(source, function(_,val){
          if (!Arr.contains(toRemove,val))
              result.push(val);
      })
      return result;
  }

  /** @param {!Array} a
      @param {!Array} b
      @return {!Array}
  */
  export function union(a, b) {
      a = $.makeArray(a); b = $.makeArray(b);
      var result = [];
      $.each(a, function(_,val) {
          if (Arr.contains(b,val))
              result.push(val);
      });
      return result;
  }

  /** @param {!Array} a
      @param {!number} i
  */
  export function removeAt(a, i) {
      // assert(i >= 0, "Arr.removeAt i>=0");
      // assert(i <= a.length, "Arr.removeAt i<=a.length");
      return a.slice(0,i).concat(a.slice(i+1));
  }

  export function removeOneMatching(a, p) {
      for (var i = 0; i < a.length; i++) {
          if (p(a[i]))
              return Arr.removeAt(a,i);
      }
      return a;
  }

  /** Is value in array?
    * @param {!Array} array
    * @param {*} value
    * @return {!boolean}
    */
  export function contains(array, value) {
      return $.inArray(value, array) !== -1;
  }

  /* Returns a copy of the array with those elements of that
   * don't satisfy the predicate filtered out
   *
   * @param {!Array} array
   * @param {!function(*):boolean} predicate
   * @return {!Array}
   */
  export function filter(array, predicate) {
      return $.grep(array, predicate);
  }

  /** Returns two new arrays, the first with those elements that satisfy the
    * predicate, the second with those that don't
    *
    * @param {!Array} array
    * @param {!function(*):boolean} predicate
    * @return {!Array.<!Array>}
  */
  export function partition(array, predicate) {
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

  /**
    * @param {!Array} array
    * @param {!function(*):boolean=} predicate
    * @return {!boolean}
    */
  export function all(array, predicate) {
      if (!predicate) predicate = identity;
      for (var i = 0; i < array.length; i++)
          if (!predicate(array[i]))
              return false;
      return true;
  }

  /**
    * @param {!Array} array
    * @param {function()=} predicate
    * @return {!boolean}
    */
  export function any(array, predicate) {
      if (!predicate) predicate = identity;
      for (var i = 0; i < array.length; i++)
          if (predicate(array[i]))
              return true;
      return false;
  }

  /**
    * @param {!Array} array
    * @param {!function(*):boolean=} predicate
    * @return {!boolean}
    */
  export function none(array, predicate) {
      return !Arr.any(array,predicate);
  }

  /**
    * @param {!Array} array
    * @return {!Array}
    */
  export function unique(array) {
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

  /**
    * @param {!Array} arrays
    * @return {!Array}
    */
  export function concat(arrays) {
      var result = [];
      $.each(arrays, function(_,array) {
          result = result.concat(array);
      });
      return result;
  }

  /**
    * @param {!Array} array
    * @param {!function(*):Array} f
    * @return {!Array}
    */
  export function concatMap(array, f) {
      return Arr.concat($.map(array,f));
  }
}
