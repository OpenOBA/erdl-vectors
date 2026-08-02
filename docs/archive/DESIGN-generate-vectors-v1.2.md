# DESIGN: generate-vectors.cjs — v1.3 Vector Generator Architecture

> Copyright (c) 2026 Tang Qixin. All rights reserved.

> Version: 2.1 · 2026-07-29
> Status: Released
> Authority: SPEC v1.1 §3.4 + RFC 001 §13
> Strategy: v1.2 -> v1.3 upgrade (with third-party audit fixes)

---

## 0. Strategy

### Why not inherit v1.0/v1.1?

1. **v1.2 is a breaking change**: `policies[].hash` upgraded to JCS, `rule_set_version` participates in JCS, flat hashing changed `audit.hash` formula.
2. **v1.1 coverage incomplete**: 37 DOs covering only 7/13 decision types.
3. **New version should self-prove completeness**: 63 static vectors with explicit mapping per decision type x per operator.

### What is inherited from v1.0/v1.1?

Not data, but **technical pitfalls experience**. 10 pitfalls + 4 extra constraints documented in DESIGN-vector-inventory-v1.2.md Part A.

---

## 1. Vector Scale (Authority: RFC 001 §13.2)

```
Static Decision Vectors:   63  (13 decision types x 5-6 representative scenarios)
Dynamic Decision Vectors:  26  (Temporal 10 + Seeded 8 + Stateful 8)
Audit Hash Vectors:        12  (AV-001~AV-012 + AV-013 chain integrity canary)
Total:                     101
```

**DELEGATE reserved**: DO-064 and AV-013 reserved for v1.4.

---

## 2. Decision Type Inventory

SPEC v1.1 defines 13 externally visible decision types:

| # | Decision Type | Ring | Vector Coverage |
|---|--------------|:---:|:---:|
| 1 | ALLOW | 3 | DO-011,012,020,024,026,030,041-043,046-048 |
| 2 | DENY | 0 | DO-001,003,005,008,010,025,044,049,061,063 |
| 3 | CORRECT | 3 | DO-021-023 |
| 4 | REQUEST_HUMAN | 2 | DO-013,015,016,045 |
| 5 | ESCALATE | 2 | DO-017-019 |
| 6 | NOTIFY | 3 | DO-031-034 |
| 7 | EMERGENCY_HALT | 0 | DO-009 |
| 8 | QUARANTINE | 1 | DO-035-037 |
| 9 | ROLLBACK | 1 | DO-038-040 |
| 10 | WORKFLOW | 3 | DO-051-054 |
| 11 | WORKFLOW_WAITING | 3 | DO-055-057 |
| 12 | WORKFLOW_PROGRESS | 3 | DO-058-060 |
| 13 | PASS | — | DO-002,004,006,007,014,027-029,050,062 |
| (14) | DELEGATE | 2 | Reserved for v1.4 |

---

## 3. Flat Hashing Calculation Flow

v1.3: `audit` object contains `hash` + `previous_hash` + `commitment`.

```
For each DO:

Step 0: Build compliance_profile (without profile_hash)
        -> JCS(cp) -> SHA-256 -> write back profile_hash

Step 1: Assemble full DO JSON (24 fields + sub-objects)

Step 2: Compute rule_set_version.id
        = 'sha256:' + SHA-256(JCS(policies))

Step 3: Compute policies[].hash (JCS upgrade)
        policy.hash = 'sha256:' + SHA-256(JCS(policy))

Step 4: Deep clone -> operate on copy

Step 5: Delete self-referencing / external fields
        delete clone.audit.hash (v1.3: only hash, keep previous_hash + commitment)
        delete clone.signature
        delete clone.signing_key_id
        // extensions stays directly in JCS

Step 6: Main JCS + SHA-256
        canonicalFull = JCS(CORE + JURISDICTION + EXTENSIONS + previous_hash + commitment)
        auditHash = 'sha256:' + SHA-256(canonicalFull)

Step 7: Write back
        clone.audit.hash = auditHash
        clone.signature = originalSignature
```

---

## 4. Audit Hash Vectors

12 AVs selected from 63 static DOs covering 11 decision types + AV-013 canary:

| AV | Source | Decision | Purpose |
|----|--------|---------|---------|
| AV-001 | DO-001 | DENY | Ring 0 security intercept |
| AV-002 | DO-013 | REQUEST_HUMAN | PII compliance |
| AV-003 | DO-011 | ALLOW | Override safe-direction |
| AV-004 | DO-009 | EMERGENCY_HALT | Ring 0 short-circuit |
| AV-005 | DO-017 | ESCALATE | Low-reputation agent |
| AV-006 | DO-024 | ALLOW | Unless exemption |
| AV-007 | DO-027 | PASS | Null-safe field access |
| AV-009 | DO-021 | CORRECT | Auto-correction |
| AV-010 | DO-031 | NOTIFY | Anomaly notification |
| AV-011 | DO-038 | ROLLBACK | Snapshot rollback |
| AV-012 | DO-051 | WORKFLOW | Multi-step workflow |
| AV-013 | DO-051 | (canary) | Chain position tampering detection |

### AV-013 Construction

```
AV-013 DO body has tampered previous_hash (points outside chain).
But stored audit.hash was computed with the original previous_hash.
Correct runners recomputing from the DO body detect MISMATCH.
Shortcut validators (comparing pre-computed hashes) falsely report MATCH.
```

---

> "Neutrality is tested, not declared."
