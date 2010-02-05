var totalRecords = 0;

function isUnreconciled(entity) {
    if (entity.isCVT())
        return false;
    return Arr.contains([undefined,null,""], entity.id);
}

function initializeReconciliation(onReady) {
    totalRecords = rows.length;
    var rec_partition = Arr.partition(rows,isUnreconciled);
    automaticQueue = new AutomaticQueue(rec_partition[0]);
    politeEach(rec_partition[1],function(_,reconciled_row){
        reconciled_row['/rec_ui/rec_begun'] = true;
        addColumnRecCases(reconciled_row);
    }, function() {
        freebase.fetchTypeInfo(typesSeen.getAll(), function() {
            $(".initialLoadingMessage").hide();
            reconciliationBegun = true;
            onReady();
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
            //skip it if it's not an entity
            if (!(value instanceof tEntity))
                return;
            //skip it if it's already gone through the queue
            if (value['/rec_ui/rec_begun'])
                return;
            
            value['/rec_ui/rec_begun'] = true;
            if (isUnreconciled(value) && value['/type/object/name']) {
                automaticQueue.push(value);
            }
            else {
                //if we're not going to reconcile it, add its children
                //to be reconciled
                addColumnRecCases(value);
                return;
            }
            totalRecords++;
        });
    }
}
