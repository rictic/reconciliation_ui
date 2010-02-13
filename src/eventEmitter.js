/** @constructor */
function EventEmitter() {}

/** @param {!string} name
  * @param {!function()} handler
  */
EventEmitter.prototype.addListener = function(name, handler) {
    this.listeners(name).push(handler);
}

EventEmitter.prototype.listeners = function(name) {
    this.handlers = this.handlers || {};
    this.handlers[name] = this.handlers[name] || [];
    return this.handlers[name];
}

/** @param {!string} name
  * @param {...} var_args
  */
EventEmitter.prototype.emit = function(name, var_args) {
    var args = Array.prototype.slice.call(arguments, 1);
    $.each(this.listeners(name), function(_, handler) {
        handler.apply(null, args);
    });
}
