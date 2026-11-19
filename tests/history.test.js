import test from 'node:test';
import assert from 'node:assert/strict';
import { TrainingHistory } from '../history.js';
import { PhysicsSpiral } from '../model.js';

test('history begins at epoch zero, spans long runs, and resets', () => {
  const history = new TrainingHistory(32);
  for(let epoch=0;epoch<=5000;epoch++) history.add(epoch, 1/(epoch+1), 2/(epoch+1));
  const points = history.points();
  assert.equal(points[0].epoch,0);
  assert.equal(points.at(-1).epoch,5000);
  assert.ok(points.length <= 33);
  assert.ok(points.some(p=>p.epoch > 300 && p.epoch < 4700));
  assert.ok(points.every((p,i)=>i===0 || p.epoch>points[i-1].epoch));
  history.reset();
  assert.deepEqual(history.points(), []);
  history.add(0,.5,.6);
  assert.equal(history.points()[0].epoch,0);
});

test('phase history follows the continuous value across wrapping', () => {
  const history = new TrainingHistory(), model = new PhysicsSpiral();
  model.phase=3.0;model.phaseUnwrapped=3.0;history.add(0,.8,.8,model);
  model.phase=-3.0;model.phaseUnwrapped=2*Math.PI-3.0;history.add(1,.7,.7,model);
  assert.ok(Math.abs(history.points()[1].phase-(2*Math.PI-3))<1e-12);
  model.phase=-2.0;model.phaseUnwrapped=4*Math.PI-2;history.add(2,.6,.6,model);
  assert.ok(Math.abs(history.points()[2].phase-(4*Math.PI-2))<1e-12);
});

test('the spiral model starts far from the generating parameters', () => {
  const model = new PhysicsSpiral();
  assert.equal(model.rate,3.2);
  assert.equal(model.phase,-2.4);
  assert.equal(model.phaseUnwrapped,model.phase);
});

test('manual edits revise the current loss point without adding an epoch', () => {
  const history=new TrainingHistory(8);
  for(let epoch=0;epoch<=21;epoch++) history.add(epoch,.5,.6);
  history.reviseLatest(12,11);
  const points=history.points();
  assert.equal(points.at(-1).epoch,21);
  assert.equal(points.at(-1).train,12);
  assert.equal(points.at(-1).test,11);
  assert.equal(points.filter(p=>p.epoch===21).length,1);
});
