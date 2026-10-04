/**
 * verify-signature.cjs — ERDL Decision Object v1.5 signature-layer verifier (V-SIGN).
 *
 * RFC-002 §10.3: V-SIGN-001..005. Verifies each signature-mode DO against the
 * published test public key (signing_key_id), honoring the signature preimage
 * (delete signature / signing_key_id, keep previous_signature, mode in preimage).
 *
 * A conforming verifier reads ONLY the vector file + this contract; no reference
 * generator, no answer file. The test public key is embedded in the vector file.
 *
 * @license Apache-2.0
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { jcsCanonicalize } = require('./jcs.cjs');

function verifySignature(doObj, publicKeyPem) {
  const clone = JSON.parse(JSON.stringify(doObj));
  const signature = clone.signature;
  delete clone.signature;
  delete clone.signing_key_id;
  // PIT-7: timestamp_proof is excluded from the signature preimage (time-anchors the signature).
  if (clone.audit) delete clone.audit.timestamp_proof;
  const canonical = jcsCanonicalize(clone);
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKeyPem, Buffer.from(signature, 'base64url'));
}

/** Chain traceback (V-SIGN-003): each DO's previous_signature MUST equal the previous DO's signature; first is null. */
function verifyChain(chain, publicKeyPem) {
  let prevSig = null;
  for (let i = 0; i < chain.length; i++) {
    const dobj = chain[i];
    if (!verifySignature(dobj, publicKeyPem)) return { pass: false, error: `chain[${i}] signature invalid` };
    if (i === 0) {
      if (dobj.audit.previous_signature !== null) return { pass: false, error: 'chain[0] previous_signature must be null' };
    } else {
      if (dobj.audit.previous_signature !== prevSig) return { pass: false, error: `chain[${i}] previous_signature does not match chain[${i - 1}].signature` };
    }
    prevSig = dobj.signature;
  }
  return { pass: true };
}

function main() {
  const args = process.argv.slice(2);
  const vectorsPath = args[0] || path.join(__dirname, '..', 'signature-vectors-v1.5.json');
  const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));
  const publicKeyPem = data.test_public_key_pem;

  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.5 Signature Verifier');
  console.log('  algorithm: ' + data.signature_algorithm);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let pass = 0, fail = 0;
  const errors = [];

  for (const v of data.vectors) {
    const exp = v.expected || {};
    if (v.decision_object) {
      const ok = verifySignature(v.decision_object, publicKeyPem);
      const wantPass = exp.verify === 'pass';
      if (ok === wantPass) { pass++; console.log(`  ✓ ${v.id}: ${ok ? 'verify pass' : 'verify fail'} (expected ${exp.verify})`); }
      else { fail++; errors.push(`${v.id}: verify ${ok} but expected ${exp.verify}`); console.log(`  ✗ ${v.id}: verify ${ok} but expected ${exp.verify}`); }
    } else if (v.base_do) {
      const baseOk = verifySignature(v.base_do, publicKeyPem);
      const tamOk = verifySignature(v.tampered_do, publicKeyPem);
      // V-SIGN-002: base self-consistent (verify pass) + tampered (verify fail)
      if (baseOk && !tamOk) { pass++; console.log(`  ✓ ${v.id}: base verify pass + tampered verify fail`); }
      else { fail++; errors.push(`${v.id}: base=${baseOk} tampered=${tamOk} (expected true/false)`); console.log(`  ✗ ${v.id}: base=${baseOk} tampered=${tamOk}`); }
    } else if (v.chain) {
      const r = verifyChain(v.chain, publicKeyPem);
      if (r.pass) { pass++; console.log(`  ✓ ${v.id}: chain traceback pass (${v.chain.length} DOs)`); }
      else { fail++; errors.push(`${v.id}: ${r.error}`); console.log(`  ✗ ${v.id}: ${r.error}`); }
    }
  }

  console.log('');
  console.log(`  total: ${pass}/${pass + fail} passed`);
  if (errors.length) { console.log('  failures:'); errors.forEach((e) => console.log('    ✗ ' + e)); }
  console.log('');
  console.log(fail === 0 ? '  ✅ ALL SIGNATURE VERIFICATIONS PASSED' : '  ❌ VERIFICATION FAILED');
  process.exit(fail === 0 ? 0 : 1);
}

if (require.main === module) main();

module.exports = { verifySignature, verifyChain };
