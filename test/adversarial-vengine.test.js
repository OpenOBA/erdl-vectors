/**
 * adversarial-vengine.test.js — V-ENGINE reverse (adversarial) regression
 *
 * scripts/verify-v-engine-reverse.mjs tampers the literal per normal scenario (34 nodes),
 * the evaluation MUST change (a few commutative/boundary cases unchanged on tamper, threshold >=20).
 */
const { spawnSync } = require('child_process');
const path = require('path');

describe('V-ENGINE reverse (scripts/verify-v-engine-reverse.mjs)', () => {
  it('normal scenarios tamper literal per vector → detect diff (>=20)', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'verify-v-engine-reverse.mjs')],
      { encoding: 'utf8', timeout: 120000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('detected diff');
  });
});
