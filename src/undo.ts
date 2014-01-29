interface UndoFunction {
  ():void;
}

class UndoStack {
  internal_stack : UndoFunction[] = [];

  push(undoFunction:UndoFunction) {
    this.internal_stack.push(undoFunction);
  }

  pop() {
    var undoFunction = this.internal_stack.pop();
    if (undoFunction)
      undoFunction();
  }
}
