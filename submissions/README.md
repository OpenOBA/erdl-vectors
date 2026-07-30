# Third-Party Runner Submission Guide

> Cross-implementation verification for ERDL Decision Object v1.3

## What This Is

This directory is the public verification pipeline for ERDL Decision Object. Any developer implementing an ERDL-compatible decision engine—in any language—can submit their output here to prove cross-implementation consistency.

**It does not matter what language you use, what framework, or what rule format.**
If your engine produces a Decision Object that passes v1.3 vector verification, it is ERDL-compatible.

## Prerequisites

Before submitting, ensure:

1. Your engine has processed **all 63 static decision vectors** from `decision-object-vectors-v1.3.json`
2. Your engine has processed **all 12 audit hash vectors** (AV-001 through AV-013)
3. Your engine handles the **26 dynamic vectors** (temporal / seeded / stateful)
4. Your JCS (RFC 8785) implementation is **self-built**—do not rely on third-party canonicalize libraries unless you have verified their output against our reference implementation byte-for-byte
5. Your SHA-256 implementation matches FIPS 180-4

## Submission Format

Place a single JSON file in this directory:

```
submissions/<your-runner-name>-output.json
```

The file must be an array of verification results, one entry per vector:

```json
[
  {
    "vector_id": "DO-001",
    "decision": "DENY",
    "matched_rules": 1,
    "total_evaluated": 1,
    "decision_object": {
      "spec": "decision-object-v1.0",
      "decision_id": "...",
      "timestamp": "2026-07-30T00:00:00.000Z",
      "agent": { "id": "...", "role": "guardian", "version": "1.0.0" },
      "context": { ... },
      "policies": [ ... ],
      "evaluation": { ... },
      "result": { "decision": "DENY", "severity": "high", ... },
      "audit": {
        "hash": "sha256:...",
        "previous_hash": null,
        "commitment": "..."
      }
    }
  }
]
```

### Critical Requirements

#### 1. audit.hash — You MUST implement this correctly

The audit hash is computed via **five-step verification**:

1. Deep-clone the decision object
2. **DELETE** `audit.hash` key (MUST use physical deletion, NOT set to `null` or `""`)
3. JCS (RFC 8785) canonicalize the remaining object
4. SHA-256 the canonical bytes
5. Prepend `sha256:` and compare against the stored hash

**⚠️ DELETE vs BLANK**: Under JCS, deleting a key and setting it to empty string produce different byte sequences:

```
DELETE key → {"audit":{"previous_hash":null}} → sha256:023c4b...
BLANK  key → {"audit":{"hash":"","previous_hash":null}} → sha256:bd0925...
```

If you blank instead of delete, ALL your audit hash verifications will fail. This was confirmed by Christopher Hopley's independent audit (2026-07-24).

#### 2. JCS (RFC 8785) — Implement from scratch

Your JCS implementation must handle:

- Object keys sorted by UTF-16 code unit order
- No whitespace between tokens
- Numbers serialized per ES6 `Number.prototype.toString()` (no trailing zeros, scientific notation standard)
- Strings escaped per RFC 8259 §7 (`JSON.stringify` equivalent)
- Arrays as `[elem1,elem2,...]`
- Omit over Null: fields with `undefined` values are physically removed

**Do NOT use `JSON.stringify` as a JCS replacement.** It does NOT sort keys deterministically across languages.

Reference implementation: `scripts/verify.js` — the `jcsCanonicalize()` function (~60 lines, zero dependencies).

#### 3. AV-013 — Expected Mismatch (Canary)

AV-013 is a **chain-position tampering canary**. Its `audit.hash` was computed by a deliberately regressed runner that deleted the entire `audit` object (excluding `previous_hash` from JCS). A correct runner that includes `previous_hash` in JCS will produce a DIFFERENT hash.

**Expected behavior**: Your verification MUST detect a mismatch for AV-013. This is CORRECT behavior. A runner that passes AV-013 is regressed (it excludes `previous_hash` from JCS).

#### 4. PASS ↔ ALLOW Tolerance

Engine default fallback in v1.3 is `ALLOW` (no matching rules). Some vectors specify expected `PASS`. These are functionally equivalent at the engine level. If your engine returns `ALLOW` where the vector expects `PASS`, this is acceptable. If your engine returns `PASS` where the vector expects `ALLOW`, this is also acceptable.

## How to Submit

1. **Fork** this repository: `https://github.com/OpenOBA/erdl-vectors`
2. **Run your engine** on all vectors from `decision-object-vectors-v1.3.json`
3. **Collect output** into the format shown above
4. **Place file** in `submissions/<your-runner-name>-output.json`
5. **Update** `verified-runners.json` — add your runner to the array
6. **Open a Pull Request**

GitHub Actions will automatically run `scripts/verify.js` against your submission. Results will be posted as a PR comment.

## What Gets Verified

| Check | Pass Criteria |
|-------|--------------|
| 63 static DO | `result.decision` matches expected |
| 26 dynamic DO | temporal/seeded/stateful all pass |
| 12 AV hash | 11 MATCH + AV-013 EXPECTED_MISMATCH |
| JCS self-consistency | Built-in check against known JCS ground truth |

## After Verification

If all checks pass, your PR will be merged and your runner will be recorded in `verified-runners.json`. Your name, language, and verification date become part of the public ERDL cross-implementation record.

**Only two runners are required for L2 Verified Compatible status.** If yours is the second (or third) independent runner to pass all vectors, ERDL gains a stronger claim to being a truly open, cross-implementation standard.

## Need Help?

- JCS reference: `scripts/verify.js` → `jcsCanonicalize()` function
- Decision Object RFC: `docs/OPENOBA-DOBJ-RFC-001-EN.md`
- Implementer's Guide: `docs/RUNNERS-GUIDE.md`
- Issues: `https://github.com/OpenOBA/erdl-vectors/issues`

---

> *"Neutrality is not declared — it is measured."* — Erik Newton, Concordia
