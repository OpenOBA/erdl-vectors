# ERDL Decision Object v1.3 — Conformance Report

> **Auto-generated** by CI clean-room verification pipeline
> **Runner**: OpenOBA clean-room (self-built JCS, SDK uninstalled)
> **Last run**: 2026-08-05

## Summary

| Metric | Value |
|--------|-------|
| Vectors total | 63 static DO + 12 audit hash = 75 |
| Passed | 75 |
| Failed | 0 |
| Method | Self-built JCS (RFC 8785) + SHA-256 (FIPS 180-4) |
| SDK dependency | Zero — verified absent at CI startup |

## Per-Vector Results

### Static Decision Object Vectors (63/63)

All 63 static DO vectors pass five-step JCS+SHA-256 audit hash verification. See `scripts/verify.js` for the full verification pipeline.

### Audit Hash Vectors (12/12)

| Vector | Ref | Result | Hash Match |
|--------|-----|:------:|:----------:|
| AV-001 | DO-001 | ✅ MATCH | byte-identical |
| AV-002 | DO-013 | ✅ MATCH | byte-identical |
| AV-003 | DO-011 | ✅ MATCH | byte-identical |
| AV-004 | DO-009 | ✅ MATCH | byte-identical |
| AV-005 | DO-017 | ✅ MATCH | byte-identical |
| AV-006 | DO-024 | ✅ MATCH | byte-identical |
| AV-007 | DO-027 | ✅ MATCH | byte-identical |
| AV-009 | DO-021 | ✅ MATCH | byte-identical |
| AV-010 | DO-031 | ✅ MATCH | byte-identical |
| AV-011 | DO-038 | ✅ MATCH | byte-identical |
| AV-012 | DO-051 | ✅ MATCH | byte-identical |
| AV-013 | DO-051 | ✅ EXPECTED_MISMATCH | chain position canary detected |

**11 MATCH + 1 EXPECTED_MISMATCH (AV-013 chain integrity canary)**.

## Verification Method

1. Hex-decode answer from `decision-object-answers-v1.3.json`
2. Parse as JSON → complete Decision Object (runner's re-computed output)
3. JCS (RFC 8785) canonicalize
4. SHA-256 hash
5. Compare with `decision_object.audit.hash` declared in vector file

## Clean-Room Guarantee

The CI pipeline (`erdl-vectors/.github/workflows/clean-room-verify.yml`) asserts at startup that `@openoba-ai/erdl-mcp` is **not** importable. Any SDK presence causes a hard CI failure. The verifier uses only Node.js built-in `crypto` module and self-built JCS — zero external dependencies beyond the standard library.

## Registry

See [IMPLEMENTATIONS.md](../IMPLEMENTATIONS.md) for the full cross-implementation registry.
