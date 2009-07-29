function time() {
    return new Date().valueOf();
}

function Yielder() {
    this.startTime = time();
    this.shouldYield = function(continueFunction){
        if (time() <= this.startTime + 50)
            return false;
        
        info("yielding to UI thread");
        this.startTime = time();
        this.nextAction = setTimeout(continueFunction, 0);
        return true;
    };
    this.cancel = function(){
        if (this.nextAction)
            clearTimeout(this.nextAction);
    };
}

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

function politeMap(array, f, onComplete, yielder) {
    yielder = yielder || new Yielder();
    var result = [];
    politeEach(array, function(index, value) {
        result[index] = f(index,value);
    }, function() {onComplete(result);}, yielder);
}