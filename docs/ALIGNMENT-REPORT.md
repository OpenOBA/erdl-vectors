# RFC 001 Cross-Document Alignment Report

**Date**: 2026-07-29
**Task**: v1.3 upgrade — align all documents after third-party audit (Erik Newton + Chris Hopley)
**Status**: COMPLETE

---

## v1.3 Changes Summary

### Source: Erik Newton (Concordia) — Cross-implementation verification
- **E1**: RFC 001 §13.3 now matches verify.js — both delete only `audit.hash` (not entire `audit` object)
- **E2**: `audit.previous_hash` and `audit.commitment` restored to JCS preimage — chain position tampering now cryptographically detectable
- **E3**: `canonical_hex` moved to separate answers file (`decision-object-answers-v1.3.json`) — eliminates SHA-256-only shortcut

### Source: Chris Hopley (AlgoVoi) — Independent technical critique
- **C1**: Self-referencing exclusion for `policies[].hash` and `profile_hash` — confirmed correct
- **C2**: Numeric canonicalization constraint added (§3.1 constraint 8) — prevention measure
- **C3**: §3.3 explicitly overrides §3.1(5) for `extensions` empty array retention
- **S2**: Dual-hash transition (§9.6) — "verify every hash present" replaces "at least one" (CWE-757)
- **S3**: `schema_ref` SSRF hardening confirmed present (§11.2)

### Full-Project Audit (2026-07-29)
- Test count corrected: 153→152 across README + CHANGELOG
- v1.2→v1.3 version residuals in README fixed
- LICENSE file added (MIT)
- §3.1(8) `priority`→`policies[].version`
- §4.2 #24: signature preimage = JCS preimage clarified
- Regulatory coverage 12→14 (LGPD + DPDP)
- Queue reliability constraints (§9.4)
- SMB minimal deployment mode (§9.5)
- Performance benchmarks (Node.js v24: ~110 µs/DO)
- Appendix C: Threat Model (STRIDE)
- §14 RFC items expanded 8→10
- DEFER decision type added to erdl-landing SPEC v1.1 (separate repo)
- Extensions_hash residual removed
- ReDoS moved from threat-mitigated to risk-accepted
- Five-step JCS formula unified across all 8 locations
- Code fence orphan fixed (RFC 001 CN line 208)

### Design Changes
- All 75 DO vectors carry full `audit` object: `hash` + `previous_hash` + `commitment`
- AV-008 (stale regression canary) replaced by AV-013 (chain position tampering canary)
- RFC 001: DRAFT-4 (CN + EN, OPENOBA-DOBJ-RFC-001)

### Verification
- verify.js: 63/63 DO audit.hash self-consistent
- verify.js: 11/11 AV MATCH + AV-013 EXPECTED_MISMATCH
- vitest: 152/152 passed (66 generator + 86 verifier)
- CN-EN RFC 001: all cross-references aligned

---

## Changes Applied (Preamble & Structure)

1. RFC 2119/8174 Declaration — Added keyword interpretation paragraph
2. Abstract — Updated field counts (CORE 14 + JURISDICTION 10) and flat hashing description
3. Table of Contents — Fixed Part III header and section numbering
4. Part III Title — Added "Part III: Governance and Evolution" before §10

### §2 Design Philosophy
5. §2.2 Principle 3 — Changed "15 CORE" → "14 CORE", "9 JURISDICTION" → "10 JURISDICTION"

### §3 Cryptographic Foundation
6. §3.1 Constraint 4 — Changed "confidence_score" example to generic numeric string constraint
7. §3.1 Constraint 6 — Added "Raw Data Pass-Through" (financial/audit critical constraint)
8. §3.1 Constraint 7 — Added "Resource Boundaries" (DoS protection: 1MB, 100 extensions, 10 nesting levels)
9. §3.1 Cross-reference — Added Runner's Guide §9 language binding note
10. §3.2 Self-Referencing Exclusion — Added convention for policies[].hash and profile_hash
11. §3.3 Flat Hashing — Fixed control character corruption, corrected code fence formatting
12. §3.4 Chain Anchoring — Expanded with break detection, segmentation, partial validity rules

### §4 Decision Object Schema
13. §4.1 Header — Changed "CORE Fields (15" → "CORE Fields (14"
14. §4.2 Header — Changed "JURISDICTION Fields (9" → "JURISDICTION Fields (10"
15. §4.2 Field Numbering — Renumbered #16-#24 → #15-#24
16. §4.2 #22 confidence_score — Changed from "float (string)" to "integer (0~100)"
17. §4.2 #23 signature — Simplified description
18. §4.2 #24 signing_key_id — Added new field with signature preimage exclusion clarification
19. §4.2 Numbering Rule — Added comment: "CORE #1-#14, JURISDICTION #15-#24, EXTENSIONS unnumbered"
20. §4.3 schema_ref — Minor text update
21. §4.4 evaluation.confidence_score — Changed type from "float (string)" to "integer"
22. §4.5 Field Bloat — Baseline deployment changed from "15 fields" → "14 fields"

### §7 Ecosystem Compatibility
23. §7.4 Transport Bridge — Removed AAT-specific binding, made generic with `referenced_transport_events` JSON format
24. §7.5 MCP — Updated to "2026-07-28 stateless architecture" revision
25. §7.5 execution_trace_id — Updated generation rule (deprecated session IDs, request-level identifiers)

### §8 Privacy
26. Cold Storage Contract — Added 4-point behavior contract (write immutability, read verification, retention governance, location traceability)

### §9 Versioning & Upgrade
27. §9.2 Core Advantage — Updated to emphasize "any compliance change reflected in audit.hash"
28. §9.6 Dual Hash — Simplified transition text (removed legacy/new validator distinction)

### §10 Long-Term Maintenance
29. §10.1 Diagram — Updated JCS formula to include previous_hash + commitment
30. §10.2 Evolution Table — Aligned validator behavior descriptions

### §11 Extension Zone
31. §11.2 Cache Strategy — Added local cache with `last_fetched`/`valid_until` and `semantics_unresolved` degradation

### §13 Vector Set
32. §13.3 Schema Trimming — Added note: "Schema trimming is already completed by DO generator"
33. §13.3 Step Text — Aligned 5-step verification wording; JCS formula unified
34. §13.4 AV-008 — Anonymized (removed specific vector ID references)

### §14 Request for Comments
35. Feedback Items — Expanded 8→10 items. Removed AV-008 explicit mention

---

## Appendix E Status

Confirmed deleted — English RFC 001 does not contain Appendix E (matches Chinese version)

---

## High-Frequency Error Points Addressed

- CORE field count: 15→14 (all occurrences)
- JURISDICTION field count: 9→10 (all occurrences)
- Baseline deployment fields: 15→14
- Field numbering: #16-#24→#15-#24
- confidence_score type: float(string)→integer(0~100)
- JCS formula: 4 locations unified to include previous_hash + commitment
- Regulatory framework count: 12→14 (all references)

## Conclusion

All known discrepancies between Chinese and English RFC 001 have been resolved. Both versions now accurately reflect:
- Field count corrections (14 CORE + 10 JURISDICTION)
- New constraints (raw data pass-through, DoS protection)
- New fields (signing_key_id)
- Updated protocols (MCP 2026-07-28 stateless)
- Enhanced chain anchoring (break detection)
- Generic transport bridge (referenced_transport_events)
- Cold storage behavior contract
- Schema cache expiration strategy
- 14 regulatory frameworks including LGPD and DPDP
- Threat model (Appendix C) and performance benchmarks

**Status**: Ready for review. All 152 tests pass, verify.js ALL PASS.
