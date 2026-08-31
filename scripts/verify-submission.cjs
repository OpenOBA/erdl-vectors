#!/usr/bin/env node
/*
 * Copyright 2026 Shenzhen Miaojing Technology Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * verify-submission.cjs — cross-verify a third-party runner submission against the reference vectors.
 *
 * A conforming runner (RUNNER_CONTRACT.md R1–R6) re-implements JCS (RFC 8785) + SHA-256 from the
 * spec + contract alone, computes the canonical bytes of every Decision Object, and submits them.
 * This verifier recomputes the reference canonical bytes on the fly (self-built JCS, zero dependency)
 * and compares byte-for-byte — the cross-implementation proof: "does your independent implementation
 * produce the same bytes as the reference?"
 *
 * Submission format (submissions/<runner>-output.json):
 *   {
 *     "runner": "concordia-python",
 *     "method": "Python, spec-only, self-built JCS (RFC 8785) + hashlib SHA-256",
 *     "date": "2026-08-31",
 *     "artifact": "https://github.com/<you>/<runner-repo>",
 *     "k01_check1": "MISMATCH",
 *     "canonical_hex": { "<oracle-key>": "<hex>", ... }
 *   }
 *
 *   oracle-key mirrors the answer-file keying: <id> / <id>-base / <id>-tampered / <id>[i].
 *   Version-gated DOs (e.g. V-DO-v15-C07[1], unsupported preimage_version) MUST NOT have a key —
 *   the reference terminates early there (RUNNER_CONTRACT R1 / §4 version-gate exclusion).
 *
 * What gets verified (hash layer + canary):
 *   1. canonical_hex byte-identity for every applicable DO (78 vectors → 107 DOs);
 *   2. K01 canary: k01_check1 === "MISMATCH" (correct impl deletes only audit.hash, recomputed hash ≠ stored hash);
 *   3. no dead keys in the submission (no key outside the reference map).
 *
 * The semantic breach layer (R3) is verified by the reference verifier (verify-v1.5.js) and is the
 * runner's own self-assessment in this iteration; byte-identity is the core hash-layer cross-check.
 *
 * Usage:
 *   node scripts/verify-submission.cjs --submission submissions/<runner>-output.json [--vectors <path>]
 *
 * @author Tang Qixin
 * @since 2026-08-31
 * @license Apache-2.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { verifyDO } = require('./verify-v1.5.js');

const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';

/**
 * Recompute the reference canonical_hex for every applicable DO, mirroring the
 * answer-file keying + version gate (RUNNER_CONTRACT §4 version-gate exclusion).
 */
function buildReferenceMap(vectors) {
  const map = {};
  const add = (key, dobj) => {
    const pv = dobj && dobj.audit && dobj.audit.preimage_version;
    if (pv !== PREIMAGE_VERSION) return; // version-gated → no canonical bytes (matches oracle invariant)
    map[key] = verifyDO(dobj).canonicalHex;
  };
  for (const v of vectors) {
    if (v.decision_object) add(v.id, v.decision_object);
    if (v.base_do) {
      add(v.id + '-base', v.base_do);
      add(v.id + '-tampered', v.tampered_do);
    }
    if (v.chain) v.chain.forEach((dobj, i) => add(v.id + '[' + i + ']', dobj));
  }
  return map;
}

/**
 * Cross-verify a submission against the reference map. Returns a structured result.
 */
function crossVerify(sub, refMap) {
  const subHex = sub.canonical_hex || {};
  let match = 0, mismatch = 0, missing = 0;
  const errors = [];

  for (const [key, refHex] of Object.entries(refMap)) {
    const s = subHex[key];
    if (s === undefined) { missing++; errors.push(key + ' missing in submission'); }
    else if (s === refHex) { match++; }
    else { mismatch++; errors.push(key + ' canonical_hex MISMATCH'); }
  }
  const deadKeys = Object.keys(subHex).filter((k) => !(k in refMap));
  if (deadKeys.length) errors.push('dead keys (not in reference map): ' + deadKeys.join(', '));

  const k01 = sub.k01_check1;
  const k01Ok = k01 === 'MISMATCH';
  if (!k01Ok) errors.push('K01 Check 1 must be MISMATCH (got: ' + k01 + ')');

  const total = Object.keys(refMap).length;
  const failed = mismatch + missing + deadKeys.length + (k01Ok ? 0 : 1);

  return { match, mismatch, missing, deadKeys, k01Ok, total, failed, errors };
}

function main() {
  const args = process.argv.slice(2);
  let submissionPath = null;
  let vectorsPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--submission' && i + 1 < args.length) { submissionPath = args[i + 1]; i++; }
    else if (args[i] === '--vectors' && i + 1 < args.length) { vectorsPath = args[i + 1]; i++; }
  }
  vectorsPath = vectorsPath || path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');
  if (!submissionPath) {
    console.error('usage: node scripts/verify-submission.cjs --submission <path> [--vectors <path>]');
    process.exit(2);
  }
  if (!fs.existsSync(submissionPath)) { console.error('ERROR: submission not found: ' + submissionPath); process.exit(1); }

  const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));
  const sub = JSON.parse(fs.readFileSync(submissionPath, 'utf8'));
  const refMap = buildReferenceMap(data.vectors);

  const result = crossVerify(sub, refMap);
  const { match, mismatch, missing, deadKeys, k01Ok, total, failed, errors } = result;

  console.log('═══════════════════════════════════════════════');
  console.log('  Cross-Implementation Verification (submission)');
  console.log('  runner: ' + (sub.runner || '(unknown)'));
  console.log('  method: ' + (sub.method || '(unknown)'));
  console.log('  date:   ' + (sub.date || '(unknown)'));
  console.log('═══════════════════════════════════════════════');
  console.log('  canonical_hex byte-identity: ' + match + '/' + total + ' MATCH'
    + (mismatch ? ' · ' + mismatch + ' MISMATCH' : '')
    + (missing ? ' · ' + missing + ' missing' : ''));
  console.log('  K01 canary Check 1: ' + (k01Ok ? 'MISMATCH ✓' : 'FAIL (' + sub.k01_check1 + ')'));
  console.log('  dead keys: ' + deadKeys.length);
  if (errors.length) {
    console.log('');
    errors.forEach((e) => console.log('    ✗ ' + e));
  }
  console.log('');
  if (failed === 0) {
    console.log('  ✅ SUBMISSION VERIFIED — ' + match + '/' + total + ' bytes identical, K01 discriminated');
    console.log('  record: ' + (sub.runner || '?') + ' | ' + (sub.method || '?') + ' | ' + (sub.date || '?') + ' | ' + match + '/' + total);
    process.exit(0);
  } else {
    console.log('  ❌ SUBMISSION FAILED (' + failed + ' failures)');
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { buildReferenceMap, crossVerify };
