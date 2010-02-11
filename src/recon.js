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
    automaticQueue.bind("changed", function() {
        var pctProgress = (((totalRecords - automaticQueue.length) / totalRecords) * 100);
        $("#progressbar").progressbar("value", pctProgress);
        $("#progressbar label").html(pctProgress.toFixed(1) + "%");

        //restarts the queue if something is added to it after autorecon seems finished
        if (reconciliationBegun && !autoreconciling)
            autoReconcile();
    })
    politeEach(rec_partition[1],function(_,reconciled_row){
        reconciled_row['/rec_ui/rec_begun'] = true;
        addReviewItem(reconciled_row, "previously");
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
    updateManualUnreconciledCount();
    manualReconcile();
}



/** @param {!tEntity} entity
  * 
  */
function addColumnRecCases(entity) {
    if (!automaticQueue) return;
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
