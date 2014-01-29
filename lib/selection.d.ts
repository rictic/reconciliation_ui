declare class TSelection {
  constructor(node:Node);
  create():ISelection;
}

interface ISelection {
  start: number;
  end: number;
}
