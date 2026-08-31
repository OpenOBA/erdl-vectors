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
 * verify-v1.5.js — ERDL Decision Object v1.5 verifier (seven-step method, originally "five-step", Step 0–6 = 7 steps, RFC-002 §7)
 *
 * Zero-dependency verification of decision-object-vectors-v1.5.json (self-built JCS + SHA-256).
 *
 * Five-step verification (RFC-002 §7):
 *   Step 0: version discrimination (v1.5 flat hash / v1.3 legacy path)
 *   Step 1: read audit.preimage_version (domain separator constant)
 *   Step 2: deep clone → single deletion point DELETE audit.hash (zero projection)
 *   Step 3: JCS(RFC 8785) → canonical bytes
 *   Step 4: SHA-256 → recomputed hash
 *   Step 5: compare with stored audit.hash
 *   Step 6: answer-file cross-check (canonical_hex, physically isolated; covers ALL DOs in the vector set, incl. BREACH/tampered/chain members)
 *
 * Semantic detection layer (RFC-002 §8 chain break / §9.1 compliance failure):
 *   single DO: compliance_field_missing (incl. risk_level=critical → signature mandatory) / jurisdiction_mismatch / oversight_missing / sod_violation
 *   multi-breach: report first hit by §9.1.1 priority P1→P6; vectors MUST declare suppressed breaches in expected.also_present (enforced by the verifier)
 *   chain: hash_mismatch / version_unsupported / chain_genesis_mismatch / previous_hash_dangling
 *        / chain_seq_gap / mode_mixed_chain / time_regression
 *
 * Vector shapes:
 *   - decision_object: standalone DO (MATCH positive / semantic BREACH / canary)
 *   - chain: DO chain (C01 normal chain + C02..C08 attack chains, asserting a specific breach code)
 *   - base_do + tampered_do: tamper pair (base self-consistent, tampered mismatches → hash_mismatch)
 *
 * Usage:
 *   node verify-v1.5.js [path/to/vectors.json] [--answers <path>]
 *
 * @author Tang Qixin
 * @since 2026-08-22
 * @license MIT
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  Constants (frozen)
// ═══════════════════════════════════════════════════
const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';
const KNOWN_JURISDICTIONS = ['CN', 'EU', 'US', 'SG', 'BR', 'IN'];

// ═══════════════════════════════════════════════════
//  SHA-256
// ═══════════════════════════════════════════════════
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════
//  JCS (RFC 8785) — self-built, zero-dependency
// ═══════════════════════════════════════════════════
function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true; // high surrogate without pair
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true; // isolated low surrogate
    }
  }
  return false;
}

function jcsCanonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('JCS: NaN/Infinity not allowed');
    return String(value);
  }
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new Error('JCS: lone surrogate not allowed');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(jcsCanonicalize).join(',') + ']';
  }
  if (typeof value === 'bigint') throw new Error('JCS: BigInt not allowed');
  if (typeof value === 'symbol') throw new Error('JCS: Symbol not allowed');
  if (typeof value === 'function') throw new Error('JCS: Function not allowed');
  if (typeof value === 'object') {
    if (value instanceof Date) throw new Error('JCS: Date not serializable');
    if (value.constructor !== Object && value.constructor !== Array) {
      throw new Error('JCS: non-plain object not serializable');
    }
    const keys = Object.keys(value).sort();
    const members = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) continue;
      members.push(JSON.stringify(k) + ':' + jcsCanonicalize(v));
    }
    return '{' + members.join(',') + '}';
  }
  throw new Error('JCS: unsupported type ' + typeof value);
}

// ═══════════════════════════════════════════════════
//  RFC-002 §1.3#3: number fields MUST be safe integers (no decimals / out-of-range)
// ═══════════════════════════════════════════════════
function assertSafeIntegers(value) {
  if (Array.isArray(value)) { value.forEach(assertSafeIntegers); return; }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) assertSafeIntegers(value[k]);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw new Error('non-integer or unsafe number: ' + value);
    }
  }
}

// ═══════════════════════════════════════════════════
//  dot-separated path getter
// ═══════════════════════════════════════════════════
function getField(obj, path) {
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

// ═══════════════════════════════════════════════════
//  five-step verification (Step 0–5)
// ═══════════════════════════════════════════════════
function verifyDO(decisionObject) {
  // DoS protection
  const doJson = JSON.stringify(decisionObject);
  if (doJson.length > 1024 * 1024) {
    return { passed: false, error: 'resource_limit_exceeded: DO exceeds 1 MB' };
  }

  // Step 0: version discrimination (canonical_tree or v1.5 signature fields → v1.5 flat hash)
  const evalObj = decisionObject.evaluation;
  const hasCanonicalTree =
    evalObj && Array.isArray(evalObj.matched_rules) &&
    evalObj.matched_rules.some((m) => m.canonical_tree !== undefined);
  const hasV15Field =
    (decisionObject.audit && decisionObject.audit.preimage_version === PREIMAGE_VERSION) ||
    (decisionObject.compliance_profile && Array.isArray(decisionObject.compliance_profile.activated_fields));
  if (!hasCanonicalTree && !hasV15Field) {
    return { passed: false, error: 'v1.3 legacy path (no v1.5 signature), this verifier handles v1.5 only' };
  }

  // Step 1: read preimage_version
  const preimageVersion = decisionObject.audit && decisionObject.audit.preimage_version;
  if (preimageVersion !== PREIMAGE_VERSION) {
    return { passed: false, error: 'preimage_version unsupported: ' + preimageVersion };
  }

  // integer constraints (RFC-002 §1.3#3)
  try {
    assertSafeIntegers(decisionObject);
  } catch (e) {
    return { passed: false, error: e.message };
  }

  // Step 2: deep clone → deletion point (R2): audit.hash self-reference exclusion + defensive deletion of signature/signing_key_id
  // (the latter two do not exist in hash mode, deletion is no-op; in signature mode they MUST be removed, RFC-002 §1.1 / RUNNER_CONTRACT R2)
  const clone = JSON.parse(JSON.stringify(decisionObject));
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;

  // Step 3: JCS
  const canonical = jcsCanonicalize(clone);

  // Step 4: SHA-256
  const computedHash = 'sha256:' + sha256(canonical);

  // Step 5: compare
  const storedHash = decisionObject.audit.hash;
  return {
    passed: computedHash === storedHash,
    computedHash,
    storedHash,
    canonicalHex: Buffer.from(canonical, 'utf8').toString('hex'),
  };
}

// ═══════════════════════════════════════════════════
//  single-DO semantic breach detection (RFC-002 §9.1 group 3)
//
//  [spec priority P1→P6] (RFC-002 §9.1.1, isomorphic with §8 chain-layer priority)
//  P1 jurisdiction_mismatch      unrecognized jurisdiction code → profile uninterpretable, other checks lose their premise
//  P2 compliance_field_missing   profile-declared required field missing (incl. critical → signature mandatory)
//  P3 oversight_missing          high-risk / critical decision missing human-oversight record
//  P4 sod_violation              separation-of-duties violation (agent.id == policies[].author_id)
//  P5 tree_snapshot_divergence   evidence layer: decision tree snapshot inconsistent with the rule source
//  P6 content_unresolvable       reference integrity [warning-level] (RFC §8: warning, not a break) → MUST be last
//
//  Why P6 must be last: content_unresolvable is a warning, not a breach; if placed earlier,
//  a cold-storage-deleted knowledge reference would mask a co-occurring real breach (e.g. SoD).
//  Why P1 first: if an unknown jurisdiction code were placed later, a fabricated code + empty activation set could bypass the field-completeness check.
// ═══════════════════════════════════════════════════
function detectDOBreach(doObj, meta) {
  return collectDOBreaches(doObj, meta)[0] || null;
}

/**
 * Returns ALL simultaneously-holding breaches ordered by §9.1.1 priority.
 * detectDOBreach takes the first item; the verifier uses the full result to enforce the vector's `expected.also_present` (co-occurrence + suppression).
 */
function collectDOBreaches(doObj, meta) {
  const cp = doObj.compliance_profile || {};
  const hits = [];

  // P1. jurisdiction_mismatch: jurisdiction code not in the authoritative set (RFC-002 §5.2 six jurisdictions)
  //     semantics explicitly narrowed to "unrecognized jurisdiction code" (fail-closed);
  //     "DO-declared jurisdiction ≠ deployment-expected jurisdiction" is outside a stateless verifier's scope (see RFC §9.1.2).
  const juris = Array.isArray(cp.jurisdictions) ? cp.jurisdictions : [];
  if (juris.some((j) => !KNOWN_JURISDICTIONS.includes(j))) hits.push('jurisdiction_mismatch');

  // P2. compliance_field_missing: activated field missing
  const activated = Array.isArray(cp.activated_fields) ? cp.activated_fields : [];
  const fieldMissing = activated.some((f) => getField(doObj, f) == null);
  // P2b. risk-condition layer (RFC-002 §5.2): risk_level=critical → signature mandatory
  //      the profile MUST include signature in activated_fields; failing to do so means the risk-condition layer is not effective,
  //      the compliance consequence is the same as "activated but missing" (missing a required compliance field), so the same breach code is reused, no new code.
  const criticalWithoutSignature = cp.risk_level === 'critical' && !activated.includes('signature');
  if (fieldMissing || criticalWithoutSignature) hits.push('compliance_field_missing');

  // P3. oversight_missing: high risk without human oversight
  const risk = cp.risk_level;
  const oversight = doObj.human_oversight;
  if ((risk === 'high' || risk === 'critical') && (!oversight || oversight.required !== true)) {
    hits.push('oversight_missing');
  }

  // P4. sod_violation：agent.id === policies[].author_id
  const agentId = doObj.agent && doObj.agent.id;
  if (agentId && Array.isArray(doObj.policies) && doObj.policies.some((p) => p.author_id === agentId)) {
    hits.push('sod_violation');
  }

  // P5. tree_snapshot_divergence: canonical_tree snapshot inconsistent with recompiled rule source (policies[].when)
  const matched = doObj.evaluation && doObj.evaluation.matched_rules;
  const policies = Array.isArray(doObj.policies) ? doObj.policies : [];
  if (Array.isArray(matched)) {
    for (const m of matched) {
      const p = policies.find((pp) => pp.id === m.rule_id);
      if (p && m.canonical_tree !== undefined && p.when !== undefined &&
          jcsCanonicalize(m.canonical_tree) !== jcsCanonicalize(p.when)) {
        hits.push('tree_snapshot_divergence');
        break;
      }
    }
  }

  // P6. content_unresolvable (reference-integrity warning, not a break): knowledge_reference.entry_id not in the resolvable set
  const refs = doObj.evaluation && doObj.evaluation.knowledge_references;
  if (Array.isArray(refs) && meta && Array.isArray(meta.resolvable_entry_ids)) {
    if (refs.some((r) => !meta.resolvable_entry_ids.includes(r.entry_id))) hits.push('content_unresolvable');
  }

  return hits;
}

// ═══════════════════════════════════════════════════
//  chain breach detection (RFC-002 §8 break determination + §9.2)
// ═══════════════════════════════════════════════════
function detectChainBreach(chain) {
  // ① hash recompute mismatch / ④ preimage version unsupported
  for (const dobj of chain) {
    const r = verifyDO(dobj);
    if (!r.passed) {
      if (r.error && r.error.startsWith('preimage_version')) return 'version_unsupported';
      return 'hash_mismatch';
    }
  }
  // genesis block previous_hash non-null → chain_genesis_mismatch
  if (chain.length > 0 && chain[0].audit && chain[0].audit.previous_hash !== null) {
    return 'chain_genesis_mismatch';
  }
  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1].audit;
    const cur = chain[i].audit;
    // ② previous_hash inconsistent with the previous record's hash
    if (cur.previous_hash !== prev.hash) return 'previous_hash_dangling';
    // ③ a DO missing from the chain (chain_seq gap)
    if (cur.chain_seq !== prev.chain_seq + 1) return 'chain_seq_gap';
    // ⑤ mixed-mode chain
    if (cur.mode !== prev.mode) return 'mode_mixed_chain';
    // clock regression (time_regression)
    if (chain[i].timestamp < chain[i - 1].timestamp) return 'time_regression';
  }
  return null;
}

// ═══════════════════════════════════════════════════
//  main
// ═══════════════════════════════════════════════════
function main() {
  const args = process.argv.slice(2);
  let vectorsPath = null;
  let answersPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--answers' && i + 1 < args.length) {
      answersPath = args[i + 1]; i++;
    } else if (!args[i].startsWith('--')) {
      vectorsPath = args[i];
    }
  }
  vectorsPath = vectorsPath || path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');

  if (!fs.existsSync(vectorsPath)) {
    console.error('ERROR: vectors file not found: ' + vectorsPath);
    process.exit(1);
  }

  let answersData = null;
  if (answersPath && fs.existsSync(answersPath)) {
    answersData = JSON.parse(fs.readFileSync(answersPath, 'utf8'));
  }

  const data = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.5 Vector Verifier');
  console.log('  preimage_version: ' + data.preimage_version);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let pass = 0, fail = 0, canaryOk = 0;
  const breakdown = {};
  const errors = [];

  for (const v of data.vectors) {
    const cat = v.category;
    breakdown[cat] = breakdown[cat] || { total: 0, pass: 0 };
    const exp = v.expected || {};

    if (v.decision_object) {
      breakdown[cat].total++;
      const doObj = v.decision_object;
      const r = verifyDO(doObj);

      if (exp.type === 'MATCH') {
        let ok = r.passed;
        // field completeness (RFC-002 §9.1 groups 1/2)
        if (ok && Array.isArray(exp.required_fields)) {
          for (const f of exp.required_fields) {
            if (getField(doObj, f) == null) {
              ok = false;
              errors.push(v.id + ' required_field missing: ' + f);
            }
          }
        }
        // semantic check (SoD)
        if (ok && Array.isArray(exp.checks) && exp.checks.includes('sod')) {
          const agentId = doObj.agent && doObj.agent.id;
          if (agentId && Array.isArray(doObj.policies) && doObj.policies.some((p) => p.author_id === agentId)) {
            ok = false;
            errors.push(v.id + ' SoD violation');
          }
        }
        if (ok) { pass++; breakdown[cat].pass++; }
        else { fail++; if (!r.passed && errors.length && !errors.some((e) => e.startsWith(v.id))) errors.push(v.id + ' self-consistency failure: ' + (r.error || 'hash mismatch')); }
      } else if (exp.type === 'BREACH') {
        if (v.id === 'V-DO-v15-K01') {
          // canary: correct implementation (deletes only audit.hash) MISMATCH
          if (!r.passed) { canaryOk++; pass++; breakdown[cat].pass++; }
          else { fail++; errors.push(v.id + ' canary FALSE_PASS'); }
        } else {
          // semantic breach: hash self-consistent + semantic detector reports the specific breach code
          if (!r.passed) {
            fail++;
            errors.push(v.id + ' hash not self-consistent (semantic vector should be): ' + (r.error || 'hash mismatch'));
          } else {
            const allHits = collectDOBreaches(doObj, exp);
            const breach = allHits[0] || null;
            if (breach !== exp.breach) { fail++; errors.push(v.id + ' breach mismatch: expected ' + exp.breach + ', detected ' + breach); }
            else {
              // §9.1.1 invariant: a vector MUST explicitly declare all simultaneously-holding breaches (also_present),
              // and declared items MUST actually hold and MUST sort after the primary breach (suppressed by priority).
              // this check makes the "priority declaration" self-verifying, avoiding also_present becoming a dead declaration nobody reads.
              const declared = Array.isArray(exp.also_present) ? exp.also_present : [];
              const actualExtra = allHits.slice(1);
              const missingDecl = actualExtra.filter((c) => !declared.includes(c));
              const falseDecl = declared.filter((c) => !actualExtra.includes(c));
              if (missingDecl.length) {
                fail++;
                errors.push(v.id + ' breach co-holding but undeclared in also_present: ' + missingDecl.join(','));
              } else if (falseDecl.length) {
                fail++;
                errors.push(v.id + ' also_present declared but not actually holding (or not suppressed): ' + falseDecl.join(','));
              } else {
                pass++; breakdown[cat].pass++;
              }
            }
          }
        }
      } else {
        fail++;
        errors.push(v.id + ' unknown expected.type: ' + exp.type);
      }
    } else if (v.chain) {
      breakdown[cat].total++;
      const breach = detectChainBreach(v.chain);
      if (v.id === 'V-DO-v15-C01') {
        if (breach === null) { pass++; breakdown[cat].pass++; }
        else { fail++; errors.push(v.id + ' normal-chain false positive ' + breach); }
      } else {
        if (breach === exp.breach) { pass++; breakdown[cat].pass++; }
        else { fail++; errors.push(v.id + ' breach mismatch: expected ' + exp.breach + ', detected ' + breach); }
      }
    } else if (v.base_do) {
      breakdown[cat].total++;
      const baseR = verifyDO(v.base_do);
      const tamR = verifyDO(v.tampered_do);
      // tamper pair: base self-consistent + tampered mismatch (detected by flat hash)
      // note: semantic-layer detection for A02(content_unresolvable)/A07..A10(tree_snapshot_divergence)
      //     depends on external systems (knowledge-base resolution / rule recompilation); this hash-layer verifier falls back to flat-hash mismatch,
      //     the specific breach codes await the semantic verifier (same as the S3 signature layer).
      if (baseR.passed && !tamR.passed) { pass++; breakdown[cat].pass++; }
      else { fail++; errors.push(v.id + ' baseSelfConsistent=' + baseR.passed + ' tamperedMismatch=' + !tamR.passed); }
    }
  }

  // ── summary ──
  console.log('── Five-step verification (Step 0–5) + semantic detection ──');
  for (const [cat, s] of Object.entries(breakdown)) {
    const mark = s.pass === s.total ? '✓' : '✗';
    console.log(`  ${mark} ${cat.padEnd(8)} ${s.pass}/${s.total}`);
  }
  console.log('');
  console.log(`  total: ${pass}/${pass + fail} passed`);
  console.log(`  canary K01 correct discrimination: ${canaryOk}/1`);
  if (errors.length) {
    console.log('');
    console.log('  failure details:');
    errors.forEach((e) => console.log('    ✗ ' + e));
  }
  console.log('');

  // ── Step 6: answer-file cross-check (RUNNER_CONTRACT R4 Check 2 / R5 canary Check 2) ──
  // coverage = ALL DOs in the vector set (decision_object / base_do+tampered_do / chain members), not just MATCH-type:
  // Step 5 verifies "artifact self-reported hash", Step 6 verifies "byte drift" — they are orthogonal; BREACH-type vector bytes must also be stable.
  if (answersData && answersData.answers) {
    let ansMatch = 0, ansMismatch = 0, ansMissing = 0, ansNA = 0;
    const readKeys = new Set();
    let canaryCheck2 = null;

    const crossCheck = (key, dobj) => {
      // version gate: DOs with unsupported preimage_version (C07 version-downgrade attack) terminate early at Step 1 per contract,
      // no v1.5-pipeline canonical bytes exist in essence → Step 6 is N/A, and there MUST be no oracle key.
      const pv = dobj && dobj.audit && dobj.audit.preimage_version;
      if (pv !== PREIMAGE_VERSION) {
        ansNA++;
        if (answersData.answers[key] !== undefined) {
          errors.push(key + ' unsupported version yet has an oracle key (would lure the verifier past the version gate)');
        }
        return;
      }
      const r = verifyDO(dobj);
      const oracle = answersData.answers[key];
      if (oracle === undefined) {
        ansMissing++;
        errors.push(key + ' missing answer-file oracle key (Step 6 uncovered)');
        return;
      }
      readKeys.add(key);
      if (r.canonicalHex === oracle) {
        ansMatch++;
        if (key === 'V-DO-v15-K01') canaryCheck2 = 'MATCH';
      } else {
        ansMismatch++;
        if (key === 'V-DO-v15-K01') canaryCheck2 = 'MISMATCH';
        errors.push(key + ' answer file MISMATCH');
      }
    };

    for (const v of data.vectors) {
      if (v.decision_object) crossCheck(v.id, v.decision_object);
      if (v.base_do) {
        crossCheck(v.id + '-base', v.base_do);
        crossCheck(v.id + '-tampered', v.tampered_do);
      }
      if (v.chain) v.chain.forEach((dobj, i) => crossCheck(`${v.id}[${i}]`, dobj));
    }

    // dead-key guard: a key in the answer file that is never read → oracle disconnected from the vector set (coverage illusion)
    const deadKeys = Object.keys(answersData.answers).filter((k) => !readKeys.has(k));
    if (deadKeys.length) {
      errors.push('answer file dead keys (never read, coverage illusion): ' + deadKeys.join(', '));
    }

    console.log('── Step 6: answer-file cross-check ──');
    console.log(`  canonical_hex compare: ${ansMatch} MATCH / ${ansMismatch} MISMATCH / ${ansMissing} missing oracle`);
    console.log(`  coverage: ${ansMatch + ansMismatch}/${ansMatch + ansMismatch + ansMissing} applicable DOs (${ansNA} more N/A: unsupported version, terminated early per contract)`);
    console.log(`  answer file dead keys: ${deadKeys.length}`);
    console.log(`  canary K01 Check 2 (byte-level should MATCH): ${canaryCheck2 || 'N/A'}`);
    console.log('');
    if (ansMismatch || ansMissing || deadKeys.length) fail += ansMismatch + ansMissing + deadKeys.length;
  }

  if (fail === 0 && errors.length === 0) {
    console.log('  ✅ ALL VERIFICATIONS PASSED');
    console.log('  V-DO-v15 hash layer ' + data.vectors.length + ' vectors cross-implementation verifiable.');
    process.exit(0);
  } else {
    console.log('  ❌ VERIFICATION FAILED (' + fail + ' failures)');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// export core functions (for vitest tests)
module.exports = { verifyDO, jcsCanonicalize, sha256, detectDOBreach, collectDOBreaches, detectChainBreach, getField };
