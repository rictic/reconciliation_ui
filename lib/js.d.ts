// These are things missing from the built in javascript types.

interface Array<T> {
  slice():T[]; // called with zero arguments,
               // makes a shallow copy.
}

// TODO: remove this, it's not a good idea to use this.
declare var escape : (string)=>string;
