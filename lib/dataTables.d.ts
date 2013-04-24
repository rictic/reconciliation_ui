interface JQueryDataTableColumn {
  sTitle: string;
}

interface JQueryDataTableFormat {
  aoColumns : JQueryDataTableColumn[];
  aaData : string[][];
}

interface JQuery {
  dataTable(table:JQueryDataTableFormat):JQuery;
}
