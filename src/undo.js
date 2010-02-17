/** @constructor */
function UndoStack() {
    this.internal_stack = [];
}

UndoStack.prototype.push = function(undoFunction) {
    this.internal_stack.push(undoFunction);
}

UndoStack.prototype.pop = function() {
    var undoFunction = this.internal_stack.pop();
    if (undoFunction)
        undoFunction();
}
