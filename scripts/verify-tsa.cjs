/**
 * verify-tsa.cjs — ERDL Decision Object v1.5 time-anchoring verifier (T-series, T01..T03).
 *
 * RFC-002 §9.5: verifies the timestamp_proof field of a signature-mode DO.
 *   T01: valid token → MATCH
 *   T02: DO.timestamp vs TSA anchored time drift > 60s → clock_drift_detected
 *   T03: critical decision (DELEGATE/ESCALATE/REQUEST_HUMAN) missing timestamp_proof → timestamp_anchor_missing
 *
 * MOCK: the timestamp token is verified against the published mock TSA public key
 * (not RFC 3161 X.509 chain). See mock-tsa.cjs.
 *
 * @license Apache-2.0
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { jcsCanonicalize } = require('./jcs.cjs');

const CRITICAL_DECISIONS = ['DELEGATE', 'ESCALATE', 'REQUEST_HUMAN'];
const CLOCK_DRIFT_THRESHOLD_MS = 60 * 1000; // 60s

/** Verify the DO signature (signature preimage = DO − signature − signing_key_id − timestamp_proof). */
function verifySignature(doObj, publicKeyPem) {
  const clone = JSON.parse(JSON.stringify(doObj));
  const signature = clone.signature;
  delete clone.signature;
  delete clone.signing_key_id;
  if (clone.audit) delete clone.audit.timestamp_proof;
  const canonical = jcsCanonicalize(clone);
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKeyPem, Buffer.from(signature, 'base64url'));
}

/** Verify a timestamp token over the anchored value (the DO signature) at a given time. */
function verifyToken(anchoredValue, time, token, tsaPublicKeyPem) {
  const hash = crypto.createHash('sha256').update(anchoredValue, 'utf8').digest('hex');
  const payload = { hash, time, tsa_id: 'mock-tsa-001' };
  const canonical = jcsCanonicalize(payload);
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), tsaPublicKeyPem, Buffer.from(token, 'base64url'));
}

/** Detect a single-DO time-anchoring breach (returns a breach code or null). */
function detectTsaBreach(doObj, publicKeyPem, tsaPublicKeyPem) {
  const decision = doObj.result && doObj.result.decision;
  const tp = doObj.audit && doObj.audit.timestamp_proof;

  // T03: critical decision missing timestamp_proof
  if (CRITICAL_DECISIONS.includes(decision) && !tp) {
    return 'timestamp_anchor_missing';
  }
  if (!tp) return null;

  // T02: clock drift — DO.timestamp vs TSA anchored time (requested_at)
  const doTime = new Date(doObj.timestamp).getTime();
  const tsaTime = new Date(tp.requested_at).getTime();
  if (Math.abs(doTime - tsaTime) > CLOCK_DRIFT_THRESHOLD_MS) {
    return 'clock_drift_detected';
  }

  // T01: the timestamp token must verify against the anchored field (the signature)
  const anchoredValue = doObj.signature;
  if (!verifyToken(anchoredValue, tp.requested_at, tp.token, tsaPublicKeyPem)) {
    return 'tsa_token_invalid';
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  const vectorsPath = args[0] || path.join(__dirname, '..', 'tsa-vectors-v1.5.json');
  const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));
  const publicKeyPem = data.test_public_key_pem;
  const tsaPublicKeyPem = data.test_tsa_public_key_pem;

  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.5 Time-Anchoring Verifier');
  console.log('  tsa_id: ' + data.tsa_id + ' · drift threshold: ' + data.clock_drift_threshold_seconds + 's');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let pass = 0, fail = 0;
  const errors = [];

  for (const v of data.vectors) {
    const doObj = v.decision_object;
    const sigOk = verifySignature(doObj, publicKeyPem);
    if (!sigOk) {
      fail++; errors.push(`${v.id}: signature invalid`);
      console.log(`  ✗ ${v.id}: signature invalid`);
      continue;
    }
    const breach = detectTsaBreach(doObj, publicKeyPem, tsaPublicKeyPem);
    const exp = v.expected || {};
    if (exp.type === 'VERIFY' && exp.verify === 'pass') {
      if (breach === null) { pass++; console.log(`  ✓ ${v.id}: valid timestamp token (verify pass)`); }
      else { fail++; errors.push(`${v.id}: unexpected breach ${breach}`); console.log(`  ✗ ${v.id}: unexpected breach ${breach}`); }
    } else if (exp.type === 'BREACH') {
      if (breach === exp.breach) { pass++; console.log(`  ✓ ${v.id}: ${breach}`); }
      else { fail++; errors.push(`${v.id}: expected ${exp.breach}, got ${breach}`); console.log(`  ✗ ${v.id}: expected ${exp.breach}, got ${breach}`); }
    }
  }

  console.log('');
  console.log(`  total: ${pass}/${pass + fail} passed`);
  if (errors.length) { console.log('  failures:'); errors.forEach((e) => console.log('    ✗ ' + e)); }
  console.log('');
  console.log(fail === 0 ? '  ✅ ALL TIME-ANCHORING VERIFICATIONS PASSED' : '  ❌ VERIFICATION FAILED');
  process.exit(fail === 0 ? 0 : 1);
}

if (require.main === module) main();

module.exports = { verifySignature, verifyToken, detectTsaBreach };
