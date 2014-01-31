
// HACK: make Edit this work?

(function($) {
  // preview requires 'a' tag with link to freebase
  $.fn.freebaseMiniTopicPreview = function() {
    return this.each(function() {
      var miniTopicNode = this;
      //var aNode = $('a', miniTopicNode);
      $('a',miniTopicNode).after(' <a href="#">[preview]</a> ');

      $('a:last',miniTopicNode)
        .click(runMiniTopicPreivew);

    });
  };

  function hidePreview() {
    var previewLink = this;
    var containerNode = previewLink.parentNode;
    $('.jqmWindow',containerNode).jqmHide();
  }

  function runMiniTopicPreivew() {
    var previewLink = this;
    var containerNode = previewLink.parentNode;

    if ( $('.jqmWindow',containerNode).length ) {
      $('.jqmWindow',containerNode).jqmShow(); //if the dialog has already been created then just show it
    } else {
      $(previewLink).after('<div class="jqmWindow"><div class="fbase-bm-window-header"><div id="fbase-bm-logo">Freebase</div><a href="" class="jqmClose">x</a></div><div class="fbase-bm-header">Add a Freebase MiniTopic to this Page</div><div>miniTopic goes here</div></div> ')

      var topciId = idFromHref(containerNode);
      $('div:contains(miniTopic goes here):last',containerNode).freebaseMiniTopic(topciId);
      $('.jqmWindow',containerNode).jqm().jqmShow();
    }

    return false; // don't follow link
  }

  $.fn.freebaseMiniTopic = function(fbaseId, callback) {
    return this.each(function() {
      var topicId = fbaseId || idFromHref(this);
      runMiniTopic(this,topicId, callback);
    });
  };

  function idFromHref(div) {
    var href = $('a',div)[0].href;
    var fbaseId = href.replace(/http:.+freebase\.com\/view\//,'');
    if (fbaseId.indexOf('/') != 0) { fbaseId = '/topic/en/'+fbaseId; }   // convert 'edinburgh' to '/topic/en/edinburgh'
    //TODO: put more robust ID tests here
    if (!fbaseId) { error(div,'Could not find Freebase Topic ID in url '+href); }
    return fbaseId;
  }

  function error(div,message) {
    $(div).append( '<div style="color:red;">Error: '+message+'</div>');
  }

  /*************/
  /* AJAX part */
  /*************/

  function runMiniTopic(miniTopicDiv,topicId, onComplete) {

    var json = getQuery(topicId);

    freebase.mqlReadQueries(
      json,
      function(response) {mqlread_cb(response); if (onComplete) onComplete(topicId);}
    )

    function mqlread_cb(response) {
      if (response.code != '/api/status/ok') { error(miniTopicDiv,'Freebase error: mqlread failed'); return; }
      if (!response.q1.result) { error(miniTopicDiv,'mqlread: empty result'); return; }
      var summary = processResult(response.q1);
      var html = makeHtml(response.q1,summary);
      $(miniTopicDiv).html(html);
      doBlurb(response.q1);
    }

    function doBlurb(query) {
      var articles = $.map(
      query.result['/type/reflect/any_master'],
      function(m) {
        if (m.link.master_property.id=='/common/topic/article') { return m;}
      });

      if (articles.length) {
        var article_id = articles[0].id;
        freebase.getBlurb(article_id, {maxlength: 300}, blurb_cb)
      } else {
        //miniTopicReady();
      }
    }

    function blurb_cb(response) {
        var text = response.result.body;     //TODO: deal with error codes
        $('.fbase-mt-desc',miniTopicDiv).text(text);
        //miniTopicReady();
    }
  }

  function getQuery(topicId) {
    return {
       "q1": {
         "query": {
           "/type/reflect/any_master":[{
             "id":null,
             "link":{"master_property":{"id":null,"name":null}},
             "name":null,
             "optional":true
           }],
           "/type/reflect/any_reverse":[{
            "id":null,
            "link":{"master_property":{ "reverse_property":{"id":null,"name":null}}},
            "name":null,
            "optional":true
          }],
          "/type/reflect/any_value":[{
            "link":{"master_property":{"id":null,"name":null}},
            "value":null,
            "optional":true
          }],
          "id":topicId,
          "name":null,
          "type":[]
        }
      }
    };
  }

  /*********************/
  /* Data manipulation */
  /*********************/

  function processResult(query) {
    // convert the complex response into 3 lists of { name, id, label }

    //  { /type/reflect/any_value[].link.master_property. name,value } --> [ {label,name} ]
    // NB: We cheat here and call the value 'name' so that values can be treated the same as reverses or masters
    var values = $.map(
      query.result['/type/reflect/any_value'],
      function(m) {
        if (!isBoring(m.link.master_property.id)) {
          return {label:m.link.master_property.name, name:m.value};
        } else { return undefined; }
      }
    );

    // { /type/reflect/any_reverse[]. name, id, link.master_property.reverse_property.name --> [ {name, id, label} ]
    var reverses = $.map(
      query.result['/type/reflect/any_reverse'],
      function(m) {
        if (m.name && !isBoring(m.link.master_property.reverse_property.id)) { // some of the reverse links don't store the name, just the id of the topic. Eg. Spouse
          return {name:m.name, id:m.id, label:m.link.master_property.reverse_property.name};
        } else { return undefined; }
      });

      // { /type/reflect/any_master[]. name, id, link.master_property.name } --> [ { name, id, label } ]
      var masters = $.map(
        query.result['/type/reflect/any_master'],
        function(m) {
          if (!isBoring(m.link.master_property.id)) {
            return {name:m.name, id:m.id, label:m.link.master_property.name};
          } else { return undefined; }
        }
      );

    var summary={};
    var all = masters.concat(reverses,values); // add values and reverses into masters.

    $.each(all,function() {shove(summary,this.label,this) }); // group by label N.B. assume labels are unique!
    return summary;
  }

  // is this a boring property?
  function isBoring(typeId) {
    if (typeId.indexOf('/type/object/') == 0) { return true; } // permission & type
    if (typeId.indexOf('/common/topic') == 0) { return true; } // alias, image, article, web links
    return false;
  }

  // enables array['not existing yet'].push(val);
  function shove(array,prop,val) {
    if (!array[prop]) { array[prop] = []; } //initalise
    array[prop].push(val);
  }


  /*******************************/
  /*        HTML Generation      */
  /*******************************/
  function makeHtml(query,summary) {
    var h=[]; // html

    h[h.length]='<div class="fbase-mt-box">';
    h[h.length]='<div class="fbase-mt-tag">freebase</div>';

    doImage(h,query);

    h[h.length]='<div class="fbase-mt-body">';
    h[h.length]='<div class="fbase-mt-head"><a href="http://www.freebase.com/view/'+query.result.id+'" class="fbase-mt-link">'+query.result.name+'</a></div>';
    h[h.length]='<div class="fbase-mt-desc"></div>'; // blurb is loaded later
    h[h.length]='</div>';

    doPlist(h,summary);

    doNav(h,query.result.id);

    var html=h.join('');
    return html;
  }

  function doLink(topic) {
    var h=[];
    h[h.length]='<span class="fbase-mt-value">';
    if (topic.id) { h[h.length] = '<a class="fbase-mt-link" href="http://www.freebase.com/view/'+topic.id+'">'+topic.name+'</a>'; }
    else          { h[h.length] = topic.name; } // (.value is renamed .name)
    h[h.length]='</span>'
    return h.join('');
  }

  function doPlist(h,summary) {
    var MAX_CHARS = 100 - 3;
    var MAX_ENTRIES = 10;
    var entries=0;
    h[h.length]='<div class="fbase-mt-plist">';
    $.each(summary, function(label) {
        entries++;
        if (entries>MAX_ENTRIES) { return; }
        h[h.length] = '<div class="fbase-mt-prop">';
        h[h.length] = '<span class="fbase-mt-name">'+ label +'</span>';
        var len=label.length;
        var trimmed = $.map(this, function(topic) { len += (''+topic.name).length+1; if (len<MAX_CHARS) { return topic; } } )
        h[h.length] = $.map(trimmed, doLink).join(', ');
        var missing = this.length - trimmed.length;
        if (missing) { h[h.length] = '...'; }
        h[h.length] = '</div>'; // end fbase-mt-prop
    });
    h[h.length]='</div>'; // end fbase-mt-plist
  }

  function doImage(h,query) {
    var images = $.map(query.result['/type/reflect/any_master'], function(m) { if (m.link.master_property.id=='/common/topic/image') { return m;} } );
    if (images.length) {
        var image_id = images[0].id;
        var image_title = images[0].name || 'Image of ???'; //TODO: use topic name
        h[h.length]='<div class="fbase-mt-imgframe">';
        h[h.length]='<img src="' + freebase.imageUrl(image_id, {maxwidth:100, maxheight:4096}) + '" alt="'+image_title+'" title="'+image_title+'" border="0" class="fbase-mt-img" />';
        h[h.length]='</div>';
    }
    // else ??
  }

  function doNav(h,id) {
    h[h.length]='<div class="fbase-mt-nav">';
    h[h.length]='<a onclick="return (function(link) {window.freebase_link=link; var e = document.createElement(\'script\'); e.src=\'http://mqlx.com/bookmarklets/miniTopic/loaders/load_iframe_editor.js\'; document.body.appendChild(e); return false; })(this);" href="http://www.freebase.com/view/'+id+'" class="fbase-mt-link">Edit This!</a> ';
    h[h.length]='<a href="http://www.freebase.com/view/'+id+'" class="fbase-mt-link">More on Freebase &raquo;</a>';
    h[h.length]='</div>'; //end fbase-mt-nav
    h[h.length]='</div>'; //end fbase-mt-box
  }

  // WILL: TODO: modify query so I can get name of topic
  //function getEnglishName(result) {
  //return result.name.USE GREP!( function(name) {return name.lang=='/lang/en'})[0].value;
  //}

})(jQuery);
