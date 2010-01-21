function initializeReconciliation(callback) {
    function isUnreconciled(entity) {
        if (entity.isCVT())
            return false;
        return Arr.contains([undefined,null,"indeterminate",""], entity.id);
    }

    totalRecords = rows.length;
    var rec_partition = Arr.partition(rows,isUnreconciled);
    automaticQueue = new AutomaticQueue(rec_partition[0]);
    politeEach(rec_partition[1],function(_,reconciled_row){
        addColumnRecCases(reconciled_row);
    }, function() {
        freebase.fetchTypeInfo(typesSeen.getAll(), function() {
            $(".initialLoadingMessage").hide();
            log(entities[0].toJSON());
            callback();
        });
    });
}

function handleReconChoice(entity,freebaseId) {
    delete manualQueue[entity["/rec_ui/id"]];
    $("#manualReconcile" + entity['/rec_ui/id']).remove();
    entity.reconcileWith(freebaseId, false);
    canonicalizeFreebaseId(entity);
    addColumnRecCases(entity);
    updateUnreconciledCount();
    manualReconcile();
}


function canonicalizeFreebaseId(entity) {
    var envelope = {query:{"myId:id":entity.id, "id":null}}
    freebase.mqlRead(envelope, function(results){
        if (results && results.result && results.result.id)
            entity.id = results.result.id
    });
}

/** @params {!tEntity} entity
  * 
  */
function addColumnRecCases(entity) {
    var autoQueueLength = automaticQueue.length;
    for (var key in entity) {
        var values = $.makeArray(entity[key]);
        $.each(values, function(_, value) {
            if (value instanceof tEntity) {
                if (!value['/rec_ui/rec_begun']) {
                    if (value.isCVT()) {
                        value['/rec_ui/rec_begun'] = true;
                        addColumnRecCases(value);
                        return;
                    }
                    if (!value.id && value['/type/object/name'])
                        automaticQueue.push(value);
                    totalRecords++;
                }
            }
        });
    }
    
    //The auto queue was empty when this started, so autorecon needs
    //to be restarted.
    if (autoQueueLength == 0)
        beginAutoReconciliation();
}
