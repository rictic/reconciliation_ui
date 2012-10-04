declare interface JQueryDataTableFormat {
  aoColumns : any[];
  aaData : any[];
}

declare interface JQuery {
  dataTable(table:JQueryDataTableFormat):JQuery;
}
