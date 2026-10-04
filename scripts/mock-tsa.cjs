/**
 * mock-tsa.cjs — a MOCK Time-Stamp Authority (RFC 3161 conceptual, simplified).
 *
 * RFC-002 §9.5: the T-series (T01..T03) anchors a signature-mode DO's timestamp
 * via a third-party timestamp token. This is a MOCK institution used for test
 * vectors only — NOT RFC 3161 wire-compatible (no CMS/ASN.1/X.509 chain). The
 * real RFC 3161 integration is a separate follow-up.
 *
 * Token design (simplified, deterministic):
 *   token = base64url( Ed25519_Sign( tsa_private_key, JCS({ hash, time, tsa_id }) ) )
 *   hash  = sha256( anchored_value )
 *
 * The timestamp_proof field (RFC-002 §9.5) is { tsa_id, token, anchored_field, requested_at }.
 *
 * The TSA public key is published (mock, for vector verification only).
 *
 * @license Apache-2.0
 */
'use strict';

const crypto = require('crypto');
const { jcsCanonicalize } = require('./jcs.cjs');

const TSA_ID = 'mock-tsa-001';
// Public test TSA key (mock institution, for vector verification only).
const TSA_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/ZYfBxZZq4v4WCq6ftEFpxfqmsffcIEiP7npqYlkHxg=
-----END PUBLIC KEY-----`;
const TSA_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIObX0zkQ+6YmB3ZxnoaLUqZJHgSZaW2h40DBjKbdEw7T
-----END PRIVATE KEY-----`;

/** Sign a timestamp token over the anchored value's hash + time. Returns the base64url token. */
function createToken(anchoredValue, time) {
  const hash = crypto.createHash('sha256').update(anchoredValue, 'utf8').digest('hex');
  const payload = { hash, time, tsa_id: TSA_ID };
  const canonical = jcsCanonicalize(payload);
  const sig = crypto.sign(null, Buffer.from(canonical, 'utf8'), TSA_PRIVATE_KEY_PEM);
  return sig.toString('base64url');
}

/** Verify a timestamp token over the anchored value's hash + time. */
function verifyToken(anchoredValue, time, token, publicKeyPem = TSA_PUBLIC_KEY_PEM) {
  const hash = crypto.createHash('sha256').update(anchoredValue, 'utf8').digest('hex');
  const payload = { hash, time, tsa_id: TSA_ID };
  const canonical = jcsCanonicalize(payload);
  return crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKeyPem, Buffer.from(token, 'base64url'));
}

module.exports = { TSA_ID, TSA_PUBLIC_KEY_PEM, createToken, verifyToken };
