interface JQueryProgressBarOptions {
  value:number;
}

interface JQuery {
  tabs(); //initialize
  tabs(name:string, index:number); //jump to tab
  progressbar(name:string, value:number);
  progressbar(options:JQueryProgressBarOptions);
  progressbar(name:string, option:string, value:number);
  ajaxForm(options:Object);
}

// this is core, but missing
interface JQueryStatic {
  ajaxSettings : JQueryAjaxSettings;
}
