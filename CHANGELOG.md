# Changelog — ERDL Decision Object Test Vectors

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

## v1.2.0 (2026-07-28)

### Decision Vectors
- **101 vectors total** (63 static DO + 26 dynamic + 12 audit hash)
- 13 decision types fully covered: ALLOW, DENY, PASS, REQUEST_HUMAN, EMERGENCY_HALT, CORRECT, ESCALATE, NOTIFY, QUARANTINE, ROLLBACK, WORKFLOW, WORKFLOW_WAITING, WORKFLOW_PROGRESS
- 13 operators fully covered: eq, neq, gt, gte, lt, lte, in, not_in, contains, matches, starts_with, ends_with, exists
- 7 edge cases: null-propagation, strict-type-matching, ReDoS-protection, rate-limiting, integer-safe-range, object-deep-comparison, empty-extension-normalization
- DO-064 (DELEGATE) reserved for v1.3

### Architecture
- **Deterministic generation**: `generate-vectors.cjs` produces byte-identical output every run (SHA-256: `700a683d...`)
- **RFC 9562 UUIDv7**: All `decision_id`/`execution_trace_id` fully compliant (frozen timestamp `2026-07-28T00:00:00.000Z`)
- **Seven-step hierarchical hashing**: JCS (RFC 8785) → SHA-256 → audit.hash, with extensions_hash as first step
- **Canonical hex format**: `canonical_hex` field stores hex encoding of UTF-8 JCS bytes for cross-implementation comparison

### Verification
- **Zero-dependency verifier**: `verify.js` uses self-built JCS (no npm deps) → truly cross-implementation verifiable
- **Stale regression canary**: AV-008 intentionally mismatches — catches validators that skip seven-step verification
- **156 tests**: JCS RFC 8785 compliance, SHA-256 determinism, 7-step verification, tamper detection, full vector integrity

### Security
- **Independent security review** — 0 critical/high findings
- JCS type guards: BigInt, Symbol, Date, non-plain objects all rejected with clear errors
- Input validation: verify.js validates vector file structure before processing
- Dependency pinned: `json-canonicalize` locked to `2.0.0`

### Compliance
- `erdl-compliance-v1.2` profile embedded in all vectors
- 4 regulatory frameworks: EU AI Act 2024, GB/Z 185-2026, NIST AI RMF, COSO GenAI
- HIPAA reference in DO-016 updated to include HITECH Act (2009) and 21st Century Cures Act (2016)

### Documentation
- README.md: full project overview with deterministic guarantees
- DESIGN-generate-vectors-v1.2.md: generator architecture
- DESIGN-vector-inventory-v1.2.md: full vector inventory
- DESIGN-verify-js-v1.2.md: verifier architecture
- AUDIT-REPORT.md: independent security audit
- CONTRIBUTING.md: contributor guidelines

### Breaking Changes from v1.0/v1.1
- `expected_sha256` field removed entirely — verification is now via seven-step recomputation
- `canonical_bytes` renamed to `canonical_hex` for cross-implementation clarity
- `policies[].hash` is now JCS-based (previously unspecified)
- `rule_set_version.id` is JCS-based on full policy set content
- `compliance_profile` upgraded from `v1.0` → `v1.2` with 4 regulatory frameworks
- UUID format changed from v1.0/v1.1 mixed to RFC 9562 UUIDv7

### Migration from v1.1
- v1.1 vector IDs are not preserved; v1.2 is generated from scratch
- All v1.1 scenario categories are covered with improved test designs
- v1.1's technical pitfalls (T1-T10 from audit report) are all addressed in v1.2 design

---

## v1.1.0 (2026-07-10)

- 45 vectors (37 DO + 8 AV)
- Generated via `generate-v1.1-vectors.cjs`
- `json-canonicalize` as JCS dependency
- `expected_sha256` answer key (removed in v1.2)

## v1.0.0 (2026-06-14)

- 22 vectors (Decision Object v1.0 draft)
- Manual construction
- Cross-implementation verified by Erik Newton (Concordia): AV-001~AV-005 byte-matched
