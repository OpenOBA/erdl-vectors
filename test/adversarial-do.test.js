/**
 * adversarial-do.test.js — per-vector reverse (adversarial) verification: tamper each self-consistent DO → hash must mismatch
 *
 * Covers all "self-consistent DOs" (those passing verifyDO) among the 78 V-DO-v15 vectors:
 *   - MATCH positives (D / C01 / G domain / V-COMP positives)
 *   - semantic BREACH single DOs (A02/A07~A10/F01/F03~F05/F08~F11, hash self-consistent + semantic violation)
 *   - base_do (base side of A hash-type / G structure-type / F02/F06/F07)
 *   - chain members (hash self-consistent members of C01 normal + C03~C08 structural attacks)
 *
 * The canary K01 (hash intentionally "wrong"), the C02 tampered member, and each tampered_do (already mismatched) are excluded.
 */
const { verifyDO } = require('../scripts/verify-v1.5.js');
const vectors = require('../decision-object-vectors-v1.5.json').vectors;

/** Tamper one non-hash core field (decision_id is resident and enters the preimage) */
function tamper(obj) {
  const t = JSON.parse(JSON.stringify(obj));
  t.decision_id = (t.decision_id || 'x') + '_TAMPERED';
  return t;
}

describe('reverse: tamper each self-consistent DO → hash must mismatch', () => {
  it('all verifyDO self-consistent DOs must mismatch after tampering decision_id', () => {
    let checked = 0;
    const per = (id, obj) => {
      if (!verifyDO(obj).passed) return; // test self-consistent DOs only
      expect(verifyDO(tamper(obj)).passed, `${id} should mismatch after tamper`).toBe(false);
      checked++;
    };
    vectors.forEach((v) => {
      if (v.decision_object) per(v.id, v.decision_object);
      if (v.base_do) per(`${v.id}-base`, v.base_do);
      if (v.chain) v.chain.forEach((d, i) => per(`${v.id}[${i}]`, d));
    });
    // self-consistent DOs should cover the vast majority (excluding K01 / C02 tampered member / tampered_do)
    expect(checked).toBeGreaterThan(50);
  });
});
