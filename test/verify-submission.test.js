/**
 * verify-submission.test.js — cross-verification reference map tests
 *
 * buildReferenceMap recomputes the reference canonical_hex for every applicable DO
 * (mirroring the answer-file keying + version gate). This is the reference the CI
 * compares a third-party runner's submission against.
 */
const { buildReferenceMap } = require('../scripts/verify-submission.cjs');
const { verifyDO } = require('../scripts/verify-v1.5.js');
const fs = require('fs');
const path = require('path');

const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'decision-object-vectors-v1.5.json'), 'utf8'),
);

describe('buildReferenceMap (cross-verification reference)', () => {
  it('produces 107 canonical keys for the 78-vector hash layer', () => {
    const map = buildReferenceMap(vectors.vectors);
    expect(Object.keys(map).length).toBe(107);
  });

  it('excludes version-gated DOs (C07[1] unsupported preimage_version)', () => {
    const map = buildReferenceMap(vectors.vectors);
    expect(map['V-DO-v15-C07[0]']).toBeDefined();
    expect(map['V-DO-v15-C07[1]']).toBeUndefined();
  });

  it('all canonical_hex values are lowercase hex (hex of canonical string, variable length)', () => {
    const map = buildReferenceMap(vectors.vectors);
    for (const [k, v] of Object.entries(map)) {
      expect(v, k).toMatch(/^[0-9a-f]+$/);
      expect(v.length % 2, k).toBe(0);
    }
  });

  it('K01 canonical_hex equals verifyDO recomputation (correct preimage)', () => {
    const map = buildReferenceMap(vectors.vectors);
    const k01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-K01');
    expect(map['V-DO-v15-K01']).toBe(verifyDO(k01.decision_object).canonicalHex);
  });

  it('is byte-stable across two calls (deterministic)', () => {
    const a = buildReferenceMap(vectors.vectors);
    const b = buildReferenceMap(vectors.vectors);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
