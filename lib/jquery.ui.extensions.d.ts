interface JQueryProgressBarOptions {
  value:number;
}

interface JQuery {
  progressbar(name:string, value:number):JQuery;
  progressbar(options:JQueryProgressBarOptions):JQuery;
  progressbar(name:string, option:string, value:number):JQuery;
  ajaxForm(options:Object):JQuery;
}
