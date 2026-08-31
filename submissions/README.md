# Third-Party Runner Submission Guide (v1.5)

> Cross-implementation verification for ERDL Decision Object v1.5 (RFC-002).

## What This Is

This directory is the public verification pipeline for ERDL Decision Object v1.5. Any developer implementing an ERDL-compatible decision engine — in any language — can submit their output here to prove cross-implementation consistency.

**It does not matter what language, framework, or rule format you use.** If your engine produces Decision Objects that pass v1.5 vector verification, it is ERDL-compatible.

## Prerequisites

Before submitting, ensure:

1. Your JCS (RFC 8785) implementation is **self-built** — do not rely on `json-canonicalize` or any third-party canonicalizer (R6: a conforming runner MUST implement JCS itself).
2. Your SHA-256 matches FIPS 180-4.
3. You have run against all **78 vectors** in `decision-object-vectors-v1.5.json` (V-DO-v15 hash layer: D13 + C8 + A10 + K1 + G14 + V-COMP32).
4. You have read the authoritative spec: `docs/OPENOBA-DOBJ-RFC-002-CN.md` (EN: `-EN.md`) and the runner contract `RUNNER_CONTRACT.md` (R1–R6).

## Submission Format

Place a single JSON file in this directory:

```
submissions/<your-runner-name>-output.json
```

Each entry records a verification result:

```json
[
  {
    "runner": "concordia-python",
    "method": "Python, spec-only, self-built JCS (RFC 8785)",
    "date": "2026-08-31",
    "check1_total": "78/78",
    "check2_total": "107/107",
    "canary_k01": "MISMATCH (Check 1) + MATCH (Check 2)",
    "breach_codes": "all R3 breach codes surfaced",
    "artifact": "https://github.com/<you>/<runner-repo>"
  }
]
```

## What Gets Verified

A conforming runner (RUNNER_CONTRACT.md R1–R6) MUST:

| Check | Pass criteria |
|-------|--------------|
| **Check 1** | recomputed JCS+SHA-256 hash matches each artifact's own `audit.hash` (78/78) |
| **Check 2** | recomputed canonical bytes match the answer oracle (107/107, byte-level) |
| **K01 canary** | Check 1 MISMATCH + Check 2 MATCH (discrimination confirmed) |
| **R3 breach codes** | single-DO P1→P6 + chain breach codes correctly surfaced |

## How to Submit

1. **Fork** `https://github.com/OpenOBA/erdl-vectors`.
2. **Implement** JCS (RFC 8785) + SHA-256 from the spec + contract (no SDK).
3. **Run** your engine against all 78 vectors.
4. **Record** the result as `submissions/<your-runner-name>-output.json`.
5. **Update** `IMPLEMENTATIONS.md` — add a row to the registry.
6. **Open a Pull Request**.

CI runs `scripts/verify-v1.5.js` (dual check) and `scripts/generate-conformance.cjs`; results are posted as a PR comment.

## Principles

- **Measurements, not endorsements**: the registry records "who passed how many on what date" — facts, not endorsement.
- **No answers file**: the answer oracle (`decision-object-answers-v1.5.json`) is `.gitignore`d and never exposed to runners. Conformance is defined by the contract, not by matching the oracle.
- **Canary is the honesty sentinel**: K01 catches a runner that skips independent recomputation (deletes the whole `audit` instead of only `audit.hash`).

> *"Neutrality is not declared — it is measured."* — Erik Newton, Concordia
