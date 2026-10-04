/**
 * generate-signature.cjs — ERDL Decision Object v1.5 signature-layer vectors (V-SIGN).
 *
 * RFC-002 §10: three-tier evidence system. Layer 2 = Ed25519 signature chain
 * (RFC 8032 / FIPS 186-5, PureEdDSA — signs the JCS bytes directly, no pre-hash).
 *
 * Signature preimage (RFC-002 §10.1):
 *   signature(n) = Ed25519_Sign(private_key, JCS( DO(n) − signature − signing_key_id ))
 *
 * PIT-1..6 (RFC-002 §10.3) are honored here:
 *   PIT-1  delete `signature` (self-reference)
 *   PIT-2  delete `signing_key_id` (key rotation must not change the signature)
 *   PIT-3  keep `previous_signature` in the preimage (chain break detectable)
 *   PIT-4  keep first `previous_signature: null` in JCS
 *   PIT-5  signature mode physically omits audit.hash / previous_hash / commitment
 *   PIT-6  `audit.mode` stays in the preimage (mode tamper breaks the signature)
 *
 * The test key pair is PUBLIC (private key published, for vector verification only,
 * strictly forbidden for production signing — RFC-002 §10.3).
 *
 * @license Apache-2.0
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { jcsCanonicalize } = require('./jcs.cjs');

const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';

// ── Ed25519 test key pair (PUBLIC — vector verification only, never production) ──
// Fixed test keys (RFC-002 §10.3 "public test key pair"): the private key is published
// so any independent verifier can reproduce the signatures. Strictly forbidden for production.
const FIXED_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA7eZBRNJWKQdFBa7jvgG5sotxqqUq8gc91czQVYNx5g0=\n-----END PUBLIC KEY-----`;
const FIXED_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIG7pUDsMjD22qCJNl/ZVjip6y3mvGpH8KwUDGUR16ntZ\n-----END PRIVATE KEY-----`;

const KEYS = { publicKeyPem: FIXED_PUBLIC_KEY_PEM, privateKeyPem: FIXED_PRIVATE_KEY_PEM };

/**
 * Sign a DO: signature = Ed25519_Sign(privateKey, JCS(DO − signature − signing_key_id)).
 */
function signDO(doObj, privateKeyPem) {
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.signature;
  delete clone.signing_key_id;
  const canonical = jcsCanonicalize(clone);
  const sig = crypto.sign(null, Buffer.from(canonical, 'utf8'), privateKeyPem);
  return sig.toString('base64url');
}

/** Verify a DO signature against a public key. */
function verifySignature(doObj, publicKeyPem) {
  const clone = JSON.parse(JSON.stringify(doObj));
  const signature = clone.signature;
  delete clone.signature;
  delete clone.signing_key_id;
  const canonical = jcsCanonicalize(clone);
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKeyPem, Buffer.from(signature, 'base64url'));
}

// ── build a signature-mode DO (same CORE/JURISDICTION shape as hash mode, audit switches mode) ──
function buildSignatureDO(o) {
  const { publicKeyPem, privateKeyPem } = o.keys;
  const agent = { id: o.agentId || 'did:erdl:sha256:test-runner-v1.5', role: 'guardian', version: 'v1.5.0' };
  const policies = (o.rules || []).map((r, i) => ({
    id: r.id || `policy-${String(i + 1).padStart(3, '0')}`,
    name: r.name || `Policy ${i + 1}`,
    when: r.when || {},
    then: r.then || 'ALLOW',
    priority: r.priority ?? 100,
    ring: r.ring ?? 3,
    author_id: 'author-openoba',
    hash: '',
  }));
  for (const p of policies) {
    const { hash, ...rest } = p;
    p.hash = 'sha256:' + crypto.createHash('sha256').update(jcsCanonicalize(rest)).digest('hex');
  }
  const matchedRules = (o.rules || []).map((r) => ({ rule_id: r.id, canonical_tree: r.when || {} }));

  const doObj = {
    spec: 'decision-object-v1.5-signature',
    decision_id: o.decisionId || '00000000-0000-0000-0000-000000000000',
    compliance_profile: {
      profile_id: 'erdl-compliance-v1.5',
      profile_hash: 'sha256:' + crypto.createHash('sha256').update('profile').digest('hex'),
      jurisdictions: ['CN'],
      risk_level: 'critical',
      activated_fields: ['signature', 'signing_key_id', 'context_snapshot_hash', 'sanitized_context'],
      regulatory_references: [],
    },
    execution_trace_id: 'trace-sig',
    timestamp: o.timestamp || '2026-08-22T00:00:00.000Z',
    evaluation_duration_ms: 5,
    context: o.context || { operation: 'read' },
    agent,
    context_snapshot_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    sanitized_context: 'sanitized-context-placeholder',
    rule_set_version: { id: 'sha256:ruleset-sig', timestamp: '2026-08-22T00:00:00.000Z' },
    policies,
    evaluation: { matched_rules: matchedRules, total_evaluated: policies.length, total_matched: policies.length },
    result: { decision: o.decisionType || 'ALLOW', reason: 'Decision: ALLOW', applied_rule: policies.length ? policies[0].id : null, rules_matched: policies.map((p) => p.id) },
    human_oversight: { required: false },
    // signature-mode audit: no hash / previous_hash / commitment (PIT-5)
    audit: {
      mode: 'signature',
      preimage_version: PREIMAGE_VERSION,
      previous_signature: o.previousSignature !== undefined ? o.previousSignature : null,
      retention: { retention_until: '2029-08-22T00:00:00.000Z', retention_basis: 'GB-Z-185-2026-36-month' },
      chain_id: o.chainId || 'chain-sig',
      chain_seq: o.chainSeq ?? 0,
    },
    signing_key_id: 'ed25519-test-key-001',
    extensions: [],
  };

  const signature = signDO(doObj, privateKeyPem);
  doObj.signature = signature;
  return doObj;
}

function main() {
  const keys = KEYS;
  const publicKeyPem = keys.publicKeyPem;

  const vectors = [];

  // V-SIGN-001: legal signature (verify passes)
  {
    const doObj = buildSignatureDO({ keys, decisionType: 'ALLOW', context: { operation: 'read' }, chainId: 'chain-sig-001', chainSeq: 0 });
    vectors.push({ id: 'V-SIGN-001', category: 'V-SIGN', scenario: 'legal-signature', description: 'Legal signature: verify succeeds with the signing_key_id public key', decision_object: doObj, expected: { type: 'VERIFY', verify: 'pass' } });
  }

  // V-SIGN-002: tampered signature (verify fails)
  {
    const base = buildSignatureDO({ keys, decisionType: 'ALLOW', context: { operation: 'read' }, chainId: 'chain-sig-002', chainSeq: 0 });
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.result.decision = 'DENY'; // tamper a field without re-signing
    vectors.push({ id: 'V-SIGN-002', category: 'V-SIGN', scenario: 'tampered-signature', description: 'Tampered field → verify fails (signature mismatch)', base_do: base, tampered_do: tampered, expected: { type: 'VERIFY', verify: 'fail' } });
  }

  // V-SIGN-003: signature chain traceback (previous_signature links 3 DOs)
  {
    const chain = [];
    let prevSig = null;
    for (let i = 0; i < 3; i++) {
      const doObj = buildSignatureDO({ keys, decisionType: 'ALLOW', context: { operation: 'read', step: i }, chainId: 'chain-sig-003', chainSeq: i, previousSignature: prevSig });
      prevSig = doObj.signature;
      chain.push(doObj);
    }
    vectors.push({ id: 'V-SIGN-003', category: 'V-SIGN', scenario: 'signature-chain', description: 'Signature chain traceback: previous_signature links 3 DOs with no break', chain, expected: { type: 'VERIFY', verify: 'chain-pass' } });
  }

  // V-SIGN-004: forged signature (signed with a different key → verify fails)
  {
    // Generate a DIFFERENT (one-off) key pair to forge: the DO is signed with this other key,
    // so verifying under the claimed signing_key_id (the fixed test key) MUST fail.
    const { publicKey: otherPub, privateKey: otherPriv } = crypto.generateKeyPairSync('ed25519');
    const doObj = buildSignatureDO({ keys: { publicKeyPem: otherPub.export({ type: 'spki', format: 'pem' }), privateKeyPem: otherPriv.export({ type: 'pkcs8', format: 'pem' }) }, decisionType: 'ALLOW', context: { operation: 'read' }, chainId: 'chain-sig-004', chainSeq: 0 });
    vectors.push({ id: 'V-SIGN-004', category: 'V-SIGN', scenario: 'forged-signature', description: 'Signed with a different private key → verify fails under the claimed signing_key_id', decision_object: doObj, expected: { type: 'VERIFY', verify: 'fail', verify_public_key: 'primary' } });
  }

  // V-SIGN-005: signature canary (regressed verifier that skips verification would pass)
  {
    const base = buildSignatureDO({ keys, decisionType: 'ALLOW', context: { operation: 'read' }, chainId: 'chain-sig-005', chainSeq: 0 });
    // tamper the signature itself to an invalid value: a correct verifier MUST fail,
    // a regressed verifier that skips signature verification would falsely pass.
    const canary = JSON.parse(JSON.stringify(base));
    canary.signature = 'AA'.repeat(64); // 64 bytes of invalid base64url (128 chars of 'A')
    vectors.push({ id: 'V-SIGN-005', category: 'V-SIGN', scenario: 'signature-canary', description: 'Canary: invalid signature; a correct verifier MUST fail', decision_object: canary, expected: { type: 'VERIFY', verify: 'fail', canary: true } });
  }

  const output = {
    spec: 'decision-object-v1.5-signature',
    preimage_version: PREIMAGE_VERSION,
    signature_algorithm: 'Ed25519 (RFC 8032 / FIPS 186-5, PureEdDSA)',
    signing_key_id: 'ed25519-test-key-001',
    test_public_key_pem: publicKeyPem,
    test_key_declaration: 'PUBLIC test key pair (private key published, for vector verification only, strictly forbidden for production signing — RFC-002 §10.3)',
    vectors,
  };

  const outPath = path.join(__dirname, '..', 'signature-vectors-v1.5.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`generated ${vectors.length} signature vectors → ${outPath}`);
}

if (require.main === module) main();

module.exports = { signDO, verifySignature, buildSignatureDO };
