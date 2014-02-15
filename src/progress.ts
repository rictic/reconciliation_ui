interface Progress {
  name : string;
  getPercent():number;
  addListener(eventName:"progress", handler:(percent:number)=>void):void;
  addListener(eventName:string, handler:(...args:any[])=>void):void;
}

// A placeholder for an eventual PromiseWithProgress
interface HasProgress {
  progress : Progress;
}

class QuickProgress extends EventEmitter implements Progress {
  private units_done = 0;
  private is_done = false;
  constructor(public name:string, public max:number) {
    super();
  }

  setProgress(progress:number) {
    this.units_done = progress;
  }

  increment(delta=1) {
    this.units_done += delta;
    this.progressChanged();
  }

  done() {
    this.is_done = true;
  }

  getPercent() {
    if (this.is_done) {
      return 1;
    }
    return Math.min(1, this.units_done / this.max);
  }

  private progressChanged() {
    this.emit('progress', this.getPercent());
  }
}

class WeightedMultiProgress extends EventEmitter implements Progress {
  private progresses : {p:Progress; weight:number}[] = [];
  private totalWeight = 0;
  constructor(public name:string, private expectedTotalWeight=1) {
    super();
  }

  getPercent():number {
    var percentSums = 0;
    this.progresses.forEach((p) => {
      percentSums += p.p.getPercent() * p.weight;
    });
    return percentSums / Math.max(this.totalWeight, this.expectedTotalWeight);
  }

  addSubProgress(progress:Progress, weight=1) {
    this.totalWeight += weight;
    this.progresses.push({p:progress, weight:weight});
    progress.addListener("progress", () => {this.progressChanged()});
    this.progressChanged();
  }

  private progressChanged() {
    this.emit('progress', this.getPercent());
  }
}
