# ERDL Decision Object · Cross-Implementation Verification Vectors v1.5

> Copyright © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.) · MIT License

> **Spec basis**: ERDL-DOBJ-RFC-002 — Decision Object v1.5 flat-hash chain ([`docs/OPENOBA-DOBJ-RFC-002-CN.md`](docs/OPENOBA-DOBJ-RFC-002-CN.md))
> **Vector version**: v1.5.0 · Core vectors 301 (audit layer 78 + expression layer 223)
> **Based on the ERDL design**: [ERDL (Entity-Rule Definition Language)](https://github.com/OpenOBA/erdl-landing) — a declarative rule-execution protocol; the Decision Object is the audit record of its decisions; for the data model see [ERDL spec v2.0](https://github.com/OpenOBA/erdl-landing/blob/main/spec/erdl-spec-v2.0.md)

A cross-implementation verification benchmark for AI governance: a set of neutral test vectors that belong to no single implementation. Any runner, in any language and any tech stack, can implement JCS (RFC 8785) + SHA-256 independently from first principles on the spec alone, recompute Decision Object hashes byte by byte, and compare.

> **Who, on what date, passed how many vectors — measured, not claimed.**

## Why independent verification is needed

AI Agents are increasingly making decisions on behalf of enterprises: approving, releasing, denying, escalating. When the decision-maker itself is software, governance trust cannot rest on a single vendor's claims — it must be verifiable by any independent implementation.

If a spec has only one implementation that "passes", there is no way to distinguish "the spec is correct" from "this implementation happens to be consistent with its own generator". Only when multiple mutually unrelated implementations, each starting from the spec text and implementing independently, arrive at byte-identical results does the spec itself stand as established.

This repository is the measurement site for this verification: the vectors are neutral, the answers are isolated, the records are automatic, and nobody endorses anybody.

## Decision Object: the audit record of every decision

The Decision Object is the audit record of one decision of the ERDL rule engine — designed on the basis of [ERDL (Entity-Rule Definition Language)](https://github.com/OpenOBA/erdl-landing), fully recording the matched rules, matched operators, and evaluation context at the moment the decision occurred. The data model and hash rules are defined in the spec [`docs/OPENOBA-DOBJ-RFC-002-CN.md`](docs/OPENOBA-DOBJ-RFC-002-CN.md).

Its integrity is anchored by the hash chain:

- **Tamper-proof evidence**: with `audit.hash` itself removed from the object, JCS (RFC 8785) canonicalization followed by SHA-256 yields the self-reported `audit.hash` (`sha256:` prefix); tampering with any field causes the audit hash to mismatch — detectable and traceable;
- **Three-layer evidence system**: hash proves integrity, signature proves identity, timestamp proves time;
- **Flat-hash chain**: decision records are chained by `previous_hash`; attacks such as history tampering, record deletion, dangling pointers, clock regression, whole-chain rebuild, version downgrade, and mixed chains are all modeled as detectable scenarios (see the chain-attack vectors below).

## Cross-implementation verification: call for independent Runners

**This is the core purpose of this repository.**

The 78 audit-layer vectors are a neutral benchmark: they presuppose no language, framework, or tech stack — only the spec itself. We openly call for independent runners:

1. Read only the spec and the contract: [RUNNER_CONTRACT.md](RUNNER_CONTRACT.md) (rules R1–R6) + [docs/VERIFIER-GUIDE.md](docs/VERIFIER-GUIDE.md) + RFC-002;
2. **Implement JCS (RFC 8785) + SHA-256 yourself** — no dependency on `json-canonicalize` or any third-party canonicalizer (R6);
3. Recompute all 78 vectors in `decision-object-vectors-v1.5.json` vector by vector, passing the dual gates of Check 1 (self-consistent with the artifact's self-reported `audit.hash`) + Check 2 (canonical bytes byte-identical with the independent oracle);
4. The canary K01 must be correctly discriminated: Check 1 MISMATCH + Check 2 MATCH (see the verification principles below);
5. Submit `canonical_hex` + `k01_check1` (see [submissions/README.md](submissions/README.md)); CI cross-verifies, and after merge the result is automatically registered in the [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) registry.

Byte-identical recomputation proves that this standard holds under your implementation. The current v1.5 78 vectors are passed only by the reference implementation, with no third-party verification yet — the registry is empty, waiting for a name.

## A2A context

The A2A (Agent-to-Agent) protocol ecosystem is growing rapidly. When agents begin to delegate decisions to one another, approve one another, and exchange evidence, cross-implementation trust cannot rest on bilateral endorsements; it must be built on a foundation that is independently verifiable — the decision record produced by one agent must be byte-verifiable by the other side's independent implementation.

The Decision Object verification system follows exactly this standardization path (proposed by Erik Newton in A2A Discussion #2031):

> **Three independent implementations + one open spec + no single owner.**

Every independent runner is both a verification of this spec and one brick added to the trust infrastructure of the A2A era.

## Vector system

Core total **301** = V-DO-v15 audit layer 78 + V-ENGINE expression layer 223.

### Coverage overview

| Verification layer | Category | Coverage object | Count | Status |
|--------|------|---------|:---:|------|
| Audit layer | V-DO-v15 | Decision types 13 / chain attacks 8 / anchoring 10 / canary 1 / conclusion 14 / jurisdiction 32 | 78 | Unverified |
| Expression layer | V-ENGINE | Node semantics 136 + evaluation constraints 35 + Simple compilation 30 | 201 | Unverified |
| Expression layer | V-GLOSS / V-PROJ | gloss 16 (render 12 + completeness 4) + projection facets 6 | 22 | Unverified |
| **Total** | | **Core** | **301** | **Unverified** |

**Verification status (binary)**:

- **Verified**: only the historical v1.3 13 AV vectors (Erik Newton / Concordia, 2026-07-30, self-built Python JCS, byte-identical pass), superseded by v1.5;
- **Unverified**: all 301 vectors of the current v1.5, passed only by the reference implementation, awaiting verification by independent third-party Runners.

**Planned, not generated (not counted)**: signature V-SIGN 5 + time anchoring TSA 3 + state verification V-TEMPORAL 4.

> **Vector files**: `decision-object-vectors-v1.5.json` (V-DO-v15 audit layer, 78 vectors) + `v-engine-vectors.json` (V-ENGINE expression layer, 223 vectors).

### V-DO-v15 audit layer (78 vectors)

| Category | Number range | Count | Content |
|------|------|:---:|------|
| Decision-type coverage | V-DO-v15-D01..D13 | 13 | 13 decision types × flat hash (with the canonical_tree field) |
| Chain-attack detection | V-DO-v15-C01..C08 | 8 | Normal-chain baseline + 7 attacks (tamper / record deletion / dangling pointer / clock regression / whole-chain rebuild / version downgrade / mixed chain) |
| Anchoring-attack detection | V-DO-v15-A01..A10 | 10 | Knowledge / reference / fragment / attachment / intent / memory / tree snapshot / tree tamper / type-B text |
| Canary | V-DO-v15-K01 | 1 | Chain-position canary (continues the AV-013 pattern) |
| Conclusion layer | V-DO-v15-G01..G14 | 14 | Structural attacks fixed 6 + domain examples 8 (government 4 + enterprise 4) |
| Jurisdiction compliance | V-COMP-001..021 + F01..F11 | 32 | Field conformance 21 (jurisdiction 7 + framework 14) + failure detection 11 (including first-layer tamper / risk-condition layer / priority pinning) |
| **Hash-layer total** | | **78** | D / C / A / K / G / V-COMP |

Planned, not generated, not counted: time anchoring V-DO-v15-T01..T03 (3 vectors), signature chain V-SIGN-001..005 (5 vectors), to be added after the signature layer is implemented.

### V-ENGINE expression layer (223 vectors)

Node semantics 136 (34 nodes × 4 scenarios) + evaluation constraints 35 (the E1–E12 vectorizable subset) + Simple compilation 30 (operators) + gloss 16 (render 12 + completeness 4) + projection-facet compilation 6.

### Extension (grows with industries)

`V-JURIS` / `V-SCENE` / `V-STAKE` / `V-NL` grow with industry knowledge packs; new entries are placed under freeze management; the Core baseline is append-only (only grows, never shrinks) during the baseline-fixing period.

## Quick start (Runner-oriented)

### 0. Read the contract first

- Normative contract: [RUNNER_CONTRACT.md](RUNNER_CONTRACT.md) — the authoritative definition of R1–R6 and conformance determination; a verifier can be implemented from first principles on the contract alone;
- Implementation guide: [docs/VERIFIER-GUIDE.md](docs/VERIFIER-GUIDE.md) — fields, breach codes, Check 1/2 detection rules;
- Spec text: [docs/OPENOBA-DOBJ-RFC-002-CN.md](docs/OPENOBA-DOBJ-RFC-002-CN.md).

### 1. Local verification (reference implementation)

```bash
npm install             # install dependencies (json-canonicalize is used only by the reference pipeline for deterministic comparison, vitest for tests; runners themselves MUST NOT depend on it)
npm run generate          # generate the 78 V-DO vectors + answers file (canonical_hex physically isolated, .gitignore)
npm run generate:vengine  # generate the 223 V-ENGINE vectors (@openoba/erdl reference engine)
npm run verify            # V-DO Five-Step Verification Step 0–6 + semantic breach detection
npm run verify:vengine    # V-ENGINE expression-layer independent verification (57 semantics-sensitive vectors)
npm run verify:vengine:full  # V-ENGINE full 223 vectors
npm run conformance       # auto-generate conformance/CONFORMANCE.md (Check 1/2 + K01 + R1–R6 conformance report)
npm test                  # vitest regression suite (including web/Node consistency + adversarial regression gates)
```

### 2. Online verification (no install required)

Open `web/verify.html` (browser-side self-built JCS + Web Crypto SHA-256): paste a single DO to verify its hash, or load the vector file to verify all 78 vectors. It can be opened by double-clicking (file://), or hosted locally with `npx serve web/`.

### 3. Submit your verification results

Follow [submissions/README.md](submissions/README.md):

1. Fork this repository, implement JCS (RFC 8785) + SHA-256 yourself from the spec + contract (no SDK), and run all 78 vectors successfully;
2. Write into `submissions/<your-runner-name>-output.json`: the **canonical_hex** of each vector (the JCS output bytes after deleting `audit.hash`, hex-encoded) + **k01_check1** (must be `"MISMATCH"`);
3. Open a PR — CI cross-verifies byte by byte (`verify-submission.cjs`) and posts the result back;
4. After merge, automatically registered in the [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) registry (`scripts/update-registry.cjs` derives from `submissions/*.json`; failures are not registered).

**Auto-record**: after CI verification passes, [conformance/CONFORMANCE.md](conformance/CONFORMANCE.md) is auto-generated, recording "who, on what date, passed how many vectors" + Check 1/2 + K01 discrimination + R1–R6 comparison conclusions — the results are produced by the verification run itself, not hand-written endorsement, and CI has a freshness gate (stale → red).

## Verification principles

- **Measurements, not endorsements**: the registry records only measurement facts — who, on what date, passed how many vectors; no certification, no endorsement, no guarantee.
- **The canary is the honesty sentinel**: the stored hash of canary K01 was produced by a defective implementation that "deletes the entire `audit` object". A correct implementation deletes only `audit.hash`, and the recompute necessarily mismatches — **only Check 1 MISMATCH + Check 2 MATCH counts as correct discrimination** (the mismatch is at the hash layer, not the byte layer); a runner returning MATCH on Check 1 has skipped independent recompute and is caught on the spot.
- **Answer isolation**: the answer oracle (`decision-object-answers-v1.5.json`, canonical_hex) is physically isolated (`.gitignore`), unreadable by submitters and compliant runs; conformance is defined by the contract, not by "matching the oracle".
- **Cross-implementation parity**: the same vector yields byte-identical results under TS / Python / Rust (with Go as an optional fourth implementation).
- **Every vector has attribution**: each vector explicitly states which object it verifies; coverage forms a matrix; regressions are catchable.

## Acknowledgments

Collaborators who contributed to the neutral-verification principle of this spec:

- **Christopher Hopley (chopmob-cloud / AlgoVoi)** — independent technical reviewer. In the v1.2 / v1.3 audits he found key issues such as the missing self-reference hash-exclusion rule and cross-engine string-decimal inconsistency, driving the establishment of the flat-hash architecture; his clean-room RFC 8785 JCS + SHA-256 checker reported four technical findings (C1–C4) and three security issues (S1–S3), among which the dual-hash-algorithm downgrade (CWE-757) and the schema_ref SSRF attack surface directly drove security hardening.
- **Erik Newton (Concordia)** — the first independent Runner implementer, proposer of the principle "neutrality is not claimed, but measured". In A2A Discussion #2031 he established the standardization path of "three independent implementations, one open spec, no single owner"; byte-verified all 13 AV vectors of v1.3 with a Python spec-only implementation (self-built JCS); contributed the chain-integrity canary design, the answer-file separation architecture, and the CI verification architecture of generated-artifact + clean-room + registry.
- **Rulsynor team** — the reference rule-engine implementation; provided real engineering-constraint input for the Decision Object field design; the baseline for test-vector generation.

## Archive note

| Directory | Content | Status |
|------|------|------|
| `archive/v1.3/` | v1.3 full set: 101 AV vectors + generation/verification scripts + tests + RFC-001 (CN/EN) + design docs + Runner registry | Historical archive + JCS regression suite |

After archiving, the v1.3 AV-* numbering is not reused and does not coexist with V-DO-v15 in the current audit layer.

---

> *Neutrality is measured, not claimed.*
