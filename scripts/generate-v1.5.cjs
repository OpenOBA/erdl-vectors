#!/usr/bin/env node
/**
 * generate-v1.5.cjs — ERDL Decision Object v1.5 Vector Generator
 *
 * Generates the V-DO-v15 hash-layer 78 vectors (D13 + C8 + A10 + K1 + G14 + V-COMP32).
 * Aligns with RFC-002 §1 (flat hash + single deletion point) and SPEC §45.1 (audit-layer matrix).
 *
 * Hash formula (hash mode):
 *   audit.hash = "sha256:" + HEX(SHA-256(JCS(all DO fields − audit.hash)))
 *   preimage_version = "erdl-do-v1.5-hash-flat" enters the preimage
 *
 * @author Tang Qixin
 * @since 2026-08-22
 * @license MIT
 */
'use strict';

const crypto = require('crypto');
const { canonicalize } = require('json-canonicalize');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
//  Utilities
// ═══════════════════════════════════════════════════
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const jcs = (o) => canonicalize(o);

// ═══════════════════════════════════════════════════
//  Constants (frozen)
// ═══════════════════════════════════════════════════
const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';
const SPEC = 'decision-object-v1.5';
const TIMESTAMP = '2026-08-22T00:00:00.000Z';
const AGENT_ID = 'did:erdl:sha256:test-runner-v1.5';
const AGENT_AID = '91110108MA12345678A00000001E';
const VIRTUAL_SHA256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

// Deterministic UUIDv7 (frozen timestamp 2026-08-22 → prefix 019b5c5a)
const UUID_BASE = '019b5c5a-0000-7000-8000-';
let uuidIndex = 0;
function deterministicUuid() {
  return UUID_BASE + (++uuidIndex).toString(16).padStart(12, '0');
}

// ═══════════════════════════════════════════════════
//  buildDO — builds the v1.5 Decision Object (hash mode)
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
//  Answer file (canonical_hex physically isolated, not readable by compliant runs)
// ═══════════════════════════════════════════════════
const answers = {}; // vectorId -> canonical_hex

/**
 * @param {object} o
 * @param {string} o.decisionType   decision type (one of 13)
 * @param {object} o.context        evaluation context
 * @param {Array}  o.rules          rule definitions [{id,name,when(canonical S-expr),then,priority,ring}]
 * @param {string} o.chainId        chain ID (session_id)
 * @param {number} o.chainSeq       chain sequence number (0-based)
 * @param {string|null} o.previousHash previous hash (null for genesis)
 * @param {object} [o.outcome]      outcome layer (G series)
 * @param {Array}  [o.extensions]  extensions (default [])
 * @param {Array}  [o.activatedFields] activated fields (default: full CN activation set)
 * @param {object} [o.override]     post-build override (for tamper vectors)
 * @param {object} [o.extra]        extra fields (anchoring fields etc., deep-merged before hashing)
 * @param {string} [o.authorId]     policies[].author_id (default author-openoba, for SoD vectors)
 * @param {Array}  [o.omitFields]   physically omitted from activated fields (for compliance_field_missing vectors)
 * @param {string} [o.answerId]     answer file key (collects canonical_hex)
 */
function buildDO(o) {
  const decisionType = o.decisionType;
  const chainId = o.chainId;
  const chainSeq = o.chainSeq;

  // ── policies ──
  const policies = (o.rules || []).map((r, i) => {
    const policy = {
      id: r.id || `policy-${String(i + 1).padStart(3, '0')}`,
      name: r.name || `Policy ${i + 1}`,
      when: r.when || {},
      then: r.then || decisionType,
      priority: r.priority ?? 100,
      ring: r.ring ?? 3,
      author_id: o.authorId || 'author-openoba',
      hash: '',
    };
    // compute policy.hash (self-reference exclusion)
    const { hash, ...rest } = policy;
    policy.hash = 'sha256:' + sha256(jcs(rest));
    return policy;
  });

  // ── rule_set_version.id (JCS of policies with hash removed) ──
  const rsJcs = jcs(policies.map((p) => {
    const { hash, ...rest } = p;
    return rest;
  }));
  const ruleSetId = 'sha256:' + sha256(rsJcs);

  // ── evaluation.matched_rules (with canonical_tree) ──
  const matchedRules = (o.rules || []).map((r) => ({
    rule_id: r.id,
    canonical_tree: r.when || {},
  }));

  // ── compliance_profile ──
  const activatedFields = o.activatedFields || [
    'agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no',
    'agent.model_registration_id', 'model_id', 'confidence_score',
    'fairness_assessment', 'impact_assessment_id', 'data_modification_expected',
    'autonomy_level', 'context_snapshot_hash', 'sanitized_context',
  ];
  const complianceProfile = {
    profile_id: 'erdl-compliance-v1.5',
    profile_hash: '',
    jurisdictions: o.jurisdictions || ['CN'],
    risk_level: o.riskLevel || 'low',
    activated_fields: activatedFields,
    regulatory_references: o.frameworks || [
      { framework: 'GB-Z-185-2026', version: '2026-05-22', jurisdiction: 'CN' },
    ],
  };
  // Omit over Null: physically delete empty industries array (RFC-002 §1.3#6)
  if (o.industries && o.industries.length > 0) complianceProfile.industries = o.industries;
  const { profile_hash: _ph, ...cpRest } = complianceProfile;
  complianceProfile.profile_hash = 'sha256:' + sha256(jcs(cpRest));

  // ── JUR field values (full pool, trimmed by activated_fields) ──
  const JUR_VALUES = {
    model_id: 'test-model-v1.5',
    confidence_score: 95,
    fairness_assessment: 'not_applicable',
    impact_assessment_id: '018c4a3e-0009-7000-8000-000000000009',
    data_modification_expected: false,
    autonomy_level: 'L2',
    context_snapshot_hash: VIRTUAL_SHA256,
    sanitized_context: 'sanitized-context-placeholder',
    'agent.aid': AGENT_AID,
    'agent.known_limitations': ['test runner; no real operations'],
    'agent.tool_registry_hash': VIRTUAL_SHA256,
    'agent.algorithm_filing_no': 'NET-2026-000000',
    'agent.model_registration_id': 'MR-2026-000000',
  };

  // ── agent (base + activated agent sub-fields) + top-level JUR fields ──
  const agent = { id: AGENT_ID, role: 'guardian', version: 'v1.5.0' };
  const topJur = {};
  const omitFields = o.omitFields || [];
  for (const f of activatedFields) {
    if (omitFields.includes(f)) continue;  // compliance_field_missing vectors: activated field physically missing
    const v = JUR_VALUES[f];
    if (v === undefined) continue;
    if (f.startsWith('agent.')) {
      agent[f.slice(6)] = v;
    } else {
      topJur[f] = v;
    }
  }

  // ── result ──
  const appliedRuleId = policies.length ? policies[0].id : null;
  const result = {
    applied_rule: appliedRuleId,
    reason: `Decision: ${decisionType}`,
    decision: decisionType,
    rules_matched: policies.map((p) => p.id),
  };
  if (o.outcome !== undefined) result.outcome = o.outcome;

  // ── human_oversight (object) ──
  const humanOversight = { required: decisionType === 'REQUEST_HUMAN' };

  // ── audit (hash mode) ──
  const audit = {
    mode: 'hash',
    hash: '',
    previous_hash: o.previousHash ?? null,
    commitment: {
      agent_id: AGENT_ID,
      tool_name: (o.context && o.context.tool && o.context.tool.name) || 'default',
      decision: decisionType,
    },
    preimage_version: PREIMAGE_VERSION,
    retention: { retention_until: '2029-08-22T00:00:00.000Z', retention_basis: 'GB-Z-185-2026-36-month' },
    chain_id: chainId,
    chain_seq: chainSeq,
  };

  // ── assemble full DO ──
  let doObj = {
    spec: SPEC,
    decision_id: deterministicUuid(),
    compliance_profile: complianceProfile,
    execution_trace_id: deterministicUuid(),
    timestamp: TIMESTAMP,
    evaluation_duration_ms: 5,
    ...topJur,
    agent,
    context: o.context || {},
    rule_set_version: { id: ruleSetId, timestamp: TIMESTAMP },
    policies,
    evaluation: {
      matched_rules: matchedRules,
      total_evaluated: policies.length,
      total_matched: policies.length,
    },
    result,
    human_oversight: humanOversight,
    audit,
    extensions: o.extensions !== undefined ? o.extensions : [],
  };

  // ── apply extra fields (anchoring fields, deep-merge before hashing) ──
  if (o.extra) {
    doObj = deepMerge(doObj, o.extra);
  }

  // ── apply override (for tamper vectors, before hashing) ──
  if (o.override) {
    doObj = applyOverride(doObj, o.override);
  }

  // ── flat hash: deletion point = audit.hash (self-reference) + signature/signing_key_id (defensive, no-op in hash mode) ──
  // Strictly isomorphic with verifier Step 2 / RUNNER_CONTRACT R2, to avoid future signature-mode
  // generator-vs-verifier preimage divergence.
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;
  const canonical = jcs(clone);
  const canonicalHex = Buffer.from(canonical, 'utf8').toString('hex');
  doObj.audit.hash = 'sha256:' + sha256(canonical);
  // canonical_hex does not enter decision_object (physically isolated into the separate answer file)
  if (o.answerId) answers[o.answerId] = canonicalHex;

  return doObj;
}

/**
 * Answer-oracle registration (RUNNER_CONTRACT R4 Check 2) — computes canonical_hex for any DO into the answer file.
 *
 * Strictly isomorphic with buildDO internal computation: deep clone → delete audit.hash → JCS → UTF-8 hex.
 * Used for DOs finalized only after buildDO (tampered chain members, tampered_do, semantic-tamper DOs, canaries),
 * so the answer oracle covers ALL DOs in the vector set, not just MATCH-type — zero dead keys, zero uncovered.
 */
function registerAnswer(key, doObj) {
  if (!key || !doObj) return;
  // DOs with unsupported versions (e.g. the C07 version-downgrade attack) are NOT registered as oracles:
  // a conforming runner MUST terminate early at Step 1 (version_unsupported), never producing v1.5-pipeline canonical bytes.
  // Registering an oracle would lure the verifier past the version gate → a contract violation.
  if (!doObj.audit || doObj.audit.preimage_version !== PREIMAGE_VERSION) return;
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;
  answers[key] = Buffer.from(jcs(clone), 'utf8').toString('hex');
}

/** Deep override: path is dot-separated (e.g. 'result.decision'), supports array indices (e.g. 'policies.0.hash'). */
function applyOverride(obj, override) {
  const clone = JSON.parse(JSON.stringify(obj));
  for (const [p, v] of Object.entries(override)) {
    setPath(clone, p, v);
  }
  return clone;
}
function setPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

/** Recursive deep merge (extra fields merged into doObj, for anchoring fields). */
function deepMerge(target, source) {
  const out = JSON.parse(JSON.stringify(target));
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Recompute audit.hash (recompute after tamper to keep hash self-consistent, for semantic-attack vectors). */
function recomputeHash(doObj) {
  const clone = JSON.parse(JSON.stringify(doObj));
  delete clone.audit.hash;
  doObj.audit.hash = 'sha256:' + sha256(jcs(clone));
}

/** Recompute hash from fromIndex onward (fromIndex's previous_hash stays unchanged), then re-chain previous_hash. */
function rechainFrom(chain, fromIndex) {
  recomputeHash(chain[fromIndex]);
  for (let i = fromIndex + 1; i < chain.length; i++) {
    chain[i].audit.previous_hash = chain[i - 1].audit.hash;
    recomputeHash(chain[i]);
  }
}

/** Dot-separated path getter. */
function getField(obj, path) {
  return path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

// ═══════════════════════════════════════════════════
//  Vector definition helpers
// ═══════════════════════════════════════════════════
function V(def) {
  return def;
}
function Rule(r) {
  return r;
}

// Shorthands: common canonical_tree nodes
const field = (p) => ({ field: p });
const eq = (l, r) => ({ eq: [l, r] });
const and = (...args) => ({ and: args });

// ═══════════════════════════════════════════════════
//  D series — 13 decision-type coverage
// ═══════════════════════════════════════════════════
const D_TYPES = [
  'ALLOW', 'DENY', 'CORRECT', 'NOTIFY', 'REQUEST_HUMAN', 'ESCALATE',
  'DELEGATE', 'DEFER', 'EMERGENCY_HALT', 'ROLLBACK', 'QUARANTINE',
  'WORKFLOW', 'GUIDE',
];

const D_SERIES = D_TYPES.map((dt, i) => {
  const when = dt === 'DENY'
    ? eq(field('context.tool.name'), 'exec')
    : dt === 'ALLOW'
      ? eq(field('context.operation'), 'read')
      : dt === 'REQUEST_HUMAN'
        ? eq(field('context.data_type'), 'PII')
        : eq(field('context.flag'), dt.toLowerCase());
  return V({
    id: `V-DO-v15-D${String(i + 1).padStart(2, '0')}`,
    category: 'D',
    decision_type: dt,
    scenario: `decision-type-${dt.toLowerCase()}`,
    description: `Decision type coverage: ${dt} (flat hash + canonical_tree field)`,
    rules: [Rule({ id: `rule-d-${dt.toLowerCase()}`, name: `D ${dt}`, when, then: dt, priority: 100, ring: dt === 'EMERGENCY_HALT' ? 0 : 3 })],
    context: dt === 'DENY' ? { tool: { name: 'exec' } }
      : dt === 'ALLOW' ? { operation: 'read' }
      : dt === 'REQUEST_HUMAN' ? { data_type: 'PII' }
      : { flag: dt.toLowerCase() },
    chainId: 'chain-d-series',
    chainSeq: i,
    previousHash: i === 0 ? null : null, // each is an independent genesis (D series is non-chained), backfilled by the generator
  });
});

// ═══════════════════════════════════════════════════
//  C series — 8 chain-attack detection
// ═══════════════════════════════════════════════════

// C01 normal chain: 3 DOs forming a valid chain (serially anchored previous_hash). Empty answerPrefix means no answer is recorded (reused for attack chains).
function buildNormalChain(answerPrefix) {
  const chainId = 'chain-c01-normal';
  const seq = [];
  let prev = null;
  for (let i = 0; i < 3; i++) {
    const doObj = buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read', step: i },
      rules: [Rule({ id: `rule-c01-${i}`, name: `C01 step ${i}`, when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId, chainSeq: i, previousHash: prev,
      answerId: answerPrefix ? `${answerPrefix}[${i}]` : null,
    });
    prev = doObj.audit.hash;
    seq.push(doObj);
  }
  return seq;
}

// C02..C08: apply various attacks to the normal chain, producing a "tampered chain".
// Semantic attacks (C03..C08) recompute the hash after tamper to keep it self-consistent, so the verifier
// detects the specific breach code via its semantic detectors (not hash mismatch).
function buildTamperedChain(attackType) {
  const seq = buildNormalChain(null);
  const clone = JSON.parse(JSON.stringify(seq));

  switch (attackType) {
    case 'c02': // single-record tamper (decision field, not recomputed) → hash_mismatch
      clone[1].result.decision = 'DENY';
      return { vectors: clone, breach: 'hash_mismatch' };
    case 'c03': // delete a middle record (chain_seq gap; re-chain previous_hash so the only anomaly is the seq gap)
      clone.splice(1, 1);
      clone[1].audit.previous_hash = clone[0].audit.hash;
      recomputeHash(clone[1]);
      return { vectors: clone, breach: 'chain_seq_gap' };
    case 'c04': // dangling pointer (previous_hash dangling; recompute hash to stay self-consistent)
      clone[1].audit.previous_hash = 'sha256:' + 'f'.repeat(64);
      rechainFrom(clone, 1);
      return { vectors: clone, breach: 'previous_hash_dangling' };
    case 'c05': // clock regression (timestamp rolls back; recompute hash to stay self-consistent)
      clone[2].timestamp = '2026-08-21T00:00:00.000Z';
      rechainFrom(clone, 2);
      return { vectors: clone, breach: 'time_regression' };
    case 'c06': // rebuild after full-chain deletion (genesis previous_hash non-null; recompute hash)
      clone[0].audit.previous_hash = 'sha256:' + 'e'.repeat(64);
      rechainFrom(clone, 0);
      return { vectors: clone, breach: 'chain_genesis_mismatch' };
    case 'c07': // version downgrade (preimage_version tampered to an unsupported value; recompute hash)
      clone[1].audit.preimage_version = 'erdl-do-v1.3-hash-flat';
      rechainFrom(clone, 1);
      return { vectors: clone, breach: 'version_unsupported' };
    case 'c08': // mixed-mode chain (adjacent DOs have different modes; recompute hash)
      clone[1].audit.mode = 'signature';
      rechainFrom(clone, 1);
      return { vectors: clone, breach: 'mode_mixed_chain' };
    default:
      throw new Error('unknown attack type: ' + attackType);
  }
}

// ═══════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════
function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  ERDL Decision Object v1.5 Vector Generator');
  console.log('═══════════════════════════════════════════════');

  // D series (independent genesis)
  const dVectors = D_SERIES.map((def) => {
    const doObj = buildDO({
      decisionType: def.decision_type,
      context: def.context,
      rules: def.rules,
      chainId: 'chain-d-' + def.decision_type.toLowerCase(),
      chainSeq: 0,
      previousHash: null,
      answerId: def.id,
    });
    return {
      id: def.id,
      category: 'D',
      decision_type: def.decision_type,
      scenario: def.scenario,
      description: def.description,
      context: def.context,
      rules: def.rules.map((r) => r),
      decision_object: doObj,
      expected: { type: 'MATCH', note: 'audit.hash self-consistent (independent genesis)' },
    };
  });

  // C series
  const cVectors = [];
  {
    const normal = buildNormalChain('V-DO-v15-C01');
    cVectors.push({
      id: 'V-DO-v15-C01', category: 'C', decision_type: 'ALLOW',
      scenario: 'normal-chain', description: 'Normal chain (3 DOs serially anchored, no attack)',
      chain: normal, expected: { type: 'MATCH', note: 'full-chain audit.hash self-consistent + previous_hash continuous' },
    });
  }
  for (const at of ['c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08']) {
    const { vectors, breach } = buildTamperedChain(at);
    cVectors.push({
      id: `V-DO-v15-${at.toUpperCase()}`,
      category: 'C',
      decision_type: 'ALLOW',
      scenario: 'chain-attack',
      description: `Chain attack: ${at}`,
      chain: vectors,
      expected: { type: 'BREACH', breach },
    });
  }

  // ═══════════════════════════════════════════════════
  //  A series — 10 anchoring attacks (base self-consistent + tampered)
  // ═══════════════════════════════════════════════════
  function buildAnchoredBase(answerId, entryId) {
    return buildDO({
      decisionType: 'ALLOW',
      context: {
        operation: 'read',
        amount: '0.95',
        attachments: [{ storage_key: 's3://oba/report.pdf', content_hash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', file_name: 'report.pdf', mime_type: 'application/pdf', file_size: 1024 }],
        intent: { source: 'user', category: 'query', summary_hash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        memory_keys: ['mem-1', 'mem-2'],
      },
      rules: [Rule({ id: 'rule-a-base', name: 'A base', when: eq(field('context.amount'), '0.95'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-a-series', chainSeq: 0, previousHash: null,
      extra: {
        evaluation: {
          knowledge_references: [{ entry_id: entryId || 'kb-001', entry_version: 'v1', content_hash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', fragment_hash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' }],
        },
      },
      answerId,
    });
  }

  const A_DEFS = [
    { id: 'V-DO-v15-A01', breach: 'hash_mismatch', tamper: { 'evaluation.knowledge_references.0.content_hash': 'sha256:9999999999999999999999999999999999999999999999999999999999999999' }, desc: 'knowledge body tamper' },
    { id: 'V-DO-v15-A02', breach: 'content_unresolvable', semantic: true, resolvable_entry_ids: ['kb-001'], tamper: { 'evaluation.knowledge_references.0.entry_id': 'kb-nonexistent' }, desc: 'unresolvable reference (warning, not a break)' },
    { id: 'V-DO-v15-A03', breach: 'hash_mismatch', tamper: { 'evaluation.knowledge_references.0.fragment_hash': 'sha256:8888888888888888888888888888888888888888888888888888888888888888' }, desc: 'fragment hash mismatch' },
    { id: 'V-DO-v15-A04', breach: 'hash_mismatch', tamper: { 'context.attachments.0.content_hash': 'sha256:7777777777777777777777777777777777777777777777777777777777777777' }, desc: 'attachment tamper' },
    { id: 'V-DO-v15-A05', breach: 'hash_mismatch', tamper: { 'context.intent.summary_hash': 'sha256:6666666666666666666666666666666666666666666666666666666666666666' }, desc: 'intent pointer tamper' },
    { id: 'V-DO-v15-A06', breach: 'hash_mismatch', tamper: { 'context.memory_keys.0': 'mem-evil' }, desc: 'memory key tamper' },
    { id: 'V-DO-v15-A07', breach: 'tree_snapshot_divergence', semantic: true, tamper: { 'evaluation.matched_rules.0.canonical_tree': { eq: [{ field: 'context.amount' }, '1.00'] } }, desc: 'tree snapshot forgery' },
    { id: 'V-DO-v15-A08', breach: 'hash_mismatch', tamper: { 'result.reason': 'evil reason injected' }, desc: 'type-B text tamper' },
    { id: 'V-DO-v15-A09', breach: 'tree_snapshot_divergence', semantic: true, tamper: { 'evaluation.matched_rules.0.canonical_tree': { eq: ['0.95', { field: 'context.amount' }] } }, desc: 'tree tamper (node order swap)' },
    { id: 'V-DO-v15-A10', breach: 'tree_snapshot_divergence', semantic: true, tamper: { 'evaluation.matched_rules.0.canonical_tree': { eq: [{ field: 'context.amount' }, '0.950'] } }, desc: 'tree tamper (literal precision)' },
  ];

  const aVectors = A_DEFS.map((def) => {
    if (def.semantic) {
      // semantic: tamper + recompute hash (self-consistent); semantic detector reports the specific breach code
      const doObj = buildAnchoredBase(null);
      for (const [p, v] of Object.entries(def.tamper)) setPath(doObj, p, v);
      recomputeHash(doObj);
      return {
        id: def.id, category: 'A', decision_type: 'ALLOW',
        scenario: 'anchor-attack', description: `Anchoring attack: ${def.desc}`,
        decision_object: doObj,
        expected: { type: 'BREACH', breach: def.breach, resolvable_entry_ids: def.resolvable_entry_ids },
      };
    }
    // hash: base self-consistent + tampered (not recomputed) → hash_mismatch
    const base = buildAnchoredBase(def.id + '-base');
    const tampered = JSON.parse(JSON.stringify(base));
    for (const [p, v] of Object.entries(def.tamper)) setPath(tampered, p, v);
    return {
      id: def.id, category: 'A', decision_type: 'ALLOW',
      scenario: 'anchor-attack', description: `Anchoring attack: ${def.desc}`,
      base_do: base, tampered_do: tampered,
      expected: { type: 'BREACH', breach: def.breach },
    };
  });

  // ═══════════════════════════════════════════════════
  //  K series — 1 canary (chain-position canary, continues AV-013)
  // ═══════════════════════════════════════════════════
  function buildCanary() {
    const doObj = buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-k01', name: 'K01', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-k01', chainSeq: 0, previousHash: null,
    });
    // store the hash a "defective implementation" (deleting the whole audit) would compute — a correct implementation deletes only audit.hash, recomputes MISMATCH
    const regressed = JSON.parse(JSON.stringify(doObj));
    delete regressed.audit;
    doObj.audit.hash = 'sha256:' + sha256(jcs(regressed));
    return doObj;
  }
  const kVector = {
    id: 'V-DO-v15-K01', category: 'K', decision_type: 'ALLOW',
    scenario: 'chain-position-canary', description: 'Chain-position canary (defective impl deletes the whole audit, correct impl deletes only audit.hash → MISMATCH)',
    decision_object: buildCanary(),
    expected: { type: 'BREACH', breach: 'canary_mismatch', note: 'correct impl recomputes MISMATCH, defective impl MATCH' },
  };

  // ═══════════════════════════════════════════════════
  //  G series — 14 outcome layer (6 structural attacks + 8 domain examples)
  // ═══════════════════════════════════════════════════
  function buildOutcomeDO(scenario, outcome, answerId) {
    return buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-g', name: 'G', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-g', chainSeq: 0, previousHash: null,
      outcome: { scenario, ...outcome },
      answerId,
    });
  }

  const G_STRUCT = [
    { id: 'V-DO-v15-G01', tamper: { 'result.outcome.verdict': 'rejected' }, desc: 'verdict tamper' },
    { id: 'V-DO-v15-G02', tamper: { 'result.outcome.grade': 'F' }, desc: 'grade·rank tamper' },
    { id: 'V-DO-v15-G03', tamper: { 'result.outcome.basis': [] }, desc: 'basis deletion' },
    { id: 'V-DO-v15-G04', tamper: { 'result.outcome.extra': { note: 'evil' } }, desc: 'extra tamper' },
    { id: 'V-DO-v15-G05', tamper: { 'result.outcome.basis.0': 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }, desc: 'registry reference tamper' },
    { id: 'V-DO-v15-G06', tamper: null, deleteOutcome: true, desc: 'whole-outcome deletion' },
  ];

  const gStructVectors = G_STRUCT.map((def) => {
    const base = buildOutcomeDO('gov.approval', { verdict: 'approved', grade: 'A', rank: 1, basis: ['sha256:verdict-registry-001'], extra: { note: 'test' } }, def.id + '-base');
    const tampered = JSON.parse(JSON.stringify(base));
    if (def.deleteOutcome) {
      delete tampered.result.outcome;
    } else {
      for (const [p, v] of Object.entries(def.tamper)) setPath(tampered, p, v);
    }
    return {
      id: def.id, category: 'G', decision_type: 'ALLOW',
      scenario: 'outcome-structure-attack', description: `Outcome structure attack: ${def.desc}`,
      base_do: base, tampered_do: tampered,
      expected: { type: 'BREACH', breach: 'hash_mismatch' },
    };
  });

  const G_SCENARIOS = [
    { id: 'V-DO-v15-G07', scenario: 'gov.approval', verdict: 'approved', desc: 'Government · administrative approval' },
    { id: 'V-DO-v15-G08', scenario: 'gov.review', verdict: 'passed', desc: 'Government · multi-level review' },
    { id: 'V-DO-v15-G09', scenario: 'gov.selection', verdict: 'selected', rank: 1, desc: 'Government · selection' },
    { id: 'V-DO-v15-G10', scenario: 'gov.appraisal', verdict: 'rated', grade: 'A', desc: 'Government · appraisal' },
    { id: 'V-DO-v15-G11', scenario: 'corp.hiring', verdict: 'hired', desc: 'Enterprise · hiring approval' },
    { id: 'V-DO-v15-G12', scenario: 'corp.procurement', verdict: 'awarded', rank: 2, desc: 'Enterprise · procurement evaluation' },
    { id: 'V-DO-v15-G13', scenario: 'corp.performance', verdict: 'rated', grade: 'B+', desc: 'Enterprise · performance rating' },
    { id: 'V-DO-v15-G14', scenario: 'corp.contract', verdict: 'approved', desc: 'Enterprise · contract approval' },
  ];
  const gScenarioVectors = G_SCENARIOS.map((def) => {
    const outcome = { verdict: def.verdict };
    if (def.rank !== undefined) outcome.rank = def.rank;
    if (def.grade !== undefined) outcome.grade = def.grade;
    const doObj = buildOutcomeDO(def.scenario, outcome, def.id);
    return {
      id: def.id, category: 'G', decision_type: 'ALLOW',
      scenario: 'outcome-domain-example', description: `Outcome domain example: ${def.desc}`,
      decision_object: doObj,
      expected: { type: 'MATCH', note: 'outcome layer self-consistent under flat hash' },
    };
  });

  // ═══════════════════════════════════════════════════
  //  V-COMP series — 32 jurisdiction compliance (7 jurisdiction activation + 14 framework mapping + 11 failure detection)
  // ═══════════════════════════════════════════════════
  // authoritative jurisdiction set (RFC-002 §5.2)
  const KNOWN_JURISDICTIONS = ['CN', 'EU', 'US', 'SG', 'BR', 'IN'];

  const CN_FIELDS = ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no', 'agent.model_registration_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  const EU_FIELDS = ['model_id', 'agent.known_limitations', 'confidence_score', 'fairness_assessment', 'impact_assessment_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  const US_FIELDS = ['model_id', 'confidence_score', 'fairness_assessment', 'impact_assessment_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  const SG_FIELDS = ['autonomy_level', 'confidence_score', 'data_modification_expected'];
  // BR · LGPD (Lei 13.709/2018): Art.20 automated-decision review right → autonomy_level (whether "solely automated");
  // Art.20 §1 inform standards & procedures → model_id; Art.18 erasure + PII separation → sanitized_context;
  // processing traceability → context_snapshot_hash; whether personal data changes → data_modification_expected.
  // LGPD does not explicitly require human intervention (draft requirement removed by the 2019 amendment), so human_oversight is not force-activated.
  const BR_FIELDS = ['model_id', 'data_modification_expected', 'autonomy_level', 'context_snapshot_hash', 'sanitized_context'];
  // IN · DPDP (2023 Act No.22): §12(1)(d) erasure right (purpose fulfilled / consent withdrawn) → sanitized_context;
  // §12(1)(a-c) correction/completion/update → data_modification_expected; §12(2) downstream cascade notification needs traceable data flow → context_snapshot_hash.
  // DPDP has no dedicated automated-decision clause, so autonomy_level / model_id are not activated.
  const IN_FIELDS = ['data_modification_expected', 'context_snapshot_hash', 'sanitized_context'];

  function buildVcompDO(def, answerId) {
    return buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-vcomp', name: 'VCOMP', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-vcomp', chainSeq: 0, previousHash: null,
      jurisdictions: def.juris,
      activatedFields: def.activated,
      riskLevel: def.riskLevel,
      answerId,
    });
  }

  // jurisdiction activation field completeness (RFC-002 §9.1 group 1)
  // signature is added once the S3 signature layer lands; hash-layer vectors do not include it yet (§10.3 planned-frozen)
  const VCOMP_JURIS = [
    { id: 'V-COMP-001', juris: ['CN'], activated: CN_FIELDS, required: CN_FIELDS, desc: 'CN · GB/Z 185' },
    { id: 'V-COMP-002', juris: ['EU'], activated: EU_FIELDS, required: EU_FIELDS, desc: 'EU · AI Act' },
    { id: 'V-COMP-003', juris: ['US'], activated: US_FIELDS, required: US_FIELDS, desc: 'US composite' },
    { id: 'V-COMP-004', juris: ['SG'], activated: SG_FIELDS, required: SG_FIELDS, desc: 'SG · MGF' },
    { id: 'V-COMP-005', juris: ['CN', 'EU'], activated: [...new Set([...CN_FIELDS, ...EU_FIELDS])], required: [...new Set([...CN_FIELDS, ...EU_FIELDS])], desc: 'CN+EU multi-jurisdiction union' },
    { id: 'V-COMP-020', juris: ['BR'], activated: BR_FIELDS, required: BR_FIELDS, desc: 'BR · LGPD' },
    { id: 'V-COMP-021', juris: ['IN'], activated: IN_FIELDS, required: IN_FIELDS, desc: 'IN · DPDP' },
  ];
  const vcompJurisVectors = VCOMP_JURIS.map((def) => {
    const doObj = buildVcompDO(def, def.id);
    return {
      id: def.id, category: 'V-COMP', decision_type: 'ALLOW',
      scenario: 'jurisdiction-activation', description: `Jurisdiction activation field completeness: ${def.desc}`,
      decision_object: doObj, expected: { type: 'MATCH', required_fields: def.required },
    };
  });

  // framework field mapping (RFC-002 §9.1 group 2)
  // activated = JUR fields to activate; required = full checked field paths (incl. CORE/result resident fields); checks = semantic checks
  const VCOMP_FRAMEWORKS = [
    { id: 'V-COMP-006', activated: ['agent.known_limitations'], required: ['evaluation_duration_ms', 'human_oversight', 'agent.known_limitations'], desc: 'EU AI Act Art.12/14/13' },
    { id: 'V-COMP-007', activated: ['model_id', 'confidence_score', 'fairness_assessment'], required: ['model_id', 'confidence_score', 'fairness_assessment'], desc: 'NIST AI RMF' },
    { id: 'V-COMP-008', activated: [], required: ['rule_set_version'], checks: ['sod'], desc: 'COSO GenAI (SoD)' },
    { id: 'V-COMP-009', activated: ['impact_assessment_id'], required: ['impact_assessment_id'], desc: 'ISO/IEC 42001' },
    { id: 'V-COMP-010', activated: ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no'], required: ['agent.aid', 'agent.tool_registry_hash', 'agent.algorithm_filing_no', 'audit.retention'], desc: 'GB/Z 185 (retention ≥36 months)' },
    { id: 'V-COMP-011', activated: [], required: ['result.decision', 'result.reason'], desc: 'OWASP Agentic (explainability)' },
    { id: 'V-COMP-012', activated: ['data_modification_expected', 'sanitized_context'], required: ['data_modification_expected', 'sanitized_context'], desc: 'HIPAA (signature with S3)' },
    { id: 'V-COMP-013', activated: ['data_modification_expected'], required: ['data_modification_expected'], desc: 'PCI DSS (signature with S3)' },
    { id: 'V-COMP-014', activated: ['fairness_assessment'], required: ['result.decision', 'result.reason', 'fairness_assessment'], desc: 'Colorado SB 205' },
    { id: 'V-COMP-015', activated: ['autonomy_level'], required: ['autonomy_level'], desc: 'Singapore MGF' },
    { id: 'V-COMP-016', activated: ['data_modification_expected'], required: ['data_modification_expected', 'result.decision', 'result.reason'], desc: 'CAICT 2.0 (explainability)' },
    { id: 'V-COMP-017', activated: ['sanitized_context'], required: ['sanitized_context'], desc: 'LGPD (right to be forgotten / PII separation)' },
    { id: 'V-COMP-018', activated: ['sanitized_context'], required: ['sanitized_context'], desc: 'DPDP (same as LGPD)' },
    { id: 'V-COMP-019', activated: [], required: ['execution_trace_id'], desc: 'IEEE P3395 (cross-system correlation)' },
  ];
  const vcompFrameworkVectors = VCOMP_FRAMEWORKS.map((def) => {
    const doObj = buildVcompDO(def, def.id);
    return {
      id: def.id, category: 'V-COMP', decision_type: 'ALLOW',
      scenario: 'framework-field-mapping', description: `Framework field mapping: ${def.desc}`,
      decision_object: doObj, expected: { type: 'MATCH', required_fields: def.required, checks: def.checks || [] },
    };
  });

  // F01..F11 failure detection (RFC-002 §9.1 group 3)
  // semantic (F01/F03/F04/F05): hash self-consistent + semantic detector reports the specific breach
  // hash (F02/F06/F07): base self-consistent + tampered (not recomputed) → hash_mismatch
  function buildFBase(answerId, opts) {
    return buildDO({
      decisionType: 'ALLOW',
      context: { operation: 'read' },
      rules: [Rule({ id: 'rule-f', name: 'F', when: eq(field('context.operation'), 'read'), then: 'ALLOW', priority: 100, ring: 3 })],
      chainId: 'chain-vcomp-f', chainSeq: 0, previousHash: null,
      activatedFields: CN_FIELDS,
      ...opts,
      answerId,
    });
  }
  const fVectors = [];
  {
    // F01 activated field missing (agent.aid in activated_fields but physically missing; hash self-consistent)
    const doObj = buildFBase(null, { omitFields: ['agent.aid'] });
    fVectors.push({ id: 'V-COMP-F01', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: activated field missing', decision_object: doObj, expected: { type: 'BREACH', breach: 'compliance_field_missing' } });
  }
  {
    // F02 compliance profile swapped (profile_hash tampered, not recomputed → hash_mismatch)
    const base = buildFBase('V-COMP-F02-base');
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.compliance_profile.profile_hash = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';
    fVectors.push({ id: 'V-COMP-F02', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: compliance profile swapped', base_do: base, tampered_do: tampered, expected: { type: 'BREACH', breach: 'hash_mismatch' } });
  }
  {
    // F03 jurisdiction mismatch (jurisdictions=['XX']; hash self-consistent → jurisdiction_mismatch)
    const doObj = buildFBase(null, { jurisdictions: ['XX'] });
    fVectors.push({ id: 'V-COMP-F03', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: jurisdiction mismatch', decision_object: doObj, expected: { type: 'BREACH', breach: 'jurisdiction_mismatch' } });
  }
  {
    // F04 high risk without human oversight (riskLevel=high but human_oversight.required=false; hash self-consistent → oversight_missing)
    const doObj = buildFBase(null, { riskLevel: 'high' });
    fVectors.push({ id: 'V-COMP-F04', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: high-risk decision without human oversight', decision_object: doObj, expected: { type: 'BREACH', breach: 'oversight_missing' } });
  }
  {
    // F05 SoD violation (policies[].author_id = agent.id; hash self-consistent → sod_violation)
    const doObj = buildFBase(null, { authorId: AGENT_ID });
    fVectors.push({ id: 'V-COMP-F05', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: SoD violation', decision_object: doObj, expected: { type: 'BREACH', breach: 'sod_violation' } });
  }
  {
    // F06 first-layer compliance claim tampered (agent.known_limitations, not recomputed → hash_mismatch)
    const base = buildFBase('V-COMP-F06-base', { activatedFields: EU_FIELDS, jurisdictions: ['EU'] });
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.agent.known_limitations = ['evil claim injected'];
    fVectors.push({ id: 'V-COMP-F06', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: first-layer compliance claim tampered', base_do: base, tampered_do: tampered, expected: { type: 'BREACH', breach: 'hash_mismatch' } });
  }
  {
    // F07 filing & identity fields tampered (agent.algorithm_filing_no, not recomputed → hash_mismatch)
    const base = buildFBase('V-COMP-F07-base');
    const tampered = JSON.parse(JSON.stringify(base));
    tampered.agent.algorithm_filing_no = 'EVIL-2026-999999';
    fVectors.push({ id: 'V-COMP-F07', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Compliance failure: filing & identity fields tampered', base_do: base, tampered_do: tampered, expected: { type: 'BREACH', breach: 'hash_mismatch' } });
  }
  {
    // F08 risk-condition layer not effective: risk_level=critical but the profile did not include signature in activated_fields
    // (RFC-002 §5.2 critical → signature mandatory). decisionType=REQUEST_HUMAN makes human_oversight.required=true,
    // ruling out oversight_missing interference — a vector MUST contain a single breach, not depend on unspecified detection priority.
    const doObj = buildFBase(null, { riskLevel: 'critical', decisionType: 'REQUEST_HUMAN' });
    fVectors.push({ id: 'V-COMP-F08', category: 'V-COMP', decision_type: 'REQUEST_HUMAN', scenario: 'compliance-failure', description: 'Compliance failure: critical risk did not activate signature (risk-condition layer not effective)', decision_object: doObj, expected: { type: 'BREACH', breach: 'compliance_field_missing' } });
  }
  {
    // F09 critical activated signature but the field is missing (value-level missing; JUR_VALUES has no signature value → physically missing).
    // This is the half the hash layer can verify: presence. The accepted critical positive case (signature mode + verify) belongs to the signature layer, landing with V-SIGN.
    const doObj = buildFBase(null, { riskLevel: 'critical', decisionType: 'REQUEST_HUMAN', activatedFields: [...CN_FIELDS, 'signature'] });
    fVectors.push({ id: 'V-COMP-F09', category: 'V-COMP', decision_type: 'REQUEST_HUMAN', scenario: 'compliance-failure', description: 'Compliance failure: critical activated signature but field missing', decision_object: doObj, expected: { type: 'BREACH', breach: 'compliance_field_missing' } });
  }
  {
    // F10 multi-breach — pins the top of the priority order: P1 jurisdiction_mismatch before P2 compliance_field_missing.
    // Both hold: jurisdiction code XX unrecognized (P1) + activated field agent.aid physically missing (P2).
    // Purpose: prevent "fabricated jurisdiction code + empty/incomplete activation set" from masking field-completeness failure (RFC §9.1.1).
    const doObj = buildFBase(null, { jurisdictions: ['XX'], omitFields: ['agent.aid'] });
    fVectors.push({ id: 'V-COMP-F10', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Multi-breach priority: unrecognized jurisdiction code + missing activated field → report P1', decision_object: doObj, expected: { type: 'BREACH', breach: 'jurisdiction_mismatch', also_present: ['compliance_field_missing'] } });
  }
  {
    // F11 multi-breach — pins the bottom of the priority order: P5 tree_snapshot_divergence before P6 content_unresolvable.
    // Both hold: tree snapshot inconsistent with the rule source (P5 evidence-layer real breach) + knowledge reference unresolvable (P6 warning-level).
    // Purpose: a warning-level (cold-storage deletion / retention expiry) MUST NOT mask an evidence-layer breach (RFC §9.1.1).
    // The old ordering reports content_unresolvable; the spec ordering reports tree_snapshot_divergence — this vector has discriminating power.
    const doObj = buildFBase(null, {
      extra: {
        evaluation: {
          knowledge_references: [{ entry_id: 'kb-deleted-by-retention', entry_version: 'v1', content_hash: VIRTUAL_SHA256, fragment_hash: VIRTUAL_SHA256 }],
        },
      },
    });
    // forge tree snapshot (diverges from policies[0].when eq(context.operation,'read')); recompute hash to stay self-consistent
    setPath(doObj, 'evaluation.matched_rules.0.canonical_tree', { eq: [{ field: 'context.operation' }, 'write'] });
    recomputeHash(doObj);
    fVectors.push({ id: 'V-COMP-F11', category: 'V-COMP', decision_type: 'ALLOW', scenario: 'compliance-failure', description: 'Multi-breach priority: tree snapshot divergence (evidence) + unresolvable reference (warning) → report P5; warnings must not mask breaches', decision_object: doObj, expected: { type: 'BREACH', breach: 'tree_snapshot_divergence', resolvable_entry_ids: ['kb-001'], also_present: ['content_unresolvable'] } });
  }

  const output = {
    $schema: 'https://openoba.com/erdl/decision-object-v1.5/schema.json',
    spec: SPEC,
    preimage_version: PREIMAGE_VERSION,
    version: 'v1.5.0',
    created: '2026-08-22',
    maintainer: 'OpenOBA (https://openoba.com)',
    description: 'V-DO-v15 hash-layer vectors (D + C + A + K + G + V-COMP series). Flat hash: JCS(DO − audit.hash) → SHA-256.',
    vectors: [...dVectors, ...cVectors, ...aVectors, kVector, ...gStructVectors, ...gScenarioVectors, ...vcompJurisVectors, ...vcompFrameworkVectors, ...fVectors],
  };

  // ── answer-oracle full coverage (RUNNER_CONTRACT R4 Check 2 + R5 canary Check 2) ──
  // one key per DO: decision_object → <id>; tamper pair → <id>-base / <id>-tampered; chain → <id>[i].
  // keys already registered by buildDO are re-registered here with the same value (idempotent); the new ones are attack-chain members / tampered / semantic-tamper DOs / canary.
  for (const v of output.vectors) {
    if (v.decision_object) registerAnswer(v.id, v.decision_object);
    if (v.base_do) {
      registerAnswer(v.id + '-base', v.base_do);
      registerAnswer(v.id + '-tampered', v.tampered_do);
    }
    if (v.chain) v.chain.forEach((d, i) => registerAnswer(`${v.id}[${i}]`, d));
  }

  const outputPath = path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  // answer file (canonical_hex physically isolated)
  const answersPath = path.join(__dirname, '..', 'decision-object-answers-v1.5.json');
  fs.writeFileSync(answersPath, JSON.stringify({ answers }, null, 2), 'utf8');

  console.log(`  ✓ wrote ${outputPath}`);
  console.log(`  ✓ wrote answer file ${answersPath} (${Object.keys(answers).length} canonical_hex entries)`);
  console.log(`  D series: ${dVectors.length}`);
  console.log(`  C series: ${cVectors.length}`);
  console.log(`  A series: ${aVectors.length}`);
  console.log(`  K series: 1`);
  console.log(`  G series: ${gStructVectors.length + gScenarioVectors.length} (structural attacks ${gStructVectors.length} + domain examples ${gScenarioVectors.length})`);
  console.log(`  V-COMP series: ${vcompJurisVectors.length + vcompFrameworkVectors.length + fVectors.length} (jurisdiction ${vcompJurisVectors.length} + framework ${vcompFrameworkVectors.length} + failure detection ${fVectors.length})`);  const total = dVectors.length + cVectors.length + aVectors.length + 1 + gStructVectors.length + gScenarioVectors.length + vcompJurisVectors.length + vcompFrameworkVectors.length + fVectors.length;
  console.log(`  total: ${total}`);
}

main();
