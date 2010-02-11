/** @constructor */
function EventEmitter() {}

/** @param {!string} name
  * @param {!function()} handler
  */
EventEmitter.prototype.bind = function(name, handler) {
    this.handlers = this.handlers || {};
    this.handlers[name] = this.handlers[name] || [];
    this.handlers[name].push(handler);
}

/** @param {!string} name
  * @param {...} var_args
  */
EventEmitter.prototype.emit = function(name, var_args) {
    if (!(this.handlers && this.handlers[name])) return;
    var args = Array.prototype.slice.call(arguments, 1);
    $.each(this.handlers[name], function(_, handler) {
        handler(args);
    });
}
