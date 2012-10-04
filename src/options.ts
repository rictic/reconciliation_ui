var require_exact_name_match = false;
var assert_naked_properties = false;

$(document).ready(function() {
  $("#optionsPanel input").each(function(idx, inputEl:Element):void {
    var valueKey = "value";
    var input = $(inputEl);
    if (input.attr('type') === 'checkbox'){
      valueKey = 'checked';
    }

    input.change(function() {
      window[input.attr('id')] = input.attr(valueKey);
    });

    //reflect their default values
    input.attr(valueKey, window[input.attr('id')]);
  });
});
