const terminal = new Set(['passed', 'failed', 'blocked', 'error', 'cancelled', 'interrupted']);

// Presentation only: interrupted snapshots remain authoritative and must never be rewritten.
export function recordedStepView(item) {
  return (item.steps || []).map(step => step.status === 'running' && terminal.has(item.status)
    ? {...step, status: 'interrupted', recordedStatus: 'running', interruptionReason: item.error || item.status}
    : step);
}
