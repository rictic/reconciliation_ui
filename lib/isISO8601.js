/**
 * 
 * Determine if a string is a valid ISO 8601 Date, Time, or Datetime
 *
 * yanked viciously out of mjt
 * 
 * parsing originally from dojo.date.serialize
 *
 * according to http://svn.dojotoolkit.org/src/trunk/LICENSE :
 *    Dojo is availble under *either* the terms of the modified BSD license *or* the
 *    Academic Free License version 2.1.
 * 
 * 
 * formatting from http://delete.me.uk/2005/03/iso8601.html
 * 
 *   "This code is available under the AFL. This should mean
 *    you can use it pretty much anyway you want."
 */

var isISO8601 = (function () {

var setIso8601 = function(/*Date*/dateObject, /*String*/formattedString){
        // summary: sets a Date object based on an ISO 8601 formatted string (uses date and time)
        var comps = (formattedString.indexOf("T") == -1) ? formattedString.split(" ") : formattedString.split("T");
        dateObject = setIso8601Date(dateObject, comps[0]);
        if(comps.length == 2){ dateObject = setIso8601Time(dateObject, comps[1]); }
        return dateObject; /* Date or null */
};

var fromIso8601 = function(/*String*/formattedString){
        // summary: returns a Date object based on an ISO 8601 formatted string (uses date and time)
        return setIso8601(new Date(0, 0), formattedString);
};

var setIso8601Date = function(/*String*/dateObject, /*String*/formattedString){
        // summary: sets a Date object based on an ISO 8601 formatted string (date only)
        var regexp = "^(-?[0-9]{4})((-?([0-9]{2})(-?([0-9]{2}))?)|" +
                        "(-?([0-9]{3}))|(-?W([0-9]{2})(-?([1-7]))?))?$";
        var d = formattedString.match(new RegExp(regexp));
        if(!d){
                return NaN;
        }
        var year = d[1];
        var month = d[4];
        var date = d[6];
        var dayofyear = d[8];
        var week = d[10];
        var dayofweek = d[12] || 1;

        dateObject.setFullYear(year);

        if(dayofyear){
                dateObject.setMonth(0);
                dateObject.setDate(Number(dayofyear));
        }
        else if(week){
                dateObject.setMonth(0);
                dateObject.setDate(1);
                var day = dateObject.getDay() || 7;
                var offset = Number(dayofweek) + (7 * Number(week));
        
                if(day <= 4){ dateObject.setDate(offset + 1 - day); }
                else{ dateObject.setDate(offset + 8 - day); }
        } else{
                if(month){
                        dateObject.setDate(1);
                        dateObject.setMonth(month - 1); 
                }
                if(date){ dateObject.setDate(date); }
        }

        return dateObject; // Date
};

var setIso8601Time = function(/*Date*/dateObject, /*String*/formattedString){
        // summary: sets a Date object based on an ISO 8601 formatted string (time only)

        // first strip timezone info from the end
        var timezone = "Z|(([-+])([0-9]{2})(:?([0-9]{2}))?)$";
        var d = formattedString.match(new RegExp(timezone));

        var offset = 0; // local time if no tz info
        if(d){
                if(d[0] != 'Z'){
                        offset = (Number(d[3]) * 60) + Number(d[5] || 0);
                        if(d[2] != '-'){ offset *= -1; }
                }
                offset -= dateObject.getTimezoneOffset();
                formattedString = formattedString.substr(0, formattedString.length - d[0].length);
        }

        // then work out the time
        var regexp = "^([0-9]{2})(:?([0-9]{2})(:?([0-9]{2})(\.([0-9]+))?)?)?$";
        d = formattedString.match(new RegExp(regexp));
        if(!d){
                return NaN;
        }
        var hours = d[1];
        var mins = Number(d[3] || 0);
        var secs = d[5] || 0;
        var ms = d[7] ? (Number("0." + d[7]) * 1000) : 0;

        dateObject.setHours(hours);
        dateObject.setMinutes(mins);
        dateObject.setSeconds(secs);
        dateObject.setMilliseconds(ms);

        if(offset !== 0){
                dateObject.setTime(dateObject.getTime() + offset * 60000);
        }       
        return dateObject; // Date
};

var fromIso8601Time = function(/*String*/formattedString){
        // summary: returns a Date object based on an ISO 8601 formatted string (date only)
        return setIso8601Time(new Date(0, 0), formattedString);
};

return function(s) {
    if (!isNaN(fromIso8601(s))) return true;
    return !isNaN(fromIso8601Time(s));
};
})();
