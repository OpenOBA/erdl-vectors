# EXPRESSION-RUNNER-CONTRACT.md — Expression-Layer Runner Conformance Contract

> This contract is the **authoritative definition** of "normative behavior" for an expression-layer runner. A conforming runner implements the ERDL expression kernel from first principles (spec + this contract) and recomputes the 227 `v-engine-vectors.json` vectors — independent of the reference implementation and of this repo's `scripts/verify-v-engine.mjs` (which is a second source of the reference implementation, not a third party).

> **Difference from the audit-layer contract**: the audit-layer contract ([`RUNNER_CONTRACT.md`](RUNNER_CONTRACT.md), R1–R6) verifies **JCS + SHA-256 hashes** (byte-level); this contract verifies **evaluation semantics** (the expression kernel), whose output is a semantic value (number / string / boolean), not a byte hash.

> **Contract, oracle, reference implementation — three-way separation**:
> - **This contract** = the rules (normative behavior spec);
> - **The vector `expected` field** = the semantic oracle (not the rules themselves);
> - **`scripts/verify-v-engine.mjs`** = a second source of the reference implementation (an instance of a conforming runner, not the norm).

---

## 1. Conformance requirements (MUST)

A conforming expression-layer runner MUST satisfy all of the following. Each is testable; failing any one means non-conforming.

### ER1 — Implement the expression layer from the spec

MUST implement the full ERDL expression layer: the **34-node kernel** (value 3 / logic 3 / comparison 6 / set 1 / string 4 / existence 3 / quantifier 3 / arithmetic 5 / time 5 / aggregate 1) **plus Simple compilation (30 operators), gloss (16), and projection facets (6)** — together the 227-vector surface. Semantics per [erdl-spec](https://github.com/OpenOBA/erdl-landing/blob/main/erdl-spec.md) §5 / §7 as the **sole normative source**. Node semantics are not restated here — this contract specifies *what* to implement and *how* to accept, not the node details (see the spec).

### ER2 — Independent implementation

MUST implement from the spec alone. MUST NOT depend on `@openoba/erdl`, `erdl-formal`, or any OpenOBA engine / library as the evaluation backend (depending on them forfeits "independent implementation"). Generic third-party libraries (calendar, regex, big integers) are allowed, but the ERDL semantics itself must be self-implemented.

### ER3 — Output format

For each vector, produce a result object matching the vector's `expected` schema:

```
{ "value": <number|string|boolean>, "value_type": "number"|"string"|"boolean", "errored": false, "warnings": [] }
```

### ER4 — Value-identical recomputation

For all **227** `v-engine-vectors.json` vectors, recompute and produce a `value` **value-identical** to `expected.value` (per `value_type`):

| `value_type` | Equality criterion |
|-------------|-------------------|
| `number` | scale-14 fixed-point integers, bit-equal (ER5) |
| `string` | byte-equal (after NFC normalization) |
| `boolean` | equal |

`errored` must match `expected.errored`.

### ER5 — Fixed-point arithmetic (E2)

Arithmetic MUST use **scale=14 fixed-point with half-even rounding** (money; no floating point). No rounding in intermediates; only output nodes round to scale=14 + half-even.

### ER6 — Empty-array folding (E8)

`all` / `any` / `none` over an empty array MUST fold to **false** (anti-vacuous-truth).

### ER7 — Leaf collapse (E11)

Missing fields collapse to **false** at comparison leaves (not Kleene propagation); `exists` is the only operator that senses field presence.

### ER8 — Evaluation errors (E12)

Evaluation errors (division by zero, non-array aggregate) MUST fold per E12 (tier 3–5 fold to false / `Missing`).

### ER9 — Do not read the oracle (neutrality)

MUST NOT read the vector `expected` field to "pass" (reading bypasses independent verification, violating the neutrality commitment). `expected` is a post-hoc cross-check only, provided outside the verification flow.

---

## 2. Conformance determination

A runner satisfying all of ER1–ER9 is declared a conforming expression-layer runner:

1. **Self-implementation**: implement from the spec + this contract from first principles (no ERDL SDK, no reading `expected`);
2. **Per-vector verification**: run all 227 `v-engine-vectors.json` vectors, `value` value-identical (ER4);
3. **Semantic-sensitive vectors all correct**: the 61 semantic-sensitive vectors (E2 / E8 / E10 + arithmetic / time / aggregate) must all match (see §3);
4. **Auto-record**: after CI cross-verification passes, register in [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md)'s expression-layer registry (who, what date, how many vectors) — the result is produced by the verification run itself, not hand-written endorsement;
5. **Auto-registration**: PR to `submissions/<runner>/`; after CI cross-verification passes, auto-registered on merge (failures are not registered).

---

## 3. Acceptance test (semantic sentinel)

The expression layer has no hash canary (the audit layer's K01 "stored hash generated by a defective implementation"); its "honesty sentinel" is the **semantic edge-case vectors** — the E2 / E8 / E10 / E9 constraints plus the arithmetic / time / aggregate nodes (**61 vectors**, the same set the in-repo second source independently recomputes). Note: this 61-vector set is the *honesty sentinel*, not the acceptance surface — conformance requires **all 227** vectors (ER4); the 61 are simply the hardest edge cases.

> Given the E2 (half-even rounding), E8 (empty-array folding), E11 (leaf collapse) edge-case vectors, an implementation with *subtly wrong semantics* necessarily mismatches; a *hard-coded-answers* fake runner cannot demonstrate an implementation — it has no evaluator that recomputes on arbitrary input, so code review + non-reproducibility expose it.

The semantic sentinel verifies not "whether it independently implements" but "whether it actually evaluates per the spec"; ER9 (no reading the oracle) secures the "independent implementation" premise.

---

## 4. Diagnostic oracle (expected field)

The vector `expected` field is the **semantic oracle**, separate from the contract:

- Stores each vector's `value` / `value_type` / `errored` / `warnings`;
- Purpose: CI cross-comparison, catching "right algorithm, wrong node semantics" drift;
- Not the rules themselves — conformance is defined by the contract, not by "matching the oracle".

---

## 5. Runner incentives (what you get)

The expression layer is a bounded, well-specified task (typically a day or two of focused work, further accelerated by AI assistance). What you get as a conforming runner:

- **Permanent attribution**: your name, the date, and the vector count in [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md), alongside the existing runners;
- **Spec acknowledgment**: credited in the spec's Acknowledgments section;
- **Historical milestone**: "the first expression-layer runner" is a permanent, citable fact.

> **Neutrality note**: your implementation must be **open source** so the independence is auditable — neutrality lives in the code, not the claim.

---

> *"Neutrality is measured, not claimed." — the contract lets any implementation conform from first principles; the semantic edge-case vectors catch semantic drift; ER9 (no reading the oracle) catches dishonesty. The three together are what let us assert "stronger than consistent with our own reference engine".*
