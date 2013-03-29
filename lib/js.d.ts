// These are things missing from the built in javascript types.

interface Array {
  slice():any[]; // called with zero arguments, shallow copy of array.
}

var escape : (string)=>string;
