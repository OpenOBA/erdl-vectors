/**
 * generate-v-engine.test.js — V-ENGINE generator regression (generate → per-vector recompute verify)
 *
 * After migrating in scripts/generate-v-engine.mjs, generate 223 vectors with the @openoba/erdl reference engine,
 * byte-identical with the committed v-engine-vectors.json (freshness gate).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('V-ENGINE generator (scripts/generate-v-engine.mjs)', () => {
  it('generates 223 and is byte-identical with the committed artifact', () => {
    const committed = fs.readFileSync(path.join(__dirname, '..', 'v-engine-vectors.json'), 'utf8');
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'generate-v-engine.mjs')],
      { encoding: 'utf8', timeout: 120000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('223');
    // after the generator's atomic write-back, the artifact must match the committed version (deterministic generation)
    const regenerated = fs.readFileSync(path.join(__dirname, '..', 'v-engine-vectors.json'), 'utf8');
    expect(regenerated).toBe(committed);
  });
});
