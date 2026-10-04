/**
 * generate-tsa.cjs — ERDL Decision Object v1.5 time-anchoring vectors (T-series, T01..T03).
 *
 * RFC-002 §9.5: T-series anchors a signature-mode DO's timestamp via a third-party
 * timestamp token. The timestamp_proof field is { tsa_id, token, anchored_field, requested_at }.
 *
 * MOCK simplification (documented): the timestamp token anchors the DO's signature, and
 * `timestamp_proof` is added AFTER signing (so it is NOT in the signature preimage in the
 * mock — the RFC-002 §10.1 "timestamp_proof 进签名原像" full semantics is a follow-up).
 *
 * T01: valid token (verify passes).
 * T02: clock drift (DO.timestamp vs TSA time > 60s → clock_drift_detected).
 * T03: critical decision (DELEGATE) missing timestamp_proof → timestamp_anchor_missing.
 *
 * @license Apache-2.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildSignatureDO, KEYS } = require('./generate-signature.cjs');
const { TSA_ID, TSA_PUBLIC_KEY_PEM, createToken } = require('./mock-tsa.cjs');

function buildTsaDO(o) {
  const doObj = buildSignatureDO({ ...o, keys: KEYS });
  // The signature is already computed; anchor it with a timestamp token.
  const requestedAt = o.requestedAt || doObj.timestamp;
  const token = createToken(doObj.signature, requestedAt);
  doObj.audit.timestamp_proof = {
    tsa_id: TSA_ID,
    token,
    anchored_field: 'signature',
    requested_at: requestedAt,
  };
  return doObj;
}

function main() {
  const vectors = [];

  // T01: valid timestamp token (verify passes)
  {
    const doObj = buildTsaDO({ decisionType: 'ALLOW', context: { operation: 'read' }, chainId: 'chain-tsa-001', chainSeq: 0 });
    vectors.push({ id: 'V-DO-v15-T01', category: 'T', scenario: 'tsa-token-valid', description: 'Valid TSA timestamp token (timestamp_proof complete and valid)', decision_object: doObj, expected: { type: 'VERIFY', verify: 'pass' } });
  }

  // T02: clock drift (DO.timestamp vs TSA time drift > 60s)
  {
    const doObj = buildTsaDO({ decisionType: 'ALLOW', context: { operation: 'read' }, chainId: 'chain-tsa-002', chainSeq: 0, timestamp: '2026-08-22T00:00:00.000Z', requestedAt: '2026-08-22T00:05:00.000Z' });
    vectors.push({ id: 'V-DO-v15-T02', category: 'T', scenario: 'clock-drift', description: 'Clock drift: DO.timestamp vs TSA anchored time drift > 60s', decision_object: doObj, expected: { type: 'BREACH', breach: 'clock_drift_detected' } });
  }

  // T03: critical decision (DELEGATE) missing timestamp_proof
  {
    const doObj = buildSignatureDO({ keys: KEYS, decisionType: 'DELEGATE', context: { operation: 'read' }, chainId: 'chain-tsa-003', chainSeq: 0 });
    // NO timestamp_proof added — a critical decision without time anchor.
    vectors.push({ id: 'V-DO-v15-T03', category: 'T', scenario: 'missing-anchor', description: 'Critical decision (DELEGATE) missing timestamp_proof', decision_object: doObj, expected: { type: 'BREACH', breach: 'timestamp_anchor_missing' } });
  }

  const output = {
    spec: 'decision-object-v1.5-signature',
    preimage_version: 'erdl-do-v1.5-hash-flat',
    signature_algorithm: 'Ed25519 (RFC 8032 / FIPS 186-5, PureEdDSA)',
    test_public_key_pem: KEYS.publicKeyPem,
    tsa_id: TSA_ID,
    tsa_declaration: 'MOCK Time-Stamp Authority (simplified, not RFC 3161 wire-compatible; full X.509/RFC 3161 integration is a follow-up)',
    test_tsa_public_key_pem: TSA_PUBLIC_KEY_PEM,
    clock_drift_threshold_seconds: 60,
    vectors,
  };

  const outPath = path.join(__dirname, '..', 'tsa-vectors-v1.5.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`generated ${vectors.length} TSA vectors → ${outPath}`);
}

if (require.main === module) main();

module.exports = { buildTsaDO };
