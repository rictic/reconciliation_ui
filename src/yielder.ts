/** Wrapper function for setTimeout.  Todo: add error handling
  * @param {function()} f
  * @param {number} millis
  */
function addTimeout(f:()=>void, millis:number) {
    return setTimeout(f,millis,"JavaScript");
}

function addInterval(f:()=>void, millis:number) {
    return setInterval(f,millis,"JavaScript");
}

function time() {
    return new Date().valueOf();
}

/** @constructor */
class Yielder {
  private startTime = time();
  private isCancelled = false;
  private nextAction : number= null;
  shouldYield(continueFunction:()=>void):boolean {
    if (this.isCancelled)
      return true;
    if (time() <= this.startTime + 10)
      return false;

    // info("yielding to UI thread");
    this.startTime = time();
    this.nextAction = addTimeout(continueFunction, 10);
    return true;
  }

  cancel() {
    if (this.nextAction)
      clearTimeout(this.nextAction);
    this.isCancelled = true;
  }
}


function politeEach<T>(array: T[], f:(i:number, val:T)=>any,
                       onComplete?:()=>any, yielder?:Yielder):Tracker<{}> {
  yielder = yielder || new Yielder();
  var progress = new QuickProgress("politeEach", array.length);
  var deferred = Q.defer<{}>();
  if (onComplete) deferred.promise.then(onComplete);
  var tracker = {progress:progress, promise:deferred.promise};
  var index = 0;
  function iterate() {
    while(index < array.length) {
      f(index, array[index]);
      index++;
      progress.increment();
      if (yielder.shouldYield(iterate)) {
        return tracker;
      }
    }
    deferred.resolve(null);
    progress.done();
    return tracker;
  }
  return iterate();
}

/** @param {!Array} array
    @param {!function(*)} f
    @param {!function(!Array)} onComplete
    @param {Yielder=} yielder
*/
function politeMap<T,V>(array: T[], f:(val:T)=>V,
                   onComplete?:(mapped:V[])=>any,
                   yielder?:Yielder):Tracker<V[]> {
  yielder = yielder || new Yielder();
  var result : V[] = [];
  var deferred = Q.defer<V[]>();
  deferred.promise.then(onComplete);
  var tracker = politeEach(array, function(index, value) {
    result[index] = f(value);
  }, null, yielder);
  tracker.promise.then(() => {
    deferred.resolve(result);
  });
  return {progress:tracker.progress, promise:deferred.promise};
}
