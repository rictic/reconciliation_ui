interface JQueryProgressBarOptions {
  value:number;
}

interface JQuery {
  tabs():JQuery; //initialize
  tabs(name:string, index:number):JQuery; //jump to tab
  progressbar(name:string, value:number):JQuery;
  progressbar(options:JQueryProgressBarOptions):JQuery;
  progressbar(name:string, option:string, value:number):JQuery;
  ajaxForm(options:Object):JQuery;
}
