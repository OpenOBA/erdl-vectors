/**
 * verify-v-engine-full.test.js — V-ENGINE full 227-vector verification regression
 *
 * scripts/verify-v-engine-full.mjs evaluates per vector with the @openoba/erdl reference engine
 * v-engine-vectors.json (34 nodes × 4 scenarios + E1-E12 constraints + Simple + gloss + projection).
 */
const { spawnSync } = require('child_process');
const path = require('path');

describe('V-ENGINE full verifier (scripts/verify-v-engine-full.mjs)', () => {
  it('227 vectors full recompute consistent (exit 0)', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'verify-v-engine-full.mjs')],
      { encoding: 'utf8', timeout: 120000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('227/227');
  });
});
