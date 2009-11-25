function time() {
    return new Date().valueOf();
}

/** @constructor */
function Yielder() {
    this.startTime = time();
    this.shouldYield = function(continueFunction){
        if (time() <= this.startTime + 10)
            return false;
        
//         info("yielding to UI thread");
        this.startTime = time();
        this.nextAction = setTimeout(continueFunction, 10);
        return true;
    };
    this.cancel = function(){
        if (this.nextAction)
            clearTimeout(this.nextAction);
    };
}

/** @param {!Array} array
    @param {!function(number, *)} f
    @param {function()=} onComplete
    @param {Yielder=} yielder
*/
function politeEach(array, f, onComplete, yielder) {
    yielder = yielder || new Yielder();
    var index = 0;
    function iterate() {
        while(index < array.length) {
            f(index, array[index]);
            index++;
            if (yielder.shouldYield(iterate))
                return;
        }
        if (onComplete) onComplete();
    }
    iterate();
}
/** @param {!Array} array
    @param {!function(*)} f
    @param {!function(Array)} onComplete
    @param {Yielder=} yielder
*/
function politeMap(array, f, onComplete, yielder) {
    yielder = yielder || new Yielder();
    var result = [];
    politeEach(array, function(index, value) {
        result[index] = f(value);
    }, function() {onComplete(result);}, yielder);
}