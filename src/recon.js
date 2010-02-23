var totalRecords = 0;
var reconUndoStack;

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
        addReviewItem(reconciled_row, "previously");
        addColumnRecCases(reconciled_row);
    }, function() {
        freebase.fetchTypeInfo(typesSeen.getAll(), function() {
            $(".initialLoadingMessage").hide();
            reconciliationBegun = true;
            reconUndoStack = new UndoStack()
            if (inputType === "JSON")
                $("input.outputFormat[value='json']").attr("checked","checked").change()
            onReady();
        });
    });
}

function handleReconChoice(entity,freebaseId) {
    delete manualQueue[entity["/rec_ui/id"]];
    $("#manualReconcile" + entity['/rec_ui/id']).remove();
    reconUndoStack.push(getReconciliationUndo(entity))
    entity.reconcileWith(freebaseId, false);
    addColumnRecCases(entity);
    updateUnreconciledCount();
    manualReconcile();
}

function getReconciliationUndo(entity) {
    //simple, stupid first pass: unreconcile the entity completely
    return function() {
        entity.unreconcile();
        displayReconChoices(entity['/rec_ui/id']);
        manualQueue[entity['/rec_ui/id']] = entity;
        updateUnreconciledCount();
    }
}

function undoReconciliation() {
    reconUndoStack.pop();
}

/** @param {!tEntity} entity
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
