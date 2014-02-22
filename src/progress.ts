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

class WeightedMultiProgress<T> {
  private progresses : {lastValue:number; weight:number}[] = [];
  private totalWeight = 0;
  public writeTo = Q.defer<T>();
  constructor(private expectedTotalWeight=1) {}

  getPercent():number {
    var percentSums = 0;
    this.progresses.forEach((p) => {
      percentSums += p.lastValue * p.weight;
    });
    return percentSums / Math.max(this.totalWeight, this.expectedTotalWeight);
  }

  track<U>(promise:Q.Promise<U>, weight=1):Q.Promise<U> {
    this.totalWeight += weight;
    if (this.totalWeight > this.expectedTotalWeight) {
      console.error('expected weight', this.expectedTotalWeight, 'got', this.totalWeight);
    }
    var subProgress = {lastValue:0, weight:weight};
    var index = this.progresses.length;
    this.progresses.push(subProgress);
    var movedBackwards = false;
    promise.progress((pct:number) => {
      if (pct < subProgress.lastValue) {
        if (!movedBackwards) {
          promise.then((result) => {
            console.error('backwards moving progress resolved to ', result);
          });
        }
        movedBackwards = true;
        console.error('index ' + index + ' tried to move progress backwards');
        return;
      }
      subProgress.lastValue = pct;
      this.progressChanged();
    });
    promise.then(() => {
      subProgress.lastValue = 1;
      this.progressChanged();
    });
    this.progressChanged();

    var d = Q.defer<U>();
    promise.then((r) => d.resolve(r), (r) => d.reject(r));
    return d.promise;
  }

  trackFinal(promise:Q.Promise<T>, weight=1):Q.Promise<T> {
    this.track(promise, weight);
    promise.then((r) => this.writeTo.resolve(r), (r) => this.writeTo.reject(r));
    return this.writeTo.promise;
  }

  private progressChanged() {
    this.writeTo.notify(this.getPercent());
  }
}
