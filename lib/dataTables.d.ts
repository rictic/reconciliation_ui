interface JQueryDataTableFormat {
  aoColumns : any[];
  aaData : any[];
}

interface JQuery {
  dataTable(table:JQueryDataTableFormat):JQuery;
}
