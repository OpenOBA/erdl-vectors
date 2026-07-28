# ERDL Decision Object v1.2 — Cross-Implementation Test Vectors

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **Version**: v1.2.0  
> **Status**: Released  
> **Maintainer**: OpenOBA (https://openoba.com)  
> **License**: MIT

## Background

The ERDL Decision Object is the standardized, tamper-evident audit trail for AI Agent rule evaluation. Unlike opaque AI outputs, every decision is fully traceable — which rules fired, which operator matched, what context was evaluated — sealed by JCS (RFC 8785) canonicalization and SHA-256 hashing. This repository provides the authoritative cross-implementation test vectors that allow any ERDL-compliant rule engine to prove its correctness independently.

## Acknowledgments

This project would not have been possible without the generous support of our collaborators:

- **Christopher Hopley (chopmob-cloud / AlgoVoi)** — proposed the compliance substrate model and the cross-implementation verification vision. His independent audit of ERDL Decision Object v1.1 uncovered the c3f22df incident (em-dash whitespace fix causing 3/7 audit vector hash mismatches), which drove v1.2's adoption of hierarchical hashing and strict deterministic generation standards. His deep understanding of regulatory compliance and cryptographic audit shaped every aspect of the Decision Object's design.
- **Erik Newton (Concordia)** — the first independent Runner implementer. His Python-based Decision Object verification engine confirmed the first 5 audit vectors (AV-001~AV-005) byte-for-byte across two independent implementations, proving that JCS+SHA-256 cross-implementation verification works in practice, not just in theory. He also identified the structural risk of `expected_sha256` answer keys, directly leading to the seven-step verification algorithm in v1.2.
- **Rulsynor Team** — the reference ERDL rule engine serving as the canonical implementation against which all vectors are generated and validated. Their production-grade engine provided real-world constraints that shaped the Decision Object's field design, from agent identity metadata to compliance profile structure.

We are deeply grateful for their contributions, which transformed a specification into a verified, cross-implementation standard.

## Overview

This repository contains the authoritative set of **101 cross-implementation test vectors** for the ERDL (Entity-Rule Definition Language) Decision Object v1.2 protocol. Each vector is a complete, self-verifiable Decision Object — the standardized, tamper-evident audit format for AI Agent rule evaluation decisions.

### Core Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| **Deterministic generation** | `node scripts/generate-vectors.cjs` produces byte-identical output every run |
| **Tamper-evident** | JCS (RFC 8785) + SHA-256 hierarchical hashing — any field change alters the audit hash |
| **Cross-implementation verifiable** | `node scripts/verify.js` works with zero dependencies — implementers can validate their own engines |
| **Stale-regression detection** | AV-008 acts as a canary — validators that skip seven-step verification will **fail** |
| **RFC 9562 UUIDv7** | All `decision_id`/`execution_trace_id` fields are fully RFC 9562 compliant (frozen timestamp) |

### Deterministic Architecture

```
$ node scripts/generate-vectors.cjs
$ sha256sum decision-object-vectors-v1.2.json
700a683dc76a65487cf97ebef321fba378cb0c141b966cdd13ebd26c40282aca

$ node scripts/generate-vectors.cjs  # second run
$ sha256sum decision-object-vectors-v1.2.json
700a683dc76a65487cf97ebef321fba378cb0c141b966cdd13ebd26c40282aca  # identical
```

No `Date.now()`, no `crypto.randomBytes()`. Frozen timestamp (`2026-07-28T00:00:00.000Z`) + deterministic counter → **exact reproducibility**.

## Quick Start

### Verify an existing vectors file

```bash
npm install
node scripts/verify.js                    # default: ./decision-object-vectors-v1.2.json
node scripts/verify.js path/to/vectors.json
```

Expected: `ALL VERIFICATIONS PASSED · 11/11 MATCH + AV-008 STALE DETECTED`

### Generate vectors from scratch (maintainer use)

```bash
npm install
node scripts/generate-vectors.cjs
# → outputs decision-object-vectors-v1.2.json (~830 KB)
```

### Run test suite

```bash
npm test
# → 156 tests covering JCS, SHA-256, 7-step verification, and full vector integrity
```

## Vector Set Composition

### Static Decision Vectors (63)

| Decision Type | Count | Coverage |
|---------------|:-----:|----------|
| ALLOW | 11 | Normal ops, override safe-direction, unless exemption, operator coverage |
| DENY | 12 | Security baseline, dangerous commands, critical paths, edge cases |
| PASS | 10 | Selective match, safe commands, empty rules, null-safe, strict types |
| REQUEST_HUMAN | 4 | PII/HIPAA compliance, business hours, risk thresholds |
| EMERGENCY_HALT | 1 | Ring 0 short-circuit |
| CORRECT | 3 | Case normalization, unit conversion, path normalization |
| ESCALATE | 3 | Low-reputation agent, cross-domain, unknown tools |
| NOTIFY | 3 | Anomaly detection, audit logging, threshold warnings |
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
| AV-008 | AV-003 | ⚠️ **Stale regression canary** — MUST mismatch |
| AV-009 | DO-021 | Auto-correction (CORRECT) |
| AV-010 | DO-031 | Anomaly notification (NOTIFY) |
| AV-011 | DO-038 | Snapshot rollback (ROLLBACK) |
| AV-012 | DO-051 | Multi-step workflow (WORKFLOW) |

### Reserved for v1.3

| ID | Type | Status |
|----|------|--------|
| DO-064 | DELEGATE | Reserved for v1.3 |
| AV-013 | DELEGATE (audit) | Reserved for v1.3 |

## Seven-Step Audit Hash Verification

The verification algorithm (Whitepaper §13.3) follows seven deterministic steps:

```
Step A: Extract extensions from decision_object
Step B: Compute extensions_hash → compare with stored value
Step C: Delete self-referencing fields (extensions, audit, signature, signing_key_id)
Step D: JCS (RFC 8785) canonicalize the remaining fields
Step E: SHA-256 the canonical representation
Step F: Compare computed hash with stored audit.hash
```

Any validator that shortcuts this process (e.g., by comparing pre-computed hashes directly) will **pass AV-001~AV-012 but fail AV-008** — the stale regression canary catches lazy implementations.

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
├── decision-object-vectors-v1.2.json   # 101 vectors (~830 KB)
├── scripts/
│   ├── generate-vectors.cjs            # Deterministic vector generator
│   └── verify.js                       # Zero-dependency 7-step verifier
├── test/
│   ├── generate-comprehensive.test.ts  # 68 generator integrity tests
│   └── verify-comprehensive.test.ts    # 88 JCS/verification/audit tests
├── docs/
│   ├── RUNNERS-GUIDE.md                # Implementation guide for Runner developers
│   ├── DESIGN-generate-vectors-v1.2.md # Generator architecture
│   ├── DESIGN-vector-inventory-v1.2.md # Full 63 DO inventory
│   ├── DESIGN-verify-js-v1.2.md        # Verifier architecture
│   ├── WHITEPAPER-v1.2-DRAFT-3.md      # Whitepaper (Chinese)
│   └── WHITEPAPER-v1.2-DRAFT-3.en.md   # Whitepaper (English)
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
| **L3 — Full** | v1.2 all 101 vectors including stale regression detection | 101 |

## For Runner Implementers

If you're building an ERDL rule engine and want to achieve cross-implementation compatibility, start with **[Runner's Guide](docs/RUNNERS-GUIDE.md)**. It covers the seven-step verification algorithm, JCS implementation details, common pitfalls, and testing strategy — with pseudocode you can translate to any language.

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
> — OpenOBA · 2026-07-28 · ERDL Decision Object v1.2
