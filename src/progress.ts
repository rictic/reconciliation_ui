class QuickProgress {
  private units_done = 0;
  private is_done = false;
  constructor(private writeTo:Q.Deferred<any>, private max:number) {}

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
    this.writeTo.notify(this.getPercent());
  }
}

class WeightedMultiProgress {
  private progresses : {lastValue:number; weight:number}[] = [];
  private totalWeight = 0;
  constructor(private writeTo:Q.Deferred<any>, private expectedTotalWeight=1) {}

  getPercent():number {
    var percentSums = 0;
    this.progresses.forEach((p) => {
      percentSums += p.lastValue * p.weight;
    });
    return percentSums / Math.max(this.totalWeight, this.expectedTotalWeight);
  }

  addSubProgress(promise:Q.Promise<any>, weight=1) {
    this.totalWeight += weight;
    var subProgress = {lastValue:0, weight:weight};
    this.progresses.push(subProgress);
    promise.progress((pct:number) => {
      subProgress.lastValue = pct;
      this.progressChanged()
    });
    this.progressChanged();
  }

  private progressChanged() {
    this.writeTo.notify(this.getPercent());
  }
}

var d1 = Q.defer();
var p1 = new WeightedMultiProgress(d1);
