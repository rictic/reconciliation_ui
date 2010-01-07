function initializeReconciliation(callback) {
    function isUnreconciled(entity) {
        if (entity.isCVT())
            return false;
        return Arr.contains([undefined,null,"indeterminate",""], entity.id);
    }

    totalRecords = rows.length;
    var rec_partition = Arr.partition(rows,isUnreconciled);
    automaticQueue = rec_partition[0];
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
    if (entity["/rec_ui/toplevel_entity"]) {
        var autoQueueLength = automaticQueue.length;
        for (var i = 0; i < mqlProps.length; i++) {
            var values = entity.getChainedProperty(mqlProps[i]);
            for (var j = 0; j < values.length; j++) {
                if (values[j] && values[j]['/type/object/name'] != undefined){
                    if (!values[j].id)
                        automaticQueue.push(values[j]);
                    totalRecords++;
                }
            }
        }
        //The auto queue was empty when this started, so autorecon needs
        //to be restarted.
        if (autoQueueLength == 0)
            beginAutoReconciliation();
    }
}
