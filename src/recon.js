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
    addColumnRecCases(entity);
    updateUnreconciledCount();
    manualReconcile();
}



/** @params {!tEntity} entity
  * 
  */
function addColumnRecCases(entity) {
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
}
