// Bounded, evenly decimated history. Epoch zero and the latest epoch are retained.
export class TrainingHistory {
  constructor(limit = 1200) { this.limit = Math.max(4, limit); this.reset(); }
  reset() { this.samples = []; this.latest = null; this.stride = 1; this.previousPhase = null; this.unwrappedPhase = null; }
  add(epoch, train, test, model = null) {
    let phase = null;
    if (model && Number.isFinite(model.phase)) {
      if (Number.isFinite(model.phaseUnwrapped)) this.unwrappedPhase = model.phaseUnwrapped;
      else if (this.previousPhase === null) this.unwrappedPhase = model.phase;
      else this.unwrappedPhase += Math.atan2(Math.sin(model.phase - this.previousPhase), Math.cos(model.phase - this.previousPhase));
      this.previousPhase = model.phase; phase = this.unwrappedPhase;
    }
    const point = { epoch, train, test, rate: model?.rate ?? null, phase };
    this.latest = point;
    if (epoch % this.stride === 0) this.samples.push(point);
    if (this.samples.length > this.limit) {
      this.stride *= 2;
      this.samples = this.samples.filter(sample => sample.epoch % this.stride === 0);
    }
  }
  points() {
    if (!this.latest) return [];
    return this.samples.at(-1)?.epoch === this.latest.epoch ? this.samples : [...this.samples, this.latest];
  }
  reviseLatest(train, test) {
    if (!this.latest) return;
    const revised = { ...this.latest, train, test };
    if (this.samples.at(-1)?.epoch === revised.epoch) this.samples[this.samples.length - 1] = revised;
    this.latest = revised;
  }
}
