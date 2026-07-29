# DESIGN: verify.js — Universal Zero-Dependency Verifier v1.3

> Copyright (c) 2026 Tang Qixin. All rights reserved.

> Version: 1.3 · 2026-07-29
> Status: Released
> Goal: Cross-language, cross-implementation, zero-dependency DO verifier supporting L1/L2/L3 compatibility

---

## 1. Design Goals

| Goal | Description |
|------|-------------|
| **Zero-dependency** | Uses only Node.js built-in modules (`crypto`, `fs`, `path`) |
| **Single file** | `scripts/verify.js` — copy to any Node.js environment and run |
| **Three-level compatibility** | L1 Basic (28) / L2 Verified (45) / L3 Full (101) |
| **Portable** | Pure algorithm implementation, translatable to Python/Go/Rust |
| **Self-documenting** | Code serves as living documentation of verification logic |

## 2. Core Algorithm: Five-Step Verification

### 2.1 Self-Built JCS (No External Libraries)

`verify.js` must implement its own JCS serializer because:

1. The verifier's authority rests on "trust no external library"
2. The verifier is the algorithm's "living document"
3. Self-built JCS counters the `json-canonicalize` npm library — if results differ, one has a bug

### 2.2 Number Canonicalization

JCS (RFC 8785) = ECMAScript number serialization. `String(n)` in JS is JCS-compliant.
Integers: no `.0` suffix. NaN/Infinity rejected.

### 2.3 Omit over Null

Optional fields with `null`, `undefined`, or `[]` must be physically deleted (`delete obj.field`).

## 3. CLI Interface

```
Usage: node scripts/verify.js [path/to/vectors.json]

The verifier accepts a single positional argument — the path to the vector set JSON.
Defaults to `./decision-object-vectors-v1.3.json`.

Examples:
  node verify.js
  node verify.js decision-object-vectors-v1.3.json
  node verify.js path/to/custom-vectors.json
```

## 4. Verification Logic

```javascript
function verifyAuditVector(av) {
  // 1. Deep clone
  const clone = JSON.parse(JSON.stringify(av.decision_object));

  // 2. Extract claimed hash
  const claimedHash = clone.audit.hash;

  // 3. Delete self-referencing/signature fields
  //    (only audit.hash — keep previous_hash and commitment)
  delete clone.audit.hash;
  delete clone.signature;
  delete clone.signing_key_id;

  // 4. JCS (CORE + JURISDICTION + EXTENSIONS + audit.previous_hash + audit.commitment)
  const canonicalStr = jcsCanonicalize(clone);
  const canonicalBytes = Buffer.from(canonicalStr, 'utf-8').toString('hex');

  // 5. SHA-256
  const recomputedHash = 'sha256:' + sha256(canonicalStr);

  // 6. Compare
  return {
    canonical_bytes_match: canonicalBytes === av.canonical_hex,
    audit_hash_match: recomputedHash === claimedHash,
    status: (canonicalBytes === av.canonical_hex && recomputedHash === claimedHash) ? 'PASS' : 'FAIL'
  };
}
```

### AV-013 Special Handling

AV-013 is the chain position tampering canary. Its `audit.previous_hash` in the DO body is tampered, but `audit.hash` was computed with the original `previous_hash`.

- **Correct implementation** (only delete audit.hash): detects MISMATCH ✓
- **Shortcut implementation** (compare pre-computed hashes): falsely reports MATCH ✗
- **Wrong implementation** (delete entire audit): falsely excludes previous_hash from JCS

Verifiers MUST NOT special-case AV-013 by hardcoded ID.

## 5. Portability Design

`verify.js` follows **Literal Translation** principles:

1. No ES6 features beyond arrow functions (translatable)
2. `jcsCanonicalize()` is a pure recursive function
3. `sha256()` maps to `crypto.createHash('sha256')` (Node) / `hashlib.sha256()` (Python)
4. No Node-specific API patterns (Stream/Buffer advanced features)

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| Vector file missing | Exit code 1: `ERROR: Vector file not found` |
| Invalid format (missing audit_vectors) | Exit code 2: `ERROR: Invalid vector format` |
| AV-013 expected MISMATCH | Status `EXPECTED_MISMATCH`, not counted as failure |
| Extensions verification | Participates directly in JCS, no separate verification |
| canonical_hex mismatch | Status `FAIL`, output diff |
| NaN/Infinity in JCS | Exit code 3: `INVALID: NaN/Infinity in JCS input` |

## 7. Exit Codes

| Code | Meaning |
|:---:|---------|
| 0 | All PASS (including AV-013 expected failure) |
| 1 | File I/O error |
| 2 | Invalid vector format |
| 3 | JCS input violation (NaN/Infinity) |
| 4 | Genuine FAIL (not expected failure) |

## 8. Test Strategy

```bash
# Smoke test
node scripts/verify.js --vectors=decision-object-vectors-v1.3.json
# Expected: ALL VERIFICATIONS PASSED · 11/11 MATCH + AV-013 CHAIN CANARY DETECTED

# Cross-implementation
node scripts/verify.js > node-result.txt
python3 scripts/verify.py > python-result.txt
diff node-result.txt python-result.txt  # should be empty
```

---

> "Neutrality is tested, not declared."

## Verification Results (2026-07-29)

```
verify.js:   63/63 DO audit.hash self-consistent
verify.js:   11/11 AV MATCH + AV-013 EXPECTED_MISMATCH
vitest:      152/152 passed (66 generator + 86 verifier)
```
