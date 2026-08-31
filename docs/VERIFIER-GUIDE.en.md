# ERDL Decision Object v1.5 — Runner Verification Guide (Self-Contained Implementation Specification)

> Aimed at independent Runners (third-party verifiers). This document is **self-contained** — without reading the full RFC-002 and SPEC, one can independently implement a verifier and verify `decision-object-vectors-v1.5.json` vector by vector.
>
> The **normative contract** is in [RUNNER_CONTRACT.md](../RUNNER_CONTRACT.md) (rules R1–R6, the authoritative definition of conforming); this document is the **implementation guide** (HOW); the contract is the **rules** (RULE). Authoritative basis: `docs/OPENOBA-DOBJ-RFC-002-CN.md` (hash/chain/vector system) + ERDL spec v2.0 (data model/semantics).

---

## 0. The core proposition of verification

The Decision Object (DO) is the tamper-proof audit record of a single decision by an AI Agent. The only question a Runner must answer:

> **Does `audit.hash` equal the recompute result of "all DO fields (with only `audit.hash` itself deleted) through JCS canonicalization + SHA-256"?**

The canary vector additionally answers: **Can a correct implementation be distinguished from a defective implementation that "skips independent recompute"?**

---

## 1. Hash formula (single deletion point)

```
audit.hash = "sha256:" + HEX( SHA-256( UTF8( JCS( DO − audit.hash ) ) ) )
```

- **Deletion point (R2)**: delete `audit.hash` itself (self-reference exclusion), and defensively delete `signature`/`signing_key_id` — in hash mode the latter two do not exist and the deletion is a no-op; in signature mode they MUST be removed. The reference implementation and the generator both implement the three-field deletion (strictly isomorphic, avoiding future preimage divergence between the two ends of signature-mode vectors).
- **Deletion semantics are unified**: delete (delete key); blanking forbidden (blank: empty string / empty object / placeholder value) — the two produce different JCS bytes.
- **All other fields** (CORE + JURISDICTION + extensions + `canonical_tree`) **participate unconditionally** — no whitelist, no projection, no verifier-side field selection.
- **Self-reference exclusion for intra-field hashes**: when computing `policies[].hash` and `compliance_profile.profile_hash`, the hash key of the field being computed MUST be temporarily removed; its already-computed value participates in the whole-DO flat hash as an ordinary field.
- **The preimage of `policies[].hash` excludes gloss**: gloss is a render product (does not enter the DO); its tampering is detected by render validation (`gloss == render(tree)`), not by hash mismatch.

---

## 2. JCS implementation constraints (RFC 8785, strictly zero customization)

| # | Constraint | Rule |
|---|------|------|
| 1 | Object key order | UTF-16 code-unit order (`Object.keys().sort()`); DO field names are all ASCII, no ordering ambiguity |
| 2 | Numbers | IEEE 754 double-precision serialization (ECMA-262 §7.1.12.1, V8/Ryu reference) |
| 3 | Integer constraint | number fields MUST be safe integers (`Number.isInteger` and \|v\| ≤ 2^53−1); business decimals (amounts/ratios) enter the DO as fixed-point strings, native number forbidden |
| 4 | Strings | Preserved as-is; a lone surrogate (e.g. U+DEAD) MUST error and terminate; the minimal canonical representation of fixed-point decimal strings is completed on the generator side (no trailing zeros / no decimal point on integers / no scientific notation / no leading zeros) |
| 5 | NFC | Normalization done once at the engine data-entry point; the JCS process itself has zero normalization |
| 6 | Omit over Null | Optional field null/undefined/empty array → physically delete the key; **exceptions**: ① the chain-anchoring field `audit.previous_hash` MUST be preserved when the first record is null; ② the `extensions` empty array MUST be preserved |
| 7 | Array order | MUST NOT reorder array elements (array order is a semantic fact) |
| 8 | Invalid values | NaN / Infinity / BigInt / Symbol / Function / Date / non-plain object → reject |

**Reference implementation** (Node.js, zero dependencies, directly comparable):

```js
function jcsCanonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('NaN/Infinity');
    return String(value);
  }
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new Error('lone surrogate');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(jcsCanonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + jcsCanonicalize(value[k])).join(',') + '}';
  }
  throw new Error('unsupported type');
}
```

---

## 3. Five-Step Verification (Step 0–6, 7 steps)

> "Five-step" is a historically inherited name: the v1.3 method was Step 1–5 (five steps); v1.5 added Step 0 (version routing) and Step 6 (answers double-check), for 7 steps total.

Execute in order for each DO:

| Step | Action | Explanation |
|:---:|------|------|
| 0 | Version discrimination | Contains `canonical_tree` or `audit.preimage_version` → v1.5 flat-hash path; otherwise v1.3 historical path (this verifier handles v1.5 only) |
| 1 | Read the domain separator | `audit.preimage_version` MUST equal `"erdl-do-v1.5-hash-flat"` (domain separator, prevents cross-version collisions) |
| 2 | Integer constraint | Recursively assert that all number fields of the whole DO are safe integers |
| 3 | Deletion point | deep clone → `delete clone.audit.hash` + defensive `delete clone.signature` / `delete clone.signing_key_id` |
| 4 | JCS | `canonical = jcsCanonicalize(clone)` |
| 5 | SHA-256 | `computed = "sha256:" + sha256(UTF8(canonical))` |
| 6 | Compare | `computed === audit.hash` → MATCH; otherwise hash_mismatch |

**Answers-file cross-check (Step 6, optional)**: for MATCH-type vectors, convert the UTF-8 bytes of `canonical` to hex (`canonical_hex`) and compare against the independent answers file; byte-identical is required to count as cross-implementation consistency.

---

## 4. Semantic breach detection (not a hash fallback)

Hash self-consistency ≠ no attack. Semantic-type vectors, after tampering, **remain hash self-consistent upon recompute**, forcing the verifier to detect the specific breach code with semantic detectors.

### 4.1 Single-DO breach (RFC-002 §9.1/§9.3)

**Detection priority (MUST, RFC-002 §9.1.1)**: when multiple hold simultaneously, report the **first hit** in P1→P6 order; isomorphic to the chain layer in §4.2. Table row order is the priority.

| Priority | breach code | Detection rule |
|:---:|-----------|---------|
| P1 | `jurisdiction_mismatch` | Any value in `compliance_profile.jurisdictions` is not in the authoritative set {CN, EU, US, SG, BR, IN}. **Semantics narrowed to "unrecognizable jurisdiction code" (fail-closed)**; "declared jurisdiction ≠ deployment expectation" is outside this code's scope (a stateless verifier does not hold the deployment expectation; see RFC-002 §9.1.2); implementations MUST NOT extend the set on their own |
| P2 | `compliance_field_missing` | Any field in `activated_fields` is missing in the DO; **or** `risk_level === 'critical'` but `activated_fields` does not include `signature` (risk-condition layer not effective, RFC-002 §5.2) |
| P3 | `oversight_missing` | `risk_level ∈ {high, critical}` and `human_oversight.required !== true` |
| P4 | `sod_violation` | `agent.id === policies[].author_id` (separation-of-duties violation) |
| P5 | `tree_snapshot_divergence` | `evaluation.matched_rules[].canonical_tree` inconsistent with the JCS after recompiling `policies[].when` |
| P6 | `content_unresolvable` | `knowledge_references[].entry_id` not in the resolvable set (**warning, not a break → MUST be last**; otherwise the warning would mask co-occurring real violations) |

The priority is pinned by the two multi-breach vectors **V-COMP-F10** (P1 suppresses P2) and **V-COMP-F11** (P5 suppresses P6).

**`also_present` verification (MUST)**: for semantic BREACH vectors, a conforming runner MUST simultaneously verify three things —
① `expected.breach` equals the first item after priority sorting; ② every item in `also_present` actually holds and sorts after the first item;
③ any breach that holds simultaneously but is not declared is judged a vector-set defect. The reference implementation treats this as a hard failure (not a warning).

### 4.2 Chain breach (RFC-002 §8, detection priority)

Check in order; return on hit:

1. Any DO's hash recompute mismatches → `hash_mismatch`
2. Any record's `preimage_version` unsupported → `version_unsupported`
3. Genesis block `previous_hash !== null` → `chain_genesis_mismatch`
4. `previous_hash !== previous record.hash` → `previous_hash_dangling`
5. `chain_seq !== previous record.chain_seq + 1` → `chain_seq_gap`
6. Adjacent records have different `audit.mode` → `mode_mixed_chain`
7. `timestamp < previous record.timestamp` → `time_regression`

### 4.3 Time-anchoring breach (RFC-002 §9.5, lands with the signature layer)

| breach code | Detection rule |
|-----------|---------|
| `clock_drift_detected` | Deviation between `DO.timestamp` and the TSA time inside `timestamp_proof.token` > threshold (default 60s) |
| `timestamp_anchor_missing` | `timestamp_proof` missing when decision type ∈ {DELEGATE, ESCALATE, REQUEST_HUMAN} |

---

## 5. Vector file format

`decision-object-vectors-v1.5.json` top-level structure:

```jsonc
{
  "$schema": "...",
  "spec": "SPEC v2.0",
  "preimage_version": "erdl-do-v1.5-hash-flat",
  "version": "v1.5.0",
  "created": "2026-08-22",
  "vectors": [
    // One of three shapes:
    // ① decision_object: standalone DO (MATCH positive example / semantic BREACH / canary)
    { "id": "V-DO-v15-D01", "category": "D", "decision_type": "ALLOW",
      "scenario": "...", "description": "...",
      "decision_object": { ... },
      "expected": { "type": "MATCH" } },

    // ② chain: DO chain (normal chain C01 + attack chains C02~C08)
    { "id": "V-DO-v15-C03", "category": "C",
      "chain": [ {...}, {...} ],
      "expected": { "type": "BREACH", "breach": "chain_seq_gap" } },

    // ③ base_do + tampered_do: tamper pair (base self-consistent, tampered mismatch)
    { "id": "V-COMP-F06", "category": "V-COMP",
      "base_do": { ... }, "tampered_do": { ... },
      "expected": { "type": "BREACH", "breach": "hash_mismatch" } }
  ]
}
```

**expected.type semantics**:

- `MATCH`: hash self-consistent, and all `required_fields` present, and `checks` (e.g. sod) not violated;
- `BREACH`: hash self-consistent (semantic types) or hash mismatch (hash types); the semantic detector / chain detector must detect the exact value of `expected.breach`.

---

## 6. Canary (K01)

The canary stores "the hash a defective implementation would compute":

- Correct implementation: deletes only `audit.hash` (previous_hash preserved) → recomputed hash ≠ stored hash → **MISMATCH**;
- Defective implementation: deletes the entire `audit` → recomputed hash = stored hash → MATCH (caught).

If the runner's verifier returns MATCH on the canary, it has "skipped independent recompute" — the regression is caught.

---

## 7. Full worked example

Given the minimal DO (D01 decision-type coverage):

```json
{
  "agent": { "id": "agent-001", "role": "guardian", "version": "v1.5.0" },
  "decision_type": "ALLOW",
  "audit": {
    "mode": "hash",
    "preimage_version": "erdl-do-v1.5-hash-flat",
    "previous_hash": null,
    "chain_id": "chain-d01",
    "chain_seq": 0,
    "hash": "sha256:..."
  }
}
```

Verification steps: deep clone → `delete audit.hash` → JCS yields the canonical string of `{"agent":{"id":"agent-001",...},...}` → SHA-256 → `"sha256:" + hex` → compare with the stored `audit.hash`. Fields are sorted, null preserved/deleted per the rules, strings as-is, numbers natively serialized.

---

## 8. Submission

See [submissions/README.md](../submissions/README.md) (submission format + steps) and [IMPLEMENTATIONS.md](../IMPLEMENTATIONS.md) (registry):

1. Implement JCS (RFC 8785) + SHA-256 independently, **dependency on the ERDL SDK / json-canonicalize forbidden**;
2. Verify `decision-object-vectors-v1.5.json` vector by vector, collecting the canonical bytes;
3. Canary K01 under a correct implementation MUST MISMATCH (`k01_check1 = "MISMATCH"`);
4. PR to `submissions/` (format see [submissions/README.md](../submissions/README.md): `canonical_hex` + `k01_check1`).
5. After CI cross-verification (`verify-submission.cjs`) passes, automatically registered in the registry on merge (`update-registry.cjs`), and `conformance/CONFORMANCE.md` is generated.

**Online verification tool**: verify a single DO's hash without installing anything; see `web/verify.html` (browser-side self-built JCS + Web Crypto SHA-256).

---

> *"Neutrality is measured, not claimed." — This guide lets any Runner recompute independently with a tech stack different from the vendor's, eliminating the risk of "having to trust the vendor".*
