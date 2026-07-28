# Runner's Guide — Implementing an ERDL Decision Object Verifier

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **目标读者**: 想在自己的 ERDL 规则引擎中实现 Decision Object v1.2 支持的开发者  
> **前提**: 理解 JSON、SHA-256、RFC 8785 (JCS)  
> **时间**: 读完本文约 15 分钟，实现基础 Runner 约 2-4 小时  

---

## 目录

1. [What Is a Runner?](#1-what-is-a-runner)
2. [Minimal Runner in 50 Lines](#2-minimal-runner-in-50-lines-pseudocode)
3. [The Five-Step Verification Algorithm](#3-the-five-step-verification-algorithm)
4. [JCS: The Hardest 50 Lines You'll Write](#4-jcs-the-hardest-50-lines-youll-write)
5. [Your Engine's Role: Populating Decision Objects](#5-your-engines-role-populating-decision-objects)
6. [Testing Against the Vector Set](#6-testing-against-the-vector-set)
7. [Common Pitfalls](#7-common-pitfalls)
8. [Compatibility Levels](#8-compatibility-levels)
9. [Reference Implementations](#9-reference-implementations)

---

## 1. What Is a Runner?

A **Runner** is any piece of code that can take an ERDL Decision Object and validate its `audit.hash`. The canonical Runner is `scripts/verify.js` in this repository — a zero-dependency Node.js script that you can study, copy, or translate to your language of choice.

You don't need to implement the **Generator**. The Generator produces the static test vectors (`decision-object-vectors-v1.2.json`). You only need to implement verification — taking a Decision Object and checking that its `audit.hash` is correct.

## 2. Minimal Runner in 40 Lines (Pseudocode)

```python
import json
import hashlib

def sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def jcs(value) -> str:
    """RFC 8785 JSON Canonicalization Scheme"""
    if value is None:     return 'null'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        assert value == value and value != float('inf') and value != float('-inf'), \
            'JCS: NaN/Infinity not allowed'
        return str(value)   # ECMAScript Number.toString()
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, list):
        return '[' + ','.join(jcs(v) for v in value) + ']'
    if isinstance(value, dict):
        keys = sorted(value.keys())
        return '{' + ','.join(
            json.dumps(k, ensure_ascii=True) + ':' + jcs(value[k])
            for k in keys if value[k] is not None   # omit undefined/null
        ) + '}'
    raise TypeError(f'{type(value)} not serializable')

def verify_do(decision_object: dict) -> tuple[bool, str, str]:
    """Five-step audit hash verification. Returns (passed, computed_hash, stored_hash)."""
    # Step 1: Deep clone
    clone = json.loads(json.dumps(decision_object))

    # Step 2: Delete self-referencing fields
    # (extensions stays — participates directly in main JCS)
    del clone['audit']
    del clone['signature']
    del clone['signing_key_id']

    # Step 3-4: JCS → SHA-256
    canonical = jcs(clone)
    computed_hash = 'sha256:' + sha256(canonical)
    stored_hash = decision_object['audit']['hash']

    # Step 5: Compare
    return computed_hash == stored_hash, computed_hash, stored_hash
```

That's it. 50 lines. If your language's `json.dumps()` doesn't produce RFC 8785-compliant output (most don't), you need a proper JCS implementation. See Section 4.

## 3. The Five-Step Verification Algorithm

The algorithm (Whitepaper §13.3) is designed to be implementable in any language with only two primitives: JCS serialization and SHA-256.

```
Input:  decision_object (JSON-parsed object)
Output: (passed: bool, computed_hash: str, stored_hash: str)

Step 1: Deep-clone the decision_object
        → clone = JSON.parse(JSON.stringify(decision_object))

Step 2: Delete self-referencing / external fields
        → delete clone.audit
        → delete clone.signature
        → delete clone.signing_key_id
        (extensions stays in the tree — participates directly in main JCS)
        → (defensive) delete any __-prefixed internal fields

Step 3: JCS canonicalize the entire object
        → canonical = jcs(clone)
        (all fields including extensions are included)

Step 4: SHA-256 hash
        → hash_bytes = sha256(canonical)

Step 5: Compare
        → passed = 'sha256:' + hash_bytes == decision_object.audit.hash
```

**Key insight**: Steps 1-3 are identical in every language. The only language-specific parts are SHA-256 (trivial, every stdlib has it) and JCS (requires a careful implementation — see next section).

## 4. JCS: The Hardest 50 Lines You'll Write

RFC 8785 specifies exactly how JSON values must be serialized. Most JSON libraries get it *almost* right but fail on one of these:

### 4.1 Object Key Ordering

Keys MUST be sorted by **UTF-16 code unit order**. This is NOT alphabetical (Unicode) order.

```
Correct (UTF-16):  {"A":1,"a":2}     // 'A' (65) < 'a' (97)
Wrong (alphabetical): {"a":2,"A":1}   // locale-aware sort is wrong
```

In most languages, sorting by byte value or using a simple string sort works. Avoid locale-aware collation.

### 4.2 Number Serialization

RFC 8785 §3.2.2.3: "Numbers MUST be serialized as if by applying the ECMAScript `Number.prototype.toString` method."

| Value | Correct JCS | Wrong |
|-------|-------------|-------|
| `1` | `1` | `1.0` |
| `1.5` | `1.5` | `1.50` |
| `0` | `0` | `0.0` |
| `-0` | `0` | `-0` |
| `1e20` | `100000000000000000000` | `1e+20` |
| `0.0000001` | `1e-7` | `0.0000001` |
| `NaN` | **REJECT** | — |
| `Infinity` | **REJECT** | — |

This is the most common source of cross-implementation bugs. **Test against the vector set early.**

**Python tip**: Python's `str(float)` is NOT ECMAScript-compliant for large numbers. Use `repr()` and convert:

```python
def jcs_number(n: float) -> str:
    if n != n or n == float('inf') or n == float('-inf'):
        raise ValueError('JCS: NaN/Infinity not allowed')
    # Python float repr is close to ES6 but not identical for edge cases
    # The safest approach: if your engine produces DOs, use integer arithmetic where possible
    # For verification, the pre-computed canonical_hex fields bypass this entirely
    return str(n)  # good enough for the integer-heavy DO vector set
```

**Go tip**: `fmt.Sprintf("%v", n)` is NOT guaranteed to match ES6. Use `strconv.FormatFloat(n, 'G', -1, 64)` and strip trailing `.0`.

### 4.3 Omit over Null

Fields whose values are `undefined` or `None`/`null` MUST be **physically absent** from the JSON object before serialization. A field with value `null` is NOT the same as a missing field in JCS — if the spec says "omit over null", you must delete the key.

```python
# WRONG — null values will appear in JCS output
obj = {'a': 1, 'extensions': None}
jcs(obj)  # → '{"a":1,"extensions":null}' <— different hash!

# RIGHT — delete before JCS
obj = {'a': 1}
# (extensions was never added, or was deleted with `del obj['extensions']`)
jcs(obj)  # → '{"a":1}' <— correct
```

### 4.4 String Escaping

Use JSON-standard string escaping (RFC 8259 §7). `\n`, `\t`, `\\`, `\"`, and Unicode escapes where needed. Most language JSON libraries handle this correctly.

### 4.5 Negative Zero

`-0` MUST serialize as `0`. In JavaScript: `String(-0) === '0'`. In Python: `str(-0.0) === '-0.0'` → **wrong**. You must special-case this.

```python
def jcs_number(n: float) -> str:
    if n == 0.0:           # catches both 0.0 and -0.0
        return '0'
    return str(n)
```

### 4.6 Quick Self-Test

Your JCS implementation must produce these exact outputs:

```python
assert jcs(None) == 'null'
assert jcs(True) == 'true'
assert jcs(42) == '42'
assert jcs(0) == '0'
assert jcs(-0.0) == '0'
assert jcs('hello') == '"hello"'
assert jcs([]) == '[]'
assert jcs({}) == '{}'
assert jcs({'b': 2, 'a': 1}) == '{"a":1,"b":2}'
assert jcs([1, 'two', None]) == '[1,"two",null]'
assert jcs({'z': {'y': 1}, 'a': 2}) == '{"a":2,"z":{"y":1}}'
```

All passing? Good. Now verify against the real vector set (Section 6).

## 5. Your Engine's Role: Populating Decision Objects

If you're building an ERDL rule engine (not just verifying), your engine produces Decision Objects. The seven fields that affect the audit hash are:

| Field | Your engine's responsibility |
|-------|-----------------------------|
| `decision_id` | Generate a unique identifier |
| `timestamp` | ISO 8601 timestamp of evaluation |
| `agent` | Your agent's identity and capabilities |
| `context` | The evaluation context (tool call params, etc.) |
| `policies` | The rule set evaluated, each with JCS-based hash |
| `evaluation` | Which rules matched, which triggered, why |
| `result` | The final decision and applied rule |

Everything else (`compliance_profile`, `impact_assessment_id`, `extensions`, etc.) is either fixed or optional.

**The hash formula** (what your engine computes before signing):

```
audit.hash = SHA-256(
  JCS({
    spec,
    decision_id,
    compliance_profile,
    execution_trace_id,
    timestamp,
    evaluation_duration_ms,
    agent,
    model_id,
    context,
    context_snapshot_hash,
    sanitized_context,
    rule_set_version,
    policies,
    fairness_assessment,
    impact_assessment_id,
    autonomy_level,
    confidence_score,
    evaluation,
    data_modification_expected,
    result,
    human_oversight,
  })
)
```

Note: `audit`, `signature`, and `signing_key_id` are NOT included in the hash. `extensions` IS included — it participates directly in the main JCS.

## 6. Testing Against the Vector Set

### Step 1: Verify canonical_hex (JCS is correct)

```bash
node scripts/verify.js --vectors=decision-object-vectors-v1.2.json
```

Expected output: `ALL VERIFICATIONS PASSED · 11/11 MATCH + AV-008 STALE DETECTED`

With your runner, do the same: for each of the 12 audit hash vectors, run the five-step verification. You should get 11 MATCH + 1 MISMATCH (AV-008, the intentional stale regression).

### Step 2: Verify your engine's DO output

Once your JCS is verified correct, test your engine:

1. Take DO-001 from the vector set as input context
2. Run your engine's rule evaluator against it
3. Your engine must produce a Decision Object
4. Run five-step verification on your engine's output
5. If the hash matches, your DO format is compatible

### Step 3: Full L3 compatibility

Run all 63 static DO vectors through your engine's evaluate → produce DO → verify cycle. All 63 must pass.

## 7. Common Pitfalls

### P0: Using the wrong hash formula

The audit hash covers the **entire DO minus audit/signature/signing_key_id**. `extensions` participates directly in the main JCS. If you hash the entire DO including `audit` → circular dependency → always wrong.

### P0: Self-referential hash fields — forget to exclude the hash key

`policies[].hash` and `compliance_profile.profile_hash` are computed from the object they sit inside. When computing these hashes, you MUST **temporarily remove the hash key itself** before JCS. If you leave `hash` in the policy object while canonicalizing, your result will differ from the reference implementation.

```python
# WRONG — hash key participates in its own computation
policy = {'id': 'rule-001', 'hash': '', 'when': {...}}
policy['hash'] = sha256(jcs(policy))  # ← hash key is still in policy!

# RIGHT — exclude hash key first
policy = {'id': 'rule-001', 'when': {...}}  # no hash yet
h = sha256(jcs(policy))  # JCS without hash
policy['hash'] = h  # write back after
```

This is the exact same class of bug as c3f22df — accidental serialization form affecting the hash.

### P0: Including `null` fields in JCS

If your DO has `sanitized_context: null`, your JCS will include `"sanitized_context":null` → different hash from an implementation that omits it. The generator explicitly sets it to `null`; you must match. **Read the generator source to see exactly which fields have null values.**

### P1: Number formatting differences

`1.0` vs `1`. This is the #1 cross-language bug. Python's `str(1.0)` → `'1.0'`. JavaScript's `String(1.0)` → `'1'`. You must strip the trailing `.0` or better, avoid floats entirely in your DOs.

### P1: Object keys with special characters

Keys containing spaces, colons, or Unicode require proper JSON string escaping in both the key AND the JCS output. Most JSON libraries handle this, but hand-rolled implementations often miss it.

### P2: AV-008 passed when it should fail

If your runner reports AV-008 as a MATCH, your five-step verification is NOT computing from scratch — you're comparing pre-computed hashes. This is the exact shortcut that AV-008 exists to catch.

> ⚠️ **Important**: AV-008 is a self-consistency check, not a structural independence guarantee. A runner should NEVER special-case any vector by id. All 12 audit vectors go through the same five-step pipeline. AV-008 has `canonical_hex` identical to AV-003 but with a deliberately stale `audit.hash` — only a runner that independently recalculates the hash (not just reads stored values) will detect this MISMATCH.

### P2: Timestamp format

The vector set uses `'2026-07-28T00:00:00.000Z'`. Your engine should use ISO 8601 with milliseconds and `Z` suffix.

## 8. Compatibility Levels

| Level | Vectors | Requirement |
|:-----:|:-------:|-------------|
| **L1** | 28 | Basic: JCS + SHA-256 correct, DO structure valid |
| **L2** | 45 | Verified: all v1.1 vectors pass, dynamic vectors supported |
| **L3** | 101 | Full: all v1.2 vectors, including AV-008 stale regression detection |

Start with L1. Most runners pass L1 within a few hours. L2 and L3 add edge cases that flush out JCS number formatting and null-handling bugs.

## 9. Reference Implementations

| Language | File | Notes |
|----------|------|-------|
| **JavaScript (Node.js)** | `scripts/verify.js` | Zero-dependency, self-built JCS, 380 lines |
| **JavaScript (Node.js)** | `scripts/generate-vectors.cjs` | Generator with `json-canonicalize` JCS library |
| **TypeScript** | `test/verify-comprehensive.test.ts` | 88 tests covering JCS edge cases |

To add your language to this list, submit a PR with your Runner implementation and verification results.

---

> *"Neutrality is tested, not declared."*  
>  
> Pass the vectors. Then claim compatibility.
