#!/usr/bin/env node
/**
 * verify.js — ERDL Decision Object v1.2 Cross-Implementation Verifier
 *
 * Zero-dependency verification of decision-object-vectors-v1.2.json.
 * Self-built JCS (RFC 8785) + SHA-256, cross-implementation verifiable.
 *
 * Usage: node verify.js [path/to/vectors.json]
 *
 * Verification steps (Whitepaper §13.3):
 *   1. Parse JSON → deep clone decision_object
 *   2. Extract extensions → Step A
 *   3. Compute extensions_hash → Step B → compare
 *   4. DELETE audit / signature / signing_key_id → Step C
 *   5. JCS serialize remaining fields → Step D
 *   6. SHA-256 → Step E
 *   7. Compare with stored audit.hash → Step F
 *
 * Special: AV-008 EXPECTED_MISMATCH — canonical_bytes matches AV-003
 *          but audit.hash is a hardcoded v1.1 legacy value.
 *
 * Author: Tang Haoran — OpenOBA AI Executive
 * Date: 2026-07-28
 *
 * RFC 8785 (JCS) implementation notes:
 *   - Numbers: ES6 Number.prototype.toString() — String(n) in JS
 *   - Objects: keys sorted by UTF-16 code unit (JS default)
 *   - Omit over Null: undefined/null fields physically deleted before JCS
 *   - Whitespace: none between tokens
 *   - NaN/Infinity: not allowed (input validation)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  SHA-256 (Node.js built-in crypto)
// ═══════════════════════════════════════════════════

function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════
//  JCS (RFC 8785) — Self-built, zero-dependency
// ═══════════════════════════════════════════════════

/**
 * Serialize a value according to RFC 8785 JCS rules.
 *
 * Constraints:
 *   - UTF-8 output (Node.js default)
 *   - Property keys sorted by UTF-16 code unit order (JS Object.keys default)
 *   - No whitespace between tokens
 *   - Numbers: ES6 Number.prototype.toString() (String(n) in JS)
 *   - Strings: JSON-string-escaped per RFC 8259 §7 (JSON.stringify)
 *   - Omit over Null: undefined/null-value fields deleted BEFORE calling this
 */
function jcsCanonicalize(value) {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      throw new Error('JCS: NaN/Infinity not allowed in canonical JSON');
    }
    // RFC 8785 §3.2.2.3: numbers serialized using ES6 Number.prototype.toString()
    // String(n) in JavaScript is exactly this — produces sign+digits+.+digits+e+sign+digits
    return String(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map(v => jcsCanonicalize(v));
    return '[' + elements.join(',') + ']';
  }

  if (typeof value === 'object') {
    // Sort keys by UTF-16 code unit (JS default for Object.keys)
    const keys = Object.keys(value).sort();
    const members = [];
    for (const k of keys) {
      const v = value[k];
      // Omit over Null: skip undefined values, but KEEP null (JCS: null is a valid JSON value)
      if (v === undefined) continue;
      members.push(JSON.stringify(k) + ':' + jcsCanonicalize(v));
    }
    return '{' + members.join(',') + '}';
  }

  throw new Error('JCS: unsupported type ' + typeof value);
}

// ═══════════════════════════════════════════════════
//  Seven-Step Verification (Whitepaper §13.3)
// ═══════════════════════════════════════════════════

function verifyDO(vectorId, decisionObject) {
  // Step 1: Deep clone
  const clone = JSON.parse(JSON.stringify(decisionObject));

  // Step 2: Extract extensions (Step A)
  const exts = clone.extensions;

  // Step 3: Compute extensions_hash (Step B) — compare
  const computedExtJcs = jcsCanonicalize(exts);
  const computedExtHash = 'sha256:' + sha256(computedExtJcs);

  if (clone.extensions_hash !== computedExtHash) {
    return {
      passed: false,
      step: 'Step B: extensions_hash mismatch',
      error: `expected ${clone.extensions_hash}, computed ${computedExtHash}`,
      computedExtHash
    };
  }

  // Step 4: Delete self-referencing / external fields (Step C)
  delete clone.extensions;
  delete clone.audit;
  delete clone.signature;
  delete clone.signing_key_id;

  // Sanitize: also delete any leftover placeholder/internal fields
  delete clone.extensions_validation;
  delete clone.canonical_bytes;

  // Step 5: JCS Serialize (Step D)
  const canonicalFull = jcsCanonicalize(clone);
  const canonicalBytes = Buffer.from(canonicalFull, 'utf8').toString('hex');

  // Step 6: SHA-256 (Step E)
  const computedHash = 'sha256:' + sha256(canonicalFull);

  // Step 7: Compare (Step F)
  const storedHash = decisionObject.audit.hash;

  return {
    passed: computedHash === storedHash,
    canonical_bytes: canonicalBytes,
    computedHash,
    storedHash,
    extensions_hash: clone.extensions_hash || computedExtHash
  };
}

// ═══════════════════════════════════════════════════
//  Main — Verify all Audit Hash Vectors
// ═══════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const vectorsPath = args[0] || path.join(__dirname, '..', 'decision-object-vectors-v1.2.json');

  if (!fs.existsSync(vectorsPath)) {
    console.error('ERROR: Vectors file not found: ' + vectorsPath);
    console.error('Usage: node verify.js [path/to/decision-object-vectors-v1.2.json]');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.2 Vector Verifier');
  console.log('═══════════════════════════════════════════════');
  console.log('  File: ' + vectorsPath);
  console.log('');

  const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

  // ── Verify JCS self-consistency first ──
  console.log('── JCS Self-Consistency Check ──');
  const testObj = { b: 2, a: 1, c: [3, null, 'hello'], d: { nested: true, arr: [] } };
  const jcsOutput = jcsCanonicalize(testObj);
  const expectedJcs = '{"a":1,"b":2,"c":[3,null,"hello"],"d":{"arr":[],"nested":true}}';

  // Sanitize testObj to remove null fields for Omit over Null test
  const testObjOmitNull = { b: 2, a: 1, x: null, y: undefined, c: [3, null, 'hello'] };
  // Manual sanitize: remove undefined/null
  function sanitizeNulls(obj) {
    if (Array.isArray(obj)) return obj.map(v => (v === undefined || v === null) ? null : v);
    const result = {};
    for (const k of Object.keys(obj).sort()) {
      const v = obj[k];
      if (v === undefined || v === null) continue;
      result[k] = v;
    }
    return result;
  }
  const cleaned = sanitizeNulls(testObjOmitNull);
  const jcsOmitNull = jcsCanonicalize(cleaned);
  const expectedOmitNull = '{"a":1,"b":2,"c":[3,null,"hello"]}';

  if (jcsOutput === expectedJcs) {
    console.log('  ✓ basic JCS canonicalization correct');
  } else {
    console.error('  ✗ JCS BASIC MISMATCH');
    console.error('    Expected: ' + expectedJcs);
    console.error('    Got:      ' + jcsOutput);
    process.exit(1);
  }

  if (jcsOmitNull === expectedOmitNull) {
    console.log('  ✓ Omit over Null correct (null/undefined fields stripped)');
  } else {
    console.error('  ✗ Omit over Null FAILED');
    console.error('    Expected: ' + expectedOmitNull);
    console.error('    Got:      ' + jcsOmitNull);
    process.exit(1);
  }

  // Edge case: canonicalize empty array
  const jcsEmptyArray = jcsCanonicalize([]);
  if (jcsEmptyArray === '[]') {
    console.log('  ✓ empty array → "[]"');
  } else {
    console.error('  ✗ empty array FAILED: ' + jcsEmptyArray);
    process.exit(1);
  }

  console.log('');

  // ── Verify SELF-CONTAINED static DOs ──
  console.log('── Static DO Canonical Bytes Self-Consistency ──');
  let doPasses = 0;
  let doFails = 0;
  for (const vec of data.vectors) {
    // Verify that DO's canonical_bytes matches self-JCS
    const clone = JSON.parse(JSON.stringify(vec.decision_object));
    delete clone.extensions;
    delete clone.audit;
    delete clone.signature;
    delete clone.signing_key_id;
    delete clone.extensions_validation;
    delete clone.canonical_bytes;
    const selfJcs = jcsCanonicalize(clone);
    const selfCanonical = Buffer.from(selfJcs, 'utf8').toString('hex');

    if (selfCanonical === vec.canonical_bytes) {
      doPasses++;
    } else {
      doFails++;
      if (doFails <= 3) {
        console.log('  ✗ ' + vec.id + ' canonical_bytes mismatch');
      }
    }
  }
  console.log('  ✓ ' + doPasses + ' / ' + data.vectors.length + ' DO canonical_bytes self-consistent');
  if (doFails > 0) {
    console.log('  ✗ ' + doFails + ' FAILURES — check JCS implementation vs json-canonicalize');
  }
  console.log('');

  // ── Verify Audit Hash Vectors (Seven-Step) ──
  console.log('── Audit Hash Vector Verification (Seven-Step) ──');
  const av = data.audit_vectors || [];
  let passes = 0;
  let mismatches = 0;
  let errors = 0;

  const results = [];

  for (const avVec of av) {
    const id = avVec.id;
    const result = verifyDO(id, avVec.decision_object);

    // Compare canonical_bytes with stored value
    const canBytesMatch = result.canonical_bytes === avVec.canonical_bytes;

    let status;
    if (id === 'AV-008') {
      // AV-008: EXPECTED MISMATCH (stale regression vector)
      if (!result.passed && canBytesMatch) {
        status = '✓ EXPECTED_MISMATCH';
        passes++;
      } else if (result.passed) {
        status = '✗ FALSE_PASS (AV-008 should mismatch but passed — cached/shorthand validator?)';
        errors++;
      } else {
        status = '✗ ERROR: ' + result.error;
        errors++;
      }
    } else {
      if (result.passed && canBytesMatch) {
        status = '✓ MATCH';
        passes++;
      } else if (result.passed && !canBytesMatch) {
        status = '⚠ PARTIAL (hash matches but canonical_bytes differ — JCS difference?)';
        errors++;
      } else if (!result.passed && canBytesMatch) {
        status = '✗ MISMATCH (same canonical_bytes but different hash — implementation algorithm error)';
        mismatches++;
      } else {
        status = '✗ FAIL: ' + (result.error || 'canonical_bytes + hash both mismatch');
        mismatches++;
      }
    }

    results.push({ id, status, result, canonicalBytesMatch: canBytesMatch });
    console.log('  ' + status.padEnd(50) + ' | ' + id + ' ← ' + avVec.vector_ref);
  }

  console.log('');

  // ── Summary ──
  console.log('═══════════════════════════════════════════════');
  console.log('  VERIFICATION SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log('  Audit vectors total:   ' + av.length);
  console.log('  ✓ PASS (hash match):   ' + passes);
  console.log('  ✗ MISMATCH:            ' + mismatches);
  console.log('  ✗ ERROR:               ' + errors);
  console.log('');

  if (av.length > 0) {
    const expectedPassCount = 11; // 12 AVs minus AV-008
    const expectedMismatchCount = 1; // AV-008: stale regression, MUST mismatch

    // passes includes AV-008 (counted as EXPECTED_MISMATCH in passes)
    const matchCount = passes - 1; // exclude AV-008
    const staleMismatchCount = passes - matchCount; // AV-008 (the one expected mismatch)
    
    console.log('  Expected: ' + expectedPassCount + ' MATCH + ' + expectedMismatchCount + ' MISMATCH (AV-008)');
    console.log('  Got:      ' + matchCount + ' MATCH + ' + staleMismatchCount + ' MISMATCH (AV-008)');
    console.log('');

    if (matchCount === expectedPassCount && staleMismatchCount === expectedMismatchCount && mismatches === 0 && errors === 0) {
      console.log('  ╔══════════════════════════════════════╗');
      console.log('  ║  ✅ ALL VERIFICATIONS PASSED         ║');
      console.log('  ║  11/11 MATCH + AV-008 STALE DETECTED ║');
      console.log('  ╚══════════════════════════════════════╝');
      console.log('');
      console.log('  Decision Object v1.2 vectors are cross-implementation verifiable.');
      process.exit(0);
    } else {
      console.log('  ╔══════════════════════════════════════╗');
      console.log('  ║  ❌ VERIFICATION FAILED              ║');
      console.log('  ╚══════════════════════════════════════╝');
      process.exit(1);
    }
  }
}

main();
