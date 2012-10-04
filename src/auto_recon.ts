// ========================================================================
// Copyright (c) 2008-2009, Metaweb Technologies, Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY METAWEB TECHNOLOGIES AND CONTRIBUTORS
// ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL METAWEB
// TECHNOLOGIES OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
// INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
// OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
// USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
// DAMAGE.
// ========================================================================


/*
**  Automatic reconciliation
*/
var manualQueue;
var automaticQueue;

function beginAutoReconciliation() {
    $(".nowReconciling").show();
    $(".notReconciling").hide();
    $("#gettingInput").remove();
    autoReconcile();
}

var autoreconciling = false;
function finishedAutoReconciling() {
    $(".nowReconciling").hide();
    $('.notReconciling').show();
    autoreconciling = false;
}

function autoReconcile() {
    autoreconciling = true;
    if (automaticQueue.size() === 0) {
        finishedAutoReconciling();
        return;
    }

    var entity = automaticQueue.peek();
    if (entity.getID() !== undefined) {
        automaticQueue.shift();
        addTimeout(autoReconcile, 0);
        if (!internalReconciler.getRecGroup(entity).shouldMerge)
            addReviewItem(entity);
        return;
    }
    getCandidates(entity, autoReconcileResults, function(){
        automaticQueue.shift();
        autoReconcile();
    });
}


/** @param {tEntity} entity */
function autoReconcileResults(entity) {
    automaticQueue.remove(entity);
    // no results, set to None:
    if(entity.reconResults.length == 0) {
        if (!entity.typelessRecon) {
            getCandidates(entity,autoReconcileResults,
                function(){automaticQueue.shift();autoReconcile();},true);
        }

        // With Concorde we never know if we should automatically create,
        // everything should be reviewed by hand.
        manualQueue.push(entity);
        autoReconcile();
        return;
    }
    // match found:
    else if(entity.reconResults[0]["match"] == true) {
        var matchedResult = entity.reconResults[0];
        if (require_exact_name_match && !Arr.contains($.makeArray(entity['/type/object/name']),$.makeArray(matchedResult.name)[0]))
            manualQueue.push(entity);
        else {
            entity.reconcileWith(matchedResult.id, true);
            entity["/rec_ui/freebase_name"] = matchedResult.name;
            addColumnRecCases(entity);
        }
    }
    else
        manualQueue.push(entity)
    autoReconcile();
}
