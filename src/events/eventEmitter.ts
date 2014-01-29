class EventEmitter {
  private handlersByName = {};
  listeners(name:string) {
    this.handlersByName[name] = this.handlersByName[name] || [];
    return this.handlersByName[name];
  }
  addListener(name:string, handler:Function) {
    this.listeners(name).push(handler);
  }
  emit(name:string, ...args:any[]) {
    var listeners = this.listeners(name);
    for (var i = 0; i < listeners.length; i++) {
      listeners[i].apply(null, args);
    }
  }
}
