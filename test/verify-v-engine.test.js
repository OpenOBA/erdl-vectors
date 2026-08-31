/**
 * verify-v-engine.test.js — V-ENGINE independent verifier regression
 *
 * scripts/verify-v-engine.mjs is the independent reference implementation (second source, §48.2 dual-implementation generation),
 * not importing reference-engine source, independently recomputing "semantic-sensitive" vectors from the SPEC text (E2/E8/E10 + arithmetic/time/aggregate nodes).
 */
const { spawnSync } = require('child_process');
const path = require('path');

describe('V-ENGINE independent verifier (scripts/verify-v-engine.mjs)', () => {
  it('57 semantic-sensitive vectors independently recomputed consistent (exit 0)', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'verify-v-engine.mjs')],
      { encoding: 'utf8', timeout: 60000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('57');
  });
});
