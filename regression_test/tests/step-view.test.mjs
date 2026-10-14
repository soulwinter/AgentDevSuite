import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedStepView} from '../record_store/step-view.mjs';

test('terminal timeout shows interrupted nested steps without modifying historical evidence', () => {
  const item = {status: 'error', error: 'Case timeout', steps: [
    {name: 'action', status: 'passed', durationMs: 30},
    {name: 'cleanup', status: 'running'},
    {name: 'restore', status: 'running', depth: 1},
  ]};
  const original = JSON.stringify(item);
  const rows = recordedStepView(item);
  assert.deepEqual(rows.map(s => s.status), ['passed', 'interrupted', 'interrupted']);
  assert.equal(rows[1].recordedStatus, 'running');
  assert.equal(rows[1].interruptionReason, 'Case timeout');
  assert.equal(rows[1].durationMs, undefined);
  assert.equal(JSON.stringify(item), original);
});

test('live and pending cases retain running steps; cancellation never implies cleanup success', () => {
  for (const status of ['running', 'pending', undefined]) assert.equal(recordedStepView({status, steps: [{status: 'running'}]})[0].status, 'running');
  assert.equal(recordedStepView({status: 'cancelled', steps: [{status: 'running'}]})[0].status, 'interrupted');
  assert.deepEqual(recordedStepView({status: 'blocked'}), []);
});
