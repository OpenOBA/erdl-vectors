# ERDL Decision Object — Cross-Implementation Test Vectors

> **Version**: v1.2 (Draft)  
> **Status**: Request for Comments  
> **Maintainer**: OpenOBA  
> **License**: MIT

## Overview

This repository contains the ERDL Decision Object v1.2 cross-implementation test vectors, verification tools, and supporting documentation. The Decision Object (DO) is a standardized, tamper-evident audit format for AI Agent rule evaluation decisions, based on JCS (RFC 8785) + SHA-256.

## Repository Structure

```
erdl-vectors/
├── docs/
│   ├── WHITEPAPER-v1.2-DRAFT-3.md       # White paper (Chinese)
│   └── WHITEPAPER-v1.2-DRAFT-3.en.md    # White paper (English) — in progress
├── knowledge/
│   ├── regulatory/                       # 12 global regulatory frameworks
│   │   ├── 01-EU-AI-Act-2024.md
│   │   ├── 02-NIST-AI-RMF-2023.md
│   │   ├── ...                           # (12 files total)
│   │   └── 12-CAICT-Trusted-AI-Agent-2-2026.md
│   └── spec/                             # ERDL specification references
│       ├── erdl-spec-v1.1.md
│       ├── erdl-spec-v1.1.en.md
│       └── erdl-spec-v1.2.md
├── scripts/                              # (forthcoming)
│   ├── verify.js                         # Universal verification script
│   └── generate-vectors.cjs             # Vector generation script (maintainer use)
├── decision-object-vectors-v1.2.json     # (forthcoming) 101 test vectors
└── README.md
```

## Vector Set (v1.2)

| Category | Count | Description |
|----------|:-----:|-------------|
| Static Decision Vectors | 63 | 13 decision types + 13 operators + edge cases |
| Dynamic Decision Vectors | 26 | Temporal(10) + Seeded(8) + Stateful(8) |
| Audit Hash Vectors | 12 | AV-001~AV-008 + 4 new (CORRECT/NOTIFY/ROLLBACK/WORKFLOW) |
| **Total** | **101** | |

DELEGATE decision type is defined in SPEC v1.2 but reserved for v1.3 (reference implementation pending).

## Compatibility Levels

| Level | Requirement | Vectors |
|:-----:|-------------|:-------:|
| L1 Basic | All v1.0 vectors | 28 |
| L2 Verified | All v1.1 vectors | 45 |
| L3 Full | All v1.2 vectors | 101 |

## Quick Start (forthcoming)

```bash
# Verify your ERDL implementation
node scripts/verify.js --vectors decision-object-vectors-v1.2.json
```

## Previous Versions

- **v1.1** (Deprecated): [erdl-vectors-1.1](https://github.com/OpenOBA/erdl-vectors-1.1) — 45 vectors, validated by three independent implementations
- **v1.0** (Deprecated): 28 vectors, frozen

## References

- RFC 8785 — JSON Canonicalization Scheme (JCS)
- FIPS 186-5 — Digital Signature Standard (ECDSA P-256)
- FIPS 180-4 — Secure Hash Standard (SHA-256)
- [ERDL Specification v1.1](https://openoba.github.io/erdl-landing/)
- IETF Agent Audit Trail: [draft-sharif-agent-audit-trail-00](https://datatracker.ietf.org/doc/draft-sharif-agent-audit-trail/)

---

> *"Deterministic architecture, not prompt engineering. Neutrality is tested, not declared."*
>
> — OpenOBA · 2026-07-27 · ERDL Decision Object v1.2 RFC
