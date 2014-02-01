/// <reference path="../lib/dataTables.d.ts"/>
/// <reference path="../lib/jquery.d.ts"/>
/// <reference path="../lib/jqueryui.d.ts"/>
/// <reference path="../lib/jsobjdump.d.ts"/>
/// <reference path="../lib/gapi.d.ts"/>
/// <reference path="../lib/jquery.freebase.minitopic.d.ts"/>
/// <reference path="../lib/jquery.ui.extensions.d.ts"/>
/// <reference path="../lib/selection.d.ts"/>
/// <reference path="../lib/isISO8601.d.ts"/>
/// <reference path="../lib/jquery.freebase.suggest.d.ts"/>
/// <reference path="../lib/js.d.ts"/>
/// <reference path="../lib/bootstrap/js/bootstrap.d.ts"/>

/// <reference path="events/eventEmitter.ts"/>
/// <reference path="util/set.ts"/>
/// <reference path="yielder.ts"/>
/// <reference path="utility.ts"/>
/// <reference path="util/keyedQueue.ts"/>
/// <reference path="util/array.ts"/>
/// <reference path="util/ui.ts"/>
/// <reference path="auto_recon.ts"/>
/// <reference path="manual_recon.ts"/>
/// <reference path="recon.ts"/>
/// <reference path="input.ts"/>
/// <reference path="review.ts"/>
/// <reference path="superfreeq.ts"/>
/// <reference path="output.ts"/>
/// <reference path="undo.ts"/>
/// <reference path="entity.ts"/>
/// <reference path="path.ts"/>
/// <reference path="freebase.ts"/>
/// <reference path="options.ts"/>
/// <reference path="internalReconciler.ts"/>
/// <reference path="ui.ts"/>

var debugMode : boolean = false;

if (window.location.hostname.match(/plunder/)) {
  node('script', {'src': 'lib/live.js'}).appendTo(document.body);
  debugMode = true;

  setTimeout(function() {
    $('button')[0].click()
    setTimeout(function() {
      $('button.continue').click();
      setTimeout(function() {
        $('#tabs ul li a[href="#spreadsheetRender"]').click()
      }, 100)
    }, 2000);
  }, 400);
}
