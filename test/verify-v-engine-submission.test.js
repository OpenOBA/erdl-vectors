/**
 * verify-v-engine-submission.test.js — expression-layer submission cross-verifier regression
 *
 * scripts/verify-v-engine-submission.mjs compares a third-party ER3 envelope against the answer oracle.
 * This round changed its comparison semantics (2026-09-10, "semantic equality, not byte equality"):
 *   - numbers: scale-14 fixed-point numeric equality (trailing-zero insensitive), not string-byte equality
 *   - strings: NFC-normalized before byte equality
 *   - E4 constraint vectors: `threw` must match
 * These tests pin each of those three behaviours by building a submission from the oracle, mutating one
 * dimension, and asserting the verifier accepts or rejects as expected.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'verify-v-engine-submission.mjs');
const ANSWERS = path.join(__dirname, '..', 'v-engine-answers.json');
const TMP = path.join(__dirname, '..', '.test-submission.tmp.json');

function buildSubmission({ tailZero = false, nfcDecompose = false, dropThrew = false } = {}) {
  const ans = JSON.parse(fs.readFileSync(ANSWERS, 'utf8'));
  const results = {};
  for (const [id, a] of Object.entries(ans)) {
    const r = { value: a.value, value_type: a.value_type, errored: a.errored, warnings: a.warnings || [] };
    if (a.threw !== undefined) r.threw = dropThrew ? undefined : a.threw;
    if (tailZero && a.value_type === 'number' && typeof a.value === 'string' && !a.value.includes('.')) {
      r.value = a.value + '.0'; // trailing-zero, numerically identical
    }
    if (nfcDecompose && a.value_type === 'string' && typeof a.value === 'string') {
      r.value = a.value.normalize('NFD'); // decomposed, NFC-equivalent
    }
    results[id] = r;
  }
  fs.writeFileSync(TMP, JSON.stringify({ layer: 'expression', results }, null, 2));
  return TMP;
}

function run() {
  return spawnSync(process.execPath, [SCRIPT, '--submission', TMP], { encoding: 'utf8', timeout: 60000 });
}

afterEach(() => {
  if (fs.existsSync(TMP)) fs.unlinkSync(TMP);
});

describe('verify-v-engine-submission.mjs (ER3/ER4 comparison semantics)', () => {
  it('accepts number trailing-zero differences (numeric equality, not byte equality)', () => {
    buildSubmission({ tailZero: true });
    const r = run();
    expect(r.status, 'stdout: ' + r.stdout + '\nstderr: ' + r.stderr).toBe(0);
    expect(r.stdout).toContain('240/240');
  });

  it('accepts string NFC-equivalent differences (NFC-normalized byte equality)', () => {
    buildSubmission({ nfcDecompose: true });
    const r = run();
    expect(r.status, 'stdout: ' + r.stdout + '\nstderr: ' + r.stderr).toBe(0);
    expect(r.stdout).toContain('240/240');
  });

  it('rejects an E4 vector missing `threw: true`', () => {
    buildSubmission({ dropThrew: true });
    const r = run();
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('threw');
    expect(r.stdout).not.toContain('240/240');
  });
});
