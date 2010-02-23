TestCase("KeyedQueue",{
    "test FIFO": function() {
        var q = new KeyedQueue();
        var elements = [1000,"asdf", 7, true,45,"d872"];
        $.each(elements, function(_, element) {
            q.push(element);
        });

        var s = [];
        $.each(elements, function(_, element) {
            s.push(q.shift());
        }); 
        
        assertEq(elements, s);
    }
});

