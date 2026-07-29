# ERDL Decision Object v1.3 — Cross-Implementation Test Vectors

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **Version**: v1.3.0  
> **Status**: Released  
> **Maintainer**: OpenOBA (https://openoba.com)  
> **License**: MIT

## Background

The ERDL Decision Object is the standardized, tamper-evident audit trail for AI Agent rule evaluation. Unlike opaque AI outputs, every decision is fully traceable — which rules fired, which operator matched, what context was evaluated — sealed by JCS (RFC 8785) canonicalization and SHA-256 hashing. This repository provides the authoritative cross-implementation test vectors that allow any ERDL-compliant rule engine to prove its correctness independently.

## Acknowledgments

This project would not have been possible without the generous support of our collaborators:

- **Christopher Hopley (chopmob-cloud / AlgoVoi)** — independent technical critic. His review of the ERDL Decision Object v1.2 draft identified critical issues including self-referential hash exclusion gaps, cross-engine string-to-number canonicalization inconsistencies, and layered integrity weaknesses, directly leading to the adoption of the flat hashing architecture. **In the v1.3 audit, he built a clean-room RFC 8785 JCS + SHA-256 checker to verify the spec's internal consistency, reporting four technical findings (C1~C4) and three security findings (S1~S3) — including the dual-hash algorithm downgrade (CWE-757) and schema_ref SSRF attack surface that directly drove §9.6 and §11.2 security hardening.** His deep understanding of JCS RFC 8785 canonicalization and compliance auditing shaped the protocol's rigor.
- **Erik Newton (Concordia)** — the first independent Runner implementer and the originator of the principle "neutrality is tested, not declared." He established the "three independent implementations, one open specification, no single owner" standardization path in A2A Discussion #2031. His Python-based verification engine confirmed the first 5 audit vectors byte-for-byte, later extended to all 28 compliance vectors — proving JCS+SHA-256 cross-implementation verification works in practice. During the v1.1 freeze-period audit, he independently identified the `expected_sha256` structural risk, leading to stale regression vectors. **In the v1.3 audit, he verified all 12 AV vectors (AV-001~AV-012) with his independent RFC 8785 canonicalizer, confirming 11 byte-perfect matches and AV-008 correctly failing — "a clean result." He also identified three critical issues: spec-code deletion inconsistency (E1), previous_hash/commitment exclusion enabling chain position tampering (E2), and canonical_hex leaking JCS answers (E3) — directly driving the v1.3 audit structure fix, AV-013 chain integrity canary, and answers file separation architecture.**
- **Rulsynor Team** — the reference ERDL rule engine serving as the canonical implementation against which all vectors are generated and validated. Their production-grade engine provided real-world constraints that shaped the Decision Object's field design, from agent identity metadata to compliance profile structure.

We are deeply grateful for their contributions, which transformed a specification into a verified, cross-implementation standard.

## Overview

This repository contains the authoritative set of **101 cross-implementation test vectors** for the ERDL (Entity-Rule Definition Language) Decision Object v1.3 protocol. Each vector is a complete, self-verifiable Decision Object — the standardized, tamper-evident audit format for AI Agent rule evaluation decisions.

### Core Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| **Deterministic generation** | `node scripts/generate-vectors.cjs` produces byte-identical output every run |
| **Tamper-evident** | JCS (RFC 8785) + SHA-256 flat hashing — any field change alters the audit hash |
| **Cross-implementation verifiable** | `node scripts/verify.js` works with zero dependencies — implementers can validate their own engines |
| **Chain integrity detection** | AV-013 acts as a canary — validators that exclude previous_hash from JCS will **fail** |
| **RFC 9562 UUIDv7** | All `decision_id`/`execution_trace_id` fields are fully RFC 9562 compliant (frozen timestamp) |

### Deterministic Architecture

```
$ node scripts/generate-vectors.cjs
$ sha256sum decision-object-vectors-v1.3.json
├── decision-object-answers-v1.3.json      # Answers file (debug builds only; conformance runners MUST NOT read) / 答案文件（调试用，合规运行不可读）
a28c37dc6895706d84541e48a5cce74a36a903a5f524af59e9457554e800f369

$ node scripts/generate-vectors.cjs  # second run
$ sha256sum decision-object-vectors-v1.3.json
a28c37dc6895706d84541e48a5cce74a36a903a5f524af59e9457554e800f369  # identical
```

No `Date.now()`, no `crypto.randomBytes()`. Frozen timestamp (`2026-07-29T00:00:00.000Z`) + deterministic counter → **exact reproducibility**.

## Quick Start

### Verify an existing vectors file

```bash
npm install
node scripts/verify.js                    # default: ./decision-object-vectors-v1.3.json
node scripts/verify.js path/to/vectors.json
```

Expected: `ALL VERIFICATIONS PASSED · 11/11 MATCH + AV-013 CHAIN CANARY DETECTED`

### Generate vectors from scratch (maintainer use)

```bash
npm install
node scripts/generate-vectors.cjs
# → outputs decision-object-vectors-v1.3.json (~813 KB)
```

### Run test suite

```bash
npm test
# → 152 tests covering JCS, SHA-256, five-step verification, and full vector integrity
```

## Vector Set Composition

### Static Decision Vectors (63)

| Decision Type | Count | Coverage |
|---------------|:-----:|----------|
| ALLOW | 12 | Normal ops, override safe-direction, unless exemption, operator coverage |
| DENY | 12 | Security baseline, dangerous commands, critical paths, edge cases |
| PASS | 10 | Selective match, safe commands, empty rules, null-safe, strict types |
| REQUEST_HUMAN | 4 | PII/HIPAA compliance, business hours, risk thresholds |
| EMERGENCY_HALT | 1 | Ring 0 short-circuit |
| CORRECT | 3 | Case normalization, unit conversion, path normalization |
| ESCALATE | 3 | Low-reputation agent, cross-domain, unknown tools |
| NOTIFY | 4 | Anomaly detection, audit logging, threshold warnings, accompanying DENY |
| QUARANTINE | 3 | Suspicious files, anomalous behavior, rate limiting |
| ROLLBACK | 3 | Snapshot restore, partial failure, trade rollback |
| WORKFLOW | 4 | Multi-step workflows, conditional branches, approvals |
| WORKFLOW_WAITING | 3 | Human approval, time windows, predecessor tasks |
| WORKFLOW_PROGRESS | 3 | Step advancement, phase completion, final steps |

**Operators covered**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `matches`, `starts_with`, `ends_with`, `exists` (13 total)

**Edge cases**: null-propagation, strict-type-matching, ReDoS protection, rate-limiting, integer-safe-range, object-deep-comparison, empty-extension-normalization

### Dynamic Vectors (26)

| Category | Count | Description |
|----------|:-----:|-------------|
| Temporal (T-001~T-010) | 10 | Time-of-day, day-of-week, holidays, leap year, Y2K38 boundary |
| Seeded (S-001~S-008) | 8 | Deterministic random seeds for reproducible evaluation |
| Stateful (ST-001~ST-008) | 8 | State machine transitions (idle→running→paused→error→recovering→stopped) |

### Audit Hash Vectors (12)

| Vector | References | Purpose |
|--------|------------|---------|
| AV-001 | DO-001 | Ring 0 security intercept (DENY) |
| AV-002 | DO-013 | PII compliance (REQUEST_HUMAN, GDPR Art.22) |
| AV-003 | DO-011 | Override safe-direction (ALLOW, multi-rule) |
| AV-004 | DO-009 | Ring 0 EMERGENCY_HALT short-circuit |
| AV-005 | DO-017 | Low-reputation agent (ESCALATE) |
| AV-006 | DO-024 | Unless exemption (ALLOW) |
| AV-007 | DO-027 | Null-safe field access (PASS) |
| AV-013 | DO-051 | Chain position tampering canary — the stored audit.hash was computed with the correct previous_hash, but the DO body carries a tampered previous_hash pointing outside the chain. A correct runner recomputing from the body detects the mismatch |
| AV-009 | DO-021 | Auto-correction (CORRECT) |
| AV-010 | DO-031 | Anomaly notification (NOTIFY) |
| AV-011 | DO-038 | Snapshot rollback (ROLLBACK) |
| AV-012 | DO-051 | Multi-step workflow (WORKFLOW) |

### Reserved for v1.3

| ID | Type | Status |
|----|------|--------|
| DO-064 | DELEGATE | Reserved for v1.3 |
| AV-013 | DELEGATE (audit) | Reserved for v1.3 |

## Five-Step Audit Hash Verification

The verification algorithm (Whitepaper §13.3) follows five deterministic steps:

```
Step 1: Deep clone decision_object
Step 2: Delete self-referencing fields (audit.hash — keep previous_hash and commitment; signature; signing_key_id)
        (extensions stays in the tree — participates directly in main JCS)
Step 3: JCS (RFC 8785) canonicalize the entire remaining object
Step 4: SHA-256 the canonical representation
Step 5: Compare computed hash with stored audit.hash
```

Any validator that shortcuts this process (e.g., by comparing pre-computed hashes directly) will **pass AV-001~AV-007, AV-009~AV-012 but fail AV-013** — the chain integrity canary catches lazy implementations.

## Compliance Profile

All vectors embed the `erdl-compliance-v1.2` profile with references to:

| Framework | Jurisdiction | Effective Date |
|-----------|-------------|----------------|
| EU AI Act (Regulation 2024/1689) | EU | 2027-12-02 |
| GB/Z 185-2026 | CN | 2026-05-22 |
| NIST AI RMF 1.0 | US | Current |
| COSO GenAI 2026 | ALL | Current |

See `knowledge/regulatory/` for full reference documentation on all 12 frameworks.

## Repository Structure

```
erdl-vectors/
├── decision-object-vectors-v1.3.json   # 101 vectors (~813 KB)
├── scripts/
│   ├── generate-vectors.cjs            # Deterministic vector generator
│   └── verify.js                       # Zero-dependency five-step verifier
├── test/
│   ├── generate-comprehensive.test.ts  # 67 generator integrity tests
│   └── verify-comprehensive.test.ts    # 86 JCS/verification/audit tests
├── docs/
│   ├── RUNNERS-GUIDE.md                # Implementation guide for Runner developers
│   ├── DESIGN-generate-vectors-v1.2.md # Generator architecture
│   ├── DESIGN-vector-inventory-v1.2.md # Full 63 DO inventory
│   ├── DESIGN-verify-js-v1.3.md        # Verifier architecture
│   ├── WHITEPAPER-v1.3-DRAFT-4.md      # Whitepaper (Chinese)
│   └── WHITEPAPER-v1.3-DRAFT-4.en.md   # Whitepaper (English)
├── knowledge/
│   ├── regulatory/                     # 12 regulatory frameworks
│   └── spec/                           # ERDL specification references
├── CHANGELOG.md                        # Version history
├── CONTRIBUTING.md                     # Contribution guidelines
├── package.json
├── README.md                           # 中文版
└── README.en.md                        # This file (English)
```

## Compatibility Levels

| Level | Requirement | Vectors |
|:-----:|-------------|:-------:|
| **L1 — Basic** | v1.0 Decision Object structure + JCS + SHA-256 | 28 |
| **L2 — Verified** | v1.1 all vectors + dynamic vectors | 45 |
| **L3 — Full** | v1.2 all 101 vectors including chain integrity detection | 101 |

## For Runner Implementers

If you're building an ERDL rule engine and want to achieve cross-implementation compatibility, start with **[Runner's Guide](docs/RUNNERS-GUIDE.md)**. It covers the five-step verification algorithm, JCS implementation details, common pitfalls, and testing strategy — with pseudocode you can translate to any language.

## Security

This vector set has undergone independent third-party security review covering JCS correctness, SHA-256 usage, deterministic reproducibility, and cryptographic hygiene. 0 critical or high-severity findings.

## References

- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS)
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562) — Universally Unique IDentifiers (UUID)
- [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) — Secure Hash Standard (SHA-256)
- [ERDL Specification v1.1](https://openoba.github.io/erdl-landing/)
- [IETF Agent Audit Trail](https://datatracker.ietf.org/doc/draft-sharif-agent-audit-trail/)

---

> *"Deterministic architecture, not prompt engineering. Neutrality is tested, not declared."*
>
> — OpenOBA · 2026-07-29 · ERDL Decision Object v1.3
