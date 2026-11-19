// All computation runs locally in the browser. No machine-learning service is used.
// Spiral generator adapted from TensorFlow Playground, Copyright 2016 Google Inc.,
// licensed under Apache 2.0; see THIRD_PARTY_APACHE_LICENSE.txt. Modified for
// this application's binary labels, native JavaScript, and data management.
export const TRUE_SPIRAL = { rate: 0.7 * Math.PI, phase: 0 };
export const FEATURE_NAMES = ['x₁', 'x₂', 'x₁²', 'x₂²', 'x₁x₂', 'sin(x₁)', 'sin(x₂)'];
const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, x))));
const rand = (a, b) => a + Math.random() * (b - a);
export const features = (x, y) => [x / 5, y / 5, x*x / 25, y*y / 25, x*y / 25, Math.sin(x), Math.sin(y)];

export function makeData(kind, noise = 0, count = 400) {
  const points = [], n = Math.floor(count / 2);
  if (kind === 'spiral') {
    // Matches the upstream Playground's spiral formula, including Cartesian noise.
    for (const [offset, label] of [[0, 1], [Math.PI, 0]]) {
      for (let i = 0; i < n; i++) {
        const radius = i / n * 5, t = 1.75 * i / n * 2 * Math.PI + offset;
        points.push({x: radius * Math.sin(t) + rand(-1, 1) * noise,
          y: radius * Math.cos(t) + rand(-1, 1) * noise, label});
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const t = rand(0, 2 * Math.PI), r = Math.sqrt(Math.random());
      // Jitter is bounded so the two ellipses retain a visible gap.
      const jitter = () => rand(-1, 1) * Math.min(noise, 1) * 0.12;
      points.push({x: 2.65 * r * Math.cos(t) + jitter(), y: 1.55 * r * Math.sin(t) + jitter(), label: 1});
      const a = rand(0, 2 * Math.PI), outer = rand(1.35, 1.65);
      points.push({x: 2.65 * outer * Math.cos(a) + jitter(), y: 1.55 * outer * Math.sin(a) + jitter(), label: 0});
    }
  }
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [points[i], points[j]] = [points[j], points[i]];
  }
  return points;
}

function activation(z, type) {
  if (type === 'relu') return Math.max(0, z);
  if (type === 'sigmoid') return sigmoid(z);
  return z;
}
function derivative(z, type) {
  if (type === 'relu') return z > 0 ? 1 : 0;
  if (type === 'sigmoid') { const s = sigmoid(z); return s * (1 - s); }
  return 1;
}
const regGrad = (w, type, rate) => type === 'l1' ? rate * Math.sign(w) : type === 'l2' ? rate * w : 0;

export class Network {
  constructor(inputIndices, shape, activationType) {
    this.indices = inputIndices; this.shape = shape; this.activation = activationType;
    const sizes = [inputIndices.length, ...shape, 1];
    this.layers = sizes.slice(1).map((size, i) => ({
      weights: Array.from({length:size}, () => Array.from({length:sizes[i]}, () => rand(-1, 1) * Math.sqrt(2 / (sizes[i] + size)))),
      biases: Array(size).fill(0)
    }));
  }
  forward(x, y) {
    let values = this.indices.map(i => features(x, y)[i]);
    const acts = [values], zs = [];
    this.layers.forEach((layer, li) => {
      const z = layer.weights.map((weights, j) => layer.biases[j] + weights.reduce((s, w, i) => s + w * values[i], 0));
      values = z.map(v => li === this.layers.length - 1 ? sigmoid(v) : activation(v, this.activation));
      zs.push(z); acts.push(values);
    });
    return {p: values[0], acts, zs};
  }
  predict(x, y) { return this.forward(x, y).p; }
  train(batch, lr, regularization, rate) {
    const grads = this.layers.map(l => ({weights:l.weights.map(ws => ws.map(() => 0)), biases:l.biases.map(() => 0)}));
    for (const p of batch) {
      const {acts, zs} = this.forward(p.x, p.y); let delta = [acts.at(-1)[0] - p.label];
      for (let l = this.layers.length - 1; l >= 0; l--) {
        const layer = this.layers[l];
        for (let j = 0; j < delta.length; j++) {
          grads[l].biases[j] += delta[j];
          for (let i = 0; i < layer.weights[j].length; i++) grads[l].weights[j][i] += delta[j] * acts[l][i];
        }
        if (l > 0) delta = acts[l].map((_, i) => layer.weights.reduce((s, ws, j) => s + ws[i] * delta[j], 0) * derivative(zs[l-1][i], this.activation));
      }
    }
    this.layers.forEach((layer, l) => layer.weights.forEach((ws, j) => {
      layer.biases[j] -= lr * grads[l].biases[j] / batch.length;
      ws.forEach((w, i) => { ws[i] -= lr * (grads[l].weights[j][i] / batch.length + regGrad(w, regularization, rate)); });
    }));
  }
}

// x=r sin(theta), y=r cos(theta). The angular residual of a spiral is
// theta - k*r - phi. Its cosine separates the two arms, even across the angle wrap.
export class PhysicsSpiral {
  constructor() { this.rate = 3.2; this.phase = -2.4; this.phaseUnwrapped = this.phase; this.scale = 2; this.bias = 0; }
  predict(x, y) {
    const r = Math.hypot(x, y), theta = Math.atan2(x, y);
    return sigmoid(this.scale * Math.cos(theta - this.rate * r - this.phase) + this.bias);
  }
  train(batch, lr, regularization, regRate) {
    let dk = 0, dp = 0, ds = 0, db = 0;
    for (const p of batch) {
      const r = Math.hypot(p.x, p.y), theta = Math.atan2(p.x, p.y);
      const residual = theta - this.rate * r - this.phase;
      const c = Math.cos(residual), s = Math.sin(residual);
      const error = sigmoid(this.scale * c + this.bias) - p.label;
      dk += error * this.scale * s * r; dp += error * this.scale * s;
      ds += error * c; db += error;
    }
    const n = batch.length;
    this.rate -= lr * dk / n; this.phaseUnwrapped -= lr * dp / n;
    this.scale -= lr * (ds / n + regGrad(this.scale, regularization, regRate));
    this.bias -= lr * db / n;
    this.phase = Math.atan2(Math.sin(this.phaseUnwrapped), Math.cos(this.phaseUnwrapped));
  }
}

export function loss(model, data) {
  if (!data.length) return 0;
  return data.reduce((s, p) => { const q = Math.max(1e-9, Math.min(1-1e-9, model.predict(p.x, p.y))); return s - p.label * Math.log(q) - (1-p.label)*Math.log(1-q); }, 0) / data.length;
}
