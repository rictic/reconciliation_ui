/* A collection of utilities for assorted bits of UI functionality*/

//Useful for handling events on rapidly changing input elements,
/* Returns a function that calls `every()` each time it is called,
   but only calls `rarely()` at most once per `timeout` milliseconds. 
*/
function throttler(every, rarely, timeout) {
    timeout = timeout || 250;
    var waiter = null;
    var againAfterWaiting = false;
    return function() {
        every();
        if (waiter === null) {
            rarely();
            waiter = setTimeout(function() {
                waiter = null;
                if (againAfterWaiting)
                    rarely();
                againAfterWaiting = false;
            }, timeout);
        }
        else
            againAfterWaiting = true;
    }
}

/* Adds insertAtCaret function to jQuery objects, to insert text where the caret is in
  a textarea */
$.fn.insertAtCaret = function (myValue) {
	return this.each(function(){
			//IE support
			if (document.selection) {
					this.focus();
					sel = document.selection.createRange();
					sel.text = myValue;
					this.focus();
			}
			//MOZILLA / NETSCAPE support
			else if (this.selectionStart || this.selectionStart == '0') {
					var startPos = this.selectionStart;
					var endPos = this.selectionEnd;
					var scrollTop = this.scrollTop;
					this.value = this.value.substring(0, startPos)+ myValue+ this.value.substring(endPos,this.value.length);
					this.focus();
					this.selectionStart = startPos + myValue.length;
					this.selectionEnd = startPos + myValue.length;
					this.scrollTop = scrollTop;
			} else {
					this.value += myValue;
					this.focus();
			}
	});
};

/* Groups a list of complex properties into a hierarchy 
   that is fit for display in a fancy table.
   
   See also: buildTableHeaders below
*/
function groupProperties(complexProps) {
    var groupedProps = new OrderedMap();
    function groupProp(complexProp, map) {
        var props = complexProp.split(":");
        if (props.length === 1){
            map.setIfAbsent(complexProp,new OrderedMap());
            return;
        }
        
        var innerMap = map.setIfAbsent(props.shift(), new OrderedMap());
        groupProp(props.join(":"), innerMap);
    }
    $.each(complexProps, function(_,complexProp){groupProp(complexProp,groupedProps)});
    groupedProps.getPropsForRows = function() {
        return Arr.union(this.getComplexProperties(), complexProps);
    }
    return groupedProps;
}

/* Given some grouped properties, returns a thead element with
   one or more rows to form the header for a fancy table.
*/
function buildTableHeaders(groupedProps) {
    var rows = [];
    function forcePush(idx, val) {
        rows[idx] = rows[idx] || [];
        rows[idx].push(val);
    }
    function header(value, columnspan) {
        return node("th",value,{colspan:columnspan});
    }
    function padTo(idx,amt) {
        rows[idx] = rows[idx] || [];
        var currentPadding = 0;
        $.each(rows[idx],function(_,header) {
            currentPadding += header.attr('colspan');
        });
        var amtToPad = amt - currentPadding;
        if (amtToPad > 0)
            rows[idx].push(header("",amt - currentPadding));
    }
    function buildHeaders(group, prop) {
        var innerGroup = group.get(prop);
        var innerProps = innerGroup.getProperties();
        if (innerProps.length === 0) {
            forcePush(0, header(getPropName(prop),1));
            return [0,1];
        }
        var maxDepth = -1;
        var totalBredth = 0;
        $.each(innerProps, function(_,innerProp) {
            var depthBredth = buildHeaders(innerGroup, innerProp);
            maxDepth = Math.max(depthBredth[0], maxDepth);
            totalBredth += depthBredth[1];
        });
        padTo(maxDepth+1, rows[0].length-totalBredth);
        rows[maxDepth+1].push(header(getPropName(prop),totalBredth));
        return [maxDepth+1,totalBredth];
    }
    $.each(groupedProps.getProperties(), function(_,prop) {buildHeaders(groupedProps,prop);});
    var tableHeader = node("thead");
    for (var i = rows.length-1; i >= 0; i--) {
        var row = rows[i];
        var tr = node("tr");
        $.each(row,function(_,header){
            tr.append(header);
            if (i > 0 && header.html() != "")
                header.addClass("upperHeader")
            if (i == 0)
                header.addClass("bottomHeader");
        });
        tableHeader.append(tr);
    }
    return tableHeader;
}

/* Given a complex property, return the human name of its last segment
    if known, or the property itself if not
*/
function getPropName(complexProp) {
    if (complexProp.charAt(0) !== "/")
        return complexProp;
    var props = complexProp.split(":");
    var prop = props[props.length-1];
    if (freebase.getPropMetadata(prop) && freebase.getPropMetadata(prop).name)
        return freebase.getPropMetadata(prop).name;
    return complexProp;
}

/* Returns the best html representation of `value` it can.

   If the given item is associated with a freebase topic, it's linked to.
   If it's an array, then an html tree will be returned, though it will be
   wrapped up so that only a few items are visible initially, with the 
   ability to expand the list out.
*/
function displayValue(value) {
    if ($.isArray(value))
        return wrapForOverflow($.map(value, displayValue));
    if (value == undefined || value == null)
        return "";
    if (value.displayValue)
        return value.displayValue()
    if (value.id != undefined && value.id != "None"){
        if ($.isArray(value.name))
            return displayValue($.map($.makeArray(value.name),function(name){return {name:name,id:value.id};}));
        return freebase.link(value.name,value.id);
    }
    return textValue(value);
}

/* Returns the best string representation of `value` it can.*/
function textValue(value) {
    if ($.isArray(value))
        return "[" + $.map(value, textValue).join(", ") + "]";
    if (value == undefined || value == null)
        return "";
    if (typeof value === "object"){
        var result = value['/type/object/name'];
        if ($.isArray(result)) result = result[0];
        return textValue(result);
    }
    return value;
}

/* `elementArray` is an array of html nodes which are wrapped in a single
    div, of which at most about `cutoff` are initially visible, and
    a control is rendered to enable the user to expand the list out. 
*/
function wrapForOverflow(elementArray, cutoff) {
    var result = node("div")
    cutoff = cutoff || 3;
    if (elementArray.length > cutoff+1){
        for (var i = 0; i < cutoff; i++)
            result.append(elementArray[i]).append("<br>");
        var overflowContainer = node("div", {"class":"overflowContainer"}).appendTo(result);
        for (var i = cutoff; i < elementArray.length; i++)
            overflowContainer.append(elementArray[i]).append("<br>");
        var showMoreLink = node("a",
                                "More &darr;",
                                {"class":"expandOverflow",
                                 onclick:function(){showMoreLink.slideUp();overflowContainer.slideDown();}})
                          .appendTo(result);
    }
    else
        for (var i = 0; i < elementArray.length; i++)
            result.append(elementArray[i]).append("<br>");
    return result;
}
