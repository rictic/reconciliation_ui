var require_exact_name_match = false;
var assert_naked_properties = false;

$(document).ready(function() {
    $("#optionsPanel input").each(function(idx, input) {
        var valueKey = "value";
        if (input.type === 'checkbox') 
            valueKey = 'checked';
        
        $(input).change(function() {
            window[input.id] = input[valueKey];
        });

        //reflect their default values
        input[valueKey] = window[input.id];
    });
});