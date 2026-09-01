# RUNNER_CONTRACT.md — Decision Object Verification Runner Conformance Contract

> This contract is the **authoritative definition** (RULE) of normative behavior. What a conforming runner (a verifier conforming to the contract) does and does not do, which fields do not enter the preimage, which failures must be exposed — an independent implementor can implement a verifier from first principles **on this contract alone**, without reading the reference implementation.
>
> The contract, the oracle, and the reference implementation are three-way separated:
> - **This contract** = the rules (normative behavior spec);
> - **Answers file** `decision-object-answers-v1.5.json` = byte-level diagnostic oracle (an oracle, not the rules themselves, physically isolated);
> - **Reference implementation** `scripts/verify-v1.5.js` = an instance of a conforming runner (not the spec).

---

## 1. Conformance requirements (MUST)

A conforming runner MUST satisfy all of the following requirements. Each is individually testable; failing any one means not conforming.

### R1 — Recompute audit.hash (single deletion point)

For each DO: deep clone → **delete `audit.hash` itself (+ defensively delete `signature`/`signing_key_id` per R2)** → JCS (RFC 8785) canonicalization → SHA-256 → prefix `"sha256:"` → byte-compare with the stored `audit.hash`.

```
audit.hash = "sha256:" + HEX( SHA-256( UTF8( JCS( DO − audit.hash ) ) ) )
```

- Deletion semantics are unified: delete (delete key), blanking forbidden — the two produce different JCS bytes;
- All other fields (CORE + JURISDICTION + extensions + `canonical_tree`) **participate unconditionally** — no whitelist, no projection, no verifier-side field selection.

### R2 — Preimage field exclusion

MUST exclude (do not enter the hash preimage):

| Field | Exclusion reason |
|------|---------|
| `audit.hash` | Self-reference (single deletion point) |
| `signature` / `signing_key_id` | Signature-mode fields (do not exist in hash mode; the defensive deletion is a no-op) |

Self-reference exclusion for intra-field hashes: when computing `policies[].hash` and `compliance_profile.profile_hash`, the field being computed MUST be temporarily removed; its already-computed value participates in the whole-DO flat hash as an ordinary field. The preimage of `policies[].hash` **excludes gloss** (gloss is a render product, not rule content).

### R3 — Failures must be exposed (breach codes)

A conforming runner MUST expose the corresponding breach code in the following cases (silent passes forbidden):

**Single DO** (MUST report the first hit per the §9.1.1 priority P1→P6; and MUST verify the vector's `expected.also_present` — declared items must actually hold and be suppressed; anything that holds simultaneously but is not declared is judged a defect): `jurisdiction_mismatch` (P1, semantics narrowed to "the jurisdiction code is not in the authoritative six-jurisdiction set", RFC-002 §9.1.2) / `compliance_field_missing` (P2, including `risk_level=critical` but `activated_fields` does not include `signature`) / `oversight_missing` (P3) / `sod_violation` (P4) / `tree_snapshot_divergence` (P5) / `content_unresolvable` (P6, **warning-level MUST be last**) — detection rules see `docs/VERIFIER-GUIDE.md` §4.1.

**Chain** (in priority order): `hash_mismatch` → `version_unsupported` → `chain_genesis_mismatch` → `previous_hash_dangling` → `chain_seq_gap` → `mode_mixed_chain` → `time_regression`.

**Time anchoring** (with the signature layer): `clock_drift_detected` / `timestamp_anchor_missing`.

> **Cross-layer semantic re-derivation check (outside R1–R6 scope)**: `decision_divergence` is a cross-layer semantic re-derivation check (uses the `@openoba/erdl` evaluator, RFC-002 §1.5 semantics), not a hash-layer/field check under this contract's R1–R6. It covers decision-rule coherence, not record-emission fidelity (RFC-002 Appendix A P-05). Script: `scripts/verify-decision.mjs`.

### R4 — Dual verification (Check 1 + Check 2)

A conforming runner MUST pass both gates:

| Gate | Verification object | Verification content |
|----|---------|---------|
| **Check 1** | The artifact's self-reported `audit.hash` | Recomputed hash vs the artifact's self-reported hash (this is the verification that actually happens in the **deployment scenario**) |
| **Check 2** | The independent answers file | Recomputed canonical bytes vs the oracle (this is the **reproduction** check, catching byte drift) |

Passing only one of the two does not constitute conformance — the July lesson: a runner may pass the oracle yet never check the artifact's self-reported hash, or vice versa.

### R5 — The canary must discriminate

The canary `V-DO-v15-K01` (corresponding to AV-013 in the v1.3 era) MUST produce a distinguishable result on a conforming runner:

- Correct implementation (deletes only `audit.hash`) → recomputed hash ≠ stored hash → **MISMATCH**;
- Defective implementation (deletes the entire `audit`) → recomputed hash = stored hash → MATCH (caught).

**Acceptance criterion**: `Check 1 = MISMATCH` and `Check 2 = MATCH` (canonical bytes consistent with the oracle, proving the mismatch is at the hash layer rather than the byte layer) — the canary is correctly discriminated.

### R6 — Must not read the answers file (neutrality)

A conforming runner MUST **implement JCS (RFC 8785) itself**, and MUST NOT read the answers file to "pass" verification (reading is bypassing independent verification, violating the neutrality commitment). The answers file serves only as the **after-the-fact cross-check** of Step 6, provided from outside the verification flow, and is unreadable by compliant runs.

---

## 2. Conformance determination

A runner satisfying all of R1–R6 is declared conforming. The determination method:

1. **Self-implementation**: implement from first principles based on this contract + RFC 8785 (dependency on the ERDL SDK / json-canonicalize forbidden);
2. **Vector-by-vector verification**: run on all vectors of `decision-object-vectors-v1.5.json`, passing the dual gates of Check 1 + Check 2;
3. **Canary discrimination**: K01 satisfies Check 1 MISMATCH + Check 2 MATCH;
4. **Auto-record**: CI runs `scripts/generate-conformance.cjs`, auto-generating [conformance/CONFORMANCE.md](conformance/CONFORMANCE.md) after verification passes (recording who, on what date, passed how many vectors + Check 1/2 + K01 discrimination + R1–R6 comparison conclusions) — the results are produced by the verification run itself, not hand-written endorsement;
5. **Submission and registration (automatic)**: PR to `submissions/`; after CI cross-verification passes, automatically registered in the [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) registry on merge (`scripts/update-registry.cjs` derives from `submissions/*.json`; failures are not registered).

---

## 3. Acceptance Test

**In the absence of the reference implementation**, to independently determine from the contract text whether a runner is conforming, the most powerful acceptance test is the canary:

> Given `V-DO-v15-K01`, if an implementation returns MISMATCH on Check 1 and MATCH on Check 2, then its "independent recompute" behavior is consistent with the contract; if it returns MATCH (Check 1), then it skips independent recompute — not conforming.

The canary is therefore the "honesty sentinel": it does not verify whether the algorithm is right or wrong, but verifies "whether the verifier is actually recomputing independently".

---

## 4. Diagnostic oracle (answers file)

The answers file `decision-object-answers-v1.5.json` is a **byte-level diagnostic oracle**, separated from the contract:

- It stores the `canonical_hex` of **all DOs in the vector set** (JCS output UTF-8 bytes converted to hex), not only MATCH-type:
  - `<id>` —— single-DO vector (including BREACH types and the canary);
  - `<id>-base` / `<id>-tampered` —— the two sides of a tamper-pair vector;
  - `<id>[i]` —— the i-th member of a chain vector (including attack chains);
- **The only exclusion (version gate)**: DOs whose `audit.preimage_version` is not this version's constant **MUST NOT** have an oracle key — a conforming runner, per R1/Step 1, must terminate early (`version_unsupported`), and by definition produces no canonical bytes from this version's pipeline; registering an oracle for it would be luring the verifier into bypassing the version gate (the only instance in v1.5: `V-DO-v15-C07[1]`);
- Physically isolated (`.gitignore`), unreadable by submitters/CI;
- Use: the byte-level cross-check of Check 2, catching **byte drift** (algorithm correct but serialization details wrong);
- Not the rules themselves — conformance is defined by the contract, not by "matching the oracle".

### 4.1 Coverage invariants (MUST, automatically checkable)

| Invariant | Meaning | Consequence of violation |
|------|------|---------|
| **Zero missing oracle** | Every applicable DO (version supported) MUST have exactly one oracle key | Check 2 becomes nominal only on that DO; byte drift invisible |
| **Zero dead keys** | Every oracle key MUST be read by the runner | The oracle is decoupled from the vector set, creating an "illusion of coverage" |
| **Version-gate exclusion** | DOs with unsupported versions MUST have no oracle key | The verifier may skip the version gate to fudge bytes |

The reference runner has implemented the three invariants as hard-failure guards, and reports coverage in its report (`107/107 applicable DOs + 1 N/A`; the only N/A = the version gate of `V-DO-v15-C07[1]`).

---

> *"Neutrality is measured, not claimed." — The contract lets any implementation conform from first principles; the oracle catches byte drift; the canary catches honesty. Only the three combined can support the claim of being "stronger than being consistent with one's own generator".*
