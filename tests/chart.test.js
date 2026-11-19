import test from 'node:test';
import assert from 'node:assert/strict';
import { chartWindow, chartHasOutOfRange, RECENT_EPOCHS } from '../chart.js';

test('recent timeline has a constant epoch span before and after scrolling', () => {
  assert.deepEqual(chartWindow(0,'recent'),{start:0,end:200});
  assert.deepEqual(chartWindow(180,'recent'),{start:0,end:200});
  assert.deepEqual(chartWindow(450,'recent'),{start:250,end:450});
  assert.equal(chartWindow(9999,'recent').end-chartWindow(9999,'recent').start,RECENT_EPOCHS);
  assert.deepEqual(chartWindow(450,'full'),{start:0,end:450});
});

test('out-of-range notices reflect visible values and fixed chosen limits', () => {
  const points=[{epoch:0,train:.7,test:1.2},{epoch:150,train:.4,test:.5},{epoch:250,train:.3,test:.4}];
  assert.equal(chartHasOutOfRange(points,['train','test'],0,200,0,1),true);
  assert.equal(chartHasOutOfRange(points,['train','test'],50,250,0,1),false);
  assert.equal(chartHasOutOfRange(points,['train','test'],0,200,0,2),false);
});
