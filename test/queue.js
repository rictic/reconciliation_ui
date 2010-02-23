var simple_films = "/type/object/name\t/type/object/type\t/film/film/directed_by\n" +
"Stolen Kisses\t/film/film\tFrançois Truffaut\n" +
"The Stoned Age\t/film/film\tJames Melkonian\n" +
"Stonewall\t/film/film\tNigel Finch\n"
;

var partially_reconciled = "/type/object/name\t/type/object/type\t/film/film/directed_by\tid\t/film/film/directed_by:id\n" +
"Stolen Kisses\t/film/film\tFrançois Truffaut\t/en/stolen_kisses\t\n" +
"The Stoned Age\t/film/film\tJames Melkonian\t\t\n" +
"Stonewall\t/film/film\tNigel Finch\t\t\n";

var error_sheet = 
"/type/object/name\t/type/object/type\t/award/award_nominee/award_nominations:/award/award_nomination/year\t/award/award_nominee/award_nominations:/award/award_nomination/award:id\t/award/award_nominee/award_nominations:/award/award_nomination/nominated_for_topic\tid\t/award/award_nominee/award_nominations:/award/award_nomination/nominated_for_topic:id\n" + 
"Clint Eastwood\t/award/award_nominee\t2008\t/en/bfca_critics_choice_award_for_best_composer\tChangeling\t/en/clint_eastwood\t";


TestCase("Test Reconciliation Queues",{
    "test initialization with simple films": function() {
        getToInitialization(simple_films);
        assertEq(3, automaticQueue.size());
    }
    ,"test initialization with partially reconciled simple films": function() {
        getToInitialization(partially_reconciled);
        assertEq(3, automaticQueue.size());
    }
    ,"test TOOL-105": function() {
        getToInitialization(error_sheet);
        assertEq(1, automaticQueue.size());
    }
});

function getToInitialization(spreadsheet) {
    justParseIt(spreadsheet);
    initializeReconciliation(function(){});
}