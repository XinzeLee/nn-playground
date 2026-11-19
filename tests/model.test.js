import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, PhysicsSpiral, TRUE_SPIRAL, makeData, loss } from '../model.js';

test('spiral uses the original two-arm generating equation', () => {
  const data = makeData('spiral', 0, 400);
  assert.equal(data.length, 400);
  for (const p of data) {
    const r = Math.hypot(p.x, p.y);
    if (r < 1e-9) continue;
    const angle = Math.atan2(p.x, p.y);
    const expected = TRUE_SPIRAL.rate * r + (p.label ? 0 : Math.PI);
    assert.ok(Math.abs(Math.sin((angle - expected) / 2)) < 1e-10);
  }
});

test('ellipse and surrounding ribbon stay separated at supported noise levels', () => {
  const data = makeData('ellipse', 1, 400);
  const radius = p => Math.hypot(p.x / 2.65, p.y / 1.55);
  const inner = Math.max(...data.filter(p => p.label).map(radius));
  const outer = Math.min(...data.filter(p => !p.label).map(radius));
  assert.ok(inner < outer, `${inner} must be less than ${outer}`);
});

test('physics model learns the spiral rate and phase from data', () => {
  const data = makeData('spiral', 0, 400), model = new PhysicsSpiral();
  const initial = loss(model, data);
  for (let epoch=0; epoch<1000; epoch++) model.train(data, .03, 'none', 0);
  assert.ok(loss(model, data) < initial * .2);
  assert.ok(Math.abs(model.rate - TRUE_SPIRAL.rate) < Math.abs(3.2 - TRUE_SPIRAL.rate));
  assert.ok(Math.abs(model.phase - TRUE_SPIRAL.phase) < 2.4);
});

test('ordinary model trains with zero to three hidden layers and all activations', () => {
  const data = makeData('ellipse', 0, 100);
  for (const shape of [[],[1],[8,3],[2,2,2]]) for (const act of ['relu','sigmoid','linear']) {
    const model = new Network([0,1], shape, act);
    const start = loss(model, data);
    for (let i=0;i<120;i++) model.train(data,.03,'none',0);
    assert.ok(Number.isFinite(loss(model, data)));
    assert.ok(loss(model, data) <= start + 1e-9, `${shape}, ${act}`);
  }
});

test('L1 and L2 regularization change weights but do not penalize biases', () => {
  const data = [{x:0, y:0, label:1}];
  for (const reg of ['l1','l2']) {
    const model = new Network([0,1], [], 'linear');
    model.layers[0].weights[0] = [0.5, -0.25]; model.layers[0].biases[0] = 0;
    model.train(data, .1, reg, .2);
    assert.ok(model.layers[0].weights[0][0] < .5);
    assert.ok(model.layers[0].weights[0][1] > -.25);
    assert.ok(Math.abs(model.layers[0].biases[0] - .05) < 1e-12);
  }
});
