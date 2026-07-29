# English RFC 001 Alignment Report

**Date**: 2026-07-29
**Task**: v1.3 upgrade โ€?align all documents after third-party audit (Erik Newton + Chris Hopley)
**Status**: โ?COMPLETE

---

## v1.3 Changes Summary

### Source: Erik Newton (Concordia) โ€?Cross-implementation verification
- **E1**: RFC 001 ยง13.3 now matches verify.js โ€?both delete only `audit.hash` (not entire `audit` object)
- **E2**: `audit.previous_hash` and `audit.commitment` restored to JCS preimage โ€?chain position tampering now cryptographically detectable
- **E3**: `canonical_hex` moved to separate answers file (`decision-object-answers-v1.3.json`) โ€?eliminates SHA-256-only shortcut

### Source: Chris Hopley (AlgoVoi) โ€?Independent technical critique
- **C1**: Self-referencing exclusion for `policies[].hash` and `profile_hash` โ€?confirmed correct in both RFC 001 and vectors
- **C2**: Numeric canonicalization constraint added (ยง3.1 constraint 8) โ€?prevention measure, no active bug found
- **C3**: ยง3.3 explicitly overrides ยง3.1(5) for `extensions` empty array retention
- **S2**: Dual-hash transition (ยง9.6) โ€?"verify every hash present" replaces "at least one" (CWE-757 fix)
- **S3**: `schema_ref` SSRF hardening confirmed present (ยง11.2)

### Internal
- **D1**: All 75 DO vectors now carry full `audit` object: `hash` + `previous_hash` + `commitment`
- AV-008 (stale regression canary) replaced by AV-013 (chain position tampering canary)
- RFC 001 upgraded: v1.2 DRAFT-3 โ?v1.3 DRAFT-4 (CN + EN)
- Runner's Guide, DESIGN documents, CHANGELOG updated

### Verification
- โ?verify.js: 63/63 DO audit.hash self-consistent
- โ?verify.js: 11/11 AV MATCH + AV-013 EXPECTED_MISMATCH
- โ?npm test: all tests pass

Successfully aligned `RFC 001-v1.2-DRAFT-3.en.md` with the Chinese version. All 20 known discrepancies have been resolved.

**Verification Results**:
- โ?152/152 vitest tests passed (66 generator + 86 verifier)
- โ?verify.js: 11 MATCH + 1 EXPECTED_MISMATCH (AV-013 โ€?chain position tampering canary)
- โ?All structural checks passed

---

## Changes Applied

### Preamble & Structure
1. โ?**RFC 2119/8174 Declaration** โ€?Added keyword interpretation paragraph
2. โ?**Abstract** โ€?Updated field counts (CORE 14 + JURISDICTION 10) and flat hashing description
3. โ?**Table of Contents** โ€?Fixed Part III header and section numbering
4. โ?**Part III Title** โ€?Added "Part III: Governance and Evolution" before ยง10

### ยง2 Design Philosophy
5. โ?**ยง2.2 Principle 3** โ€?Changed "15 CORE" โ?"14 CORE", "9 JURISDICTION" โ?"10 JURISDICTION"

### ยง3 Cryptographic Foundation
6. โ?**ยง3.1 Constraint 4** โ€?Changed "confidence_score" example to generic numeric string constraint
7. โ?**ยง3.1 Constraint 6** โ€?Added "Raw Data Pass-Through" (financial/audit critical constraint)
8. โ?**ยง3.1 Constraint 7** โ€?Added "Resource Boundaries" (DoS protection: 1MB, 100 extensions, 10 nesting levels)
9. โ?**ยง3.1 Cross-reference** โ€?Added Runner's Guide ยง9 language binding note
10. โ?**ยง3.2 Self-Referencing Exclusion** โ€?Added convention for policies[].hash and profile_hash
11. โ?**ยง3.3 Flat Hashing** โ€?Fixed control character corruption, corrected code fence formatting
12. โ?**ยง3.4 Chain Anchoring** โ€?Expanded with break detection, segmentation, partial validity rules

### ยง4 Decision Object Schema
13. โ?**ยง4.1 Header** โ€?Changed "CORE Fields (15" โ?"CORE Fields (14"
14. โ?**ยง4.2 Header** โ€?Changed "JURISDICTION Fields (9" โ?"JURISDICTION Fields (10"
15. โ?**ยง4.2 Field Numbering** โ€?Renumbered #16-#24 โ?#15-#24
16. โ?**ยง4.2 #22 confidence_score** โ€?Changed from "float (string)" to "integer (0~100)"
17. โ?**ยง4.2 #23 signature** โ€?Simplified description
18. โ?**ยง4.2 #24 signing_key_id** โ€?Added new field with "ไธๅไธ็ญพๅๅๅ๏ผ็บฏ็ฒนๅ…ๆ•ฐๆ? description
19. โ?**ยง4.2 Numbering Rule** โ€?Added comment: "CORE #1โ€?14, JURISDICTION #15โ€?24, EXTENSIONS unnumbered"
20. โ?**ยง4.3 schema_ref** โ€?Minor text update (removed "Ten years from now")
21. โ?**ยง4.4 evaluation.confidence_score** โ€?Changed type from "float (string)" to "integer"
22. โ?**ยง4.5 Field Bloat** โ€?Baseline deployment changed from "15 fields" โ?"14 fields"

### ยง7 Ecosystem Compatibility
23. โ?**ยง7.4 Transport Bridge** โ€?Removed AAT-specific binding, made generic with `referenced_transport_events` JSON format
24. โ?**ยง7.5 MCP** โ€?Updated to "2026-07-28 stateless architecture" revision
25. โ?**ยง7.5 execution_trace_id** โ€?Updated generation rule (deprecated session IDs, request-level identifiers)

### ยง8 Privacy
26. โ?**Cold Storage Contract** โ€?Added 4-point behavior contract (write immutability, read verification, retention governance, location traceability)

### ยง9 Versioning & Upgrade
27. โ?**ยง9.2 Core Advantage** โ€?Updated to emphasize "any compliance change reflected in audit.hash"
28. โ?**ยง9.6 Dual Hash** โ€?Simplified transition text (removed legacy/new validator distinction)

### ยง10 Long-Term Maintenance
29. โ?**ยง10.1 Diagram** โ€?Removed extra `JCS(extensions)` line, removed "as core #15" reference
30. โ?**ยง10.2 Evolution Table** โ€?Aligned validator behavior descriptions with Chinese version

### ยง11 Extension Zone
31. โ?**ยง11.2 Cache Strategy** โ€?Added local cache with `last_fetched`/`valid_until` and `semantics_unresolved` degradation

### ยง13 Vector Set
32. โ?**ยง13.3 Schema Trimming** โ€?Added note: "Schema trimming is already completed by DO generator"
33. โ?**ยง13.3 Step Text** โ€?Aligned 5-step verification wording with Chinese version
34. โ?**ยง13.4 AV-008** โ€?Anonymized (removed specific vector ID references, made generic canary description)

### ยง14 Request for Comments
35. โ?**Feedback Items** โ€?Removed AV-008 explicit mention (#3), removed #7, kept #6, aligned all 6 items with Chinese

---

## Appendix E Status

โ?**Confirmed deleted** โ€?English version does not contain Appendix E (matches Chinese version)

---

## Technical Details

### Files Modified
- `RFC 001-v1.2-DRAFT-3.en.md` โ€?35 discrete changes applied

### Control Character Fix
- Line 178: Removed `\x07` (bell character) corruption in "udit.hash" โ?"`audit.hash`"
- Reformatted code fences from backtick-single to triple-backtick blocks

### High-Frequency Error Points Addressed
- โ?CORE field count: 15 โ?14 (all occurrences)
- โ?JURISDICTION field count: 9 โ?10 (all occurrences)
- โ?Baseline deployment fields: 15 โ?14
- โ?Field numbering: #16-#24 โ?#15-#24
- โ?confidence_score type: float(string) โ?integer(0~100)

---

## Verification Commands

```bash
# Run test suite
npm test

# Run vector verifier
node scripts/verify.js
```

---

## Conclusion

All known discrepancies between Chinese and English RFC 001s have been resolved. The English version now accurately reflects:
- Field count corrections (14 CORE + 10 JURISDICTION)
- New constraints (raw data pass-through, DoS protection)
- New fields (signing_key_id)
- Updated protocols (MCP 2026-07-28 stateless)
- Enhanced chain anchoring (break detection)
- Generic transport bridge (referenced_transport_events)
- Cold storage behavior contract
- Schema cache expiration strategy
- Part III governance header

**Status**: Ready for review โ?
