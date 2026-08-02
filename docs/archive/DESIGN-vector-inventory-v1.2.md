# DESIGN: Vector Set v1.3 — Full Inventory and Technical Pitfalls

> Copyright (c) 2026 Tang Qixin. All rights reserved.

> Version: 1.1 · 2026-07-29
> Status: Released
> Reference: RFC 001 §13.2 + SPEC v1.1 §3.4

---

## Part A: Technical Pitfalls Inherited from v1.0/v1.1

| # | Pitfall | v1.2 Mitigation |
|---|---------|----------------|
| T1 | Generator script out of sync with vector file | Single script `generate-vectors.cjs` produces all 101 vectors end-to-end |
| T2 | Internal state fields leak to output (`__placeholder`) | `stripInternalFields()` removes all `__` prefixed fields |
| T3 | Description claims coverage of DELEGATE but actual data has none | `validateVectorSet()` auto-checks decision type set vs description |
| T4 | AV vector_ref points to non-existent DO IDs | All vector_ref values point to real IDs in the same file |
| T5 | `expected_sha256` answer key structural risk (Erik Newton) | Answer key removed entirely; verification via five-step recomputation |
| T6 | Missing package.json | Root package.json with explicit dependency declaration |
| T7 | `$schema` URL not locally verifiable | Remote URL retained but local schema path noted in README |
| T8 | `version` vs `spec` confusion | spec = DO format version (permanent v1.0), version = vector set version (v1.3.0) |
| T9 | Delete vs null JCS semantic difference (c3f22df incident) | Generator uses physical `delete obj.field` not null assignment |
| T10 | Cross-version compatibility language vague | Output `metadata` declares clear version boundary: `breaking_from: ["v1.0","v1.1"]` |

---

## Part B: 63 Static Decision Vector Inventory

### DO-001 ~ DO-010: Security Baseline

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-001 | DENY | Financial agent exec sudo — Ring 0 Guardian block | eq, ring=0 |
| DO-002 | PASS | Same rule on safe read_file — no trigger | eq, selective match |
| DO-003 | DENY | Dangerous command rm -rf / | neq, dangerous command |
| DO-004 | PASS | Safe ls command — allowed | neq, safe command |
| DO-005 | DENY | Critical infrastructure agent write /etc/ | critical, starts_with |
| DO-006 | PASS | Rule set version change — new DENY works | rule_set_version |
| DO-007 | PASS | Empty rule set — default ALLOW fallback | empty policies |
| DO-008 | DENY | Ring 0 DENY vs Ring 3 ALLOW — Ring 0 wins | ring-0 precedence |
| DO-009 | EMERGENCY_HALT | Critical exception triggers immediate halt | ring-0, short-circuit |
| DO-010 | DENY | Severity escalation: medium + context -> high | severity escalation |

### DO-011 ~ DO-020: Override and Exemption

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-011 | ALLOW | Ring 3 ALLOW override Ring 0 DENY (safe) | override safe, instruction |
| DO-012 | ALLOW | Ring 3 ALLOW override Ring 0 DENY (unsafe — NOTIFY) | override unsafe |
| DO-013 | REQUEST_HUMAN | PII context access — human approval required | compliance, PHI |
| DO-014 | PASS | PII context but read-only — no approval needed | compliance, context diff |
| DO-015 | REQUEST_HUMAN | After-hours high-risk write — supervisor required | time-based |
| DO-016 | REQUEST_HUMAN | Medical data access — HIPAA trigger | compliance, PHI-medical |
| DO-017 | ESCALATE | Low-reputation agent (25) in high-risk context | multi-agent, reputation |
| DO-018 | ESCALATE | Cross-domain operation — escalate to domain admin | multi-agent, cross-domain |
| DO-019 | ESCALATE | Unknown tool — escalate | unknown tool |
| DO-020 | ALLOW | Known safe tool in allowlist | in, allowlist |

### DO-021 ~ DO-030: Correction and Unless

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-021 | CORRECT | Auto-correct: uppercase path -> lowercase | correction, ring 3 |
| DO-022 | CORRECT | Unit conversion: "1024KB" -> "1MB" | correction, unit |
| DO-023 | CORRECT | Path normalization: "a/./b/../c" -> "a/c" | correction, path |
| DO-024 | ALLOW | Unless exemption: file matches test pattern | unless, matches |
| DO-025 | DENY | Unless condition not met — rule fires | unless, no-match |
| DO-026 | ALLOW | Unless exemption + extra conditions met | unless, multi-condition |
| DO-027 | PASS | Null-safe: missing field `!=` -> false | null-safety, neq |
| DO-028 | PASS | Null-safe: missing field `=` -> false | null-safety, eq |
| DO-029 | PASS | Strict type: string "5" vs number 5 -> eq false | type-safety |
| DO-030 | ALLOW | metadata.decision=ALLOW fallback (no rule match) | metadata, fallback |

### DO-031 ~ DO-040: Notify/Quarantine/Rollback

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-031 | NOTIFY | Anomaly detection — notify, don't block | notify, anomaly |
| DO-032 | NOTIFY | Operation audit — log all exec calls | notify, audit-log |
| DO-033 | NOTIFY | Threshold warning: API calls > 1000/hour | notify, threshold |
| DO-034 | NOTIFY | Accompanying DENY notification | notify, accompany-deny |
| DO-035 | QUARANTINE | Suspicious file: .exe from web download | quarantine, ring 1 |
| DO-036 | QUARANTINE | Anomalous behavior — quarantine agent ops | quarantine, anomaly |
| DO-037 | QUARANTINE | Rate limit: 10 ops/sec -> quarantine | quarantine, rate-limit |
| DO-038 | ROLLBACK | Snapshot rollback: operation failed | rollback, snapshot |
| DO-039 | ROLLBACK | Partial failure: 1/3 batch failed -> rollback | rollback, partial |
| DO-040 | ROLLBACK | Trade rollback: amount exceeds threshold | rollback, transaction |

### DO-041 ~ DO-050: Operator Coverage

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-041 | ALLOW | `in`: tool.name in ["read","search","list"] | in |
| DO-042 | ALLOW | `not_in`: tool.name not_in ["exec","write","delete"] | not_in |
| DO-043 | ALLOW | `contains`: file_content contains "SAFE_MARKER" | contains |
| DO-044 | DENY | `matches`: malicious regex input (ReDoS test) | matches, ReDoS |
| DO-045 | REQUEST_HUMAN | `gt`: risk_score > 80 -> approval | gt |
| DO-046 | ALLOW | `lte`: risk_score <= 50 -> allow | lte |
| DO-047 | ALLOW | `starts_with`: tool.name starts_with "safe_" | starts_with |
| DO-048 | ALLOW | `ends_with`: file_name ends_with ".log" | ends_with |
| DO-049 | DENY | `exists`: context.high_risk_flag exists and true | exists, truthy |
| DO-050 | PASS | `exists`: context.high_risk_flag absent -> no trigger | exists, missing |

### DO-051 ~ DO-060: WORKFLOW Series

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-051 | WORKFLOW | Multi-step: build -> test -> deploy | workflow, multi-step |
| DO-052 | WORKFLOW | Conditional branch: staging vs prod | workflow, branch |
| DO-053 | WORKFLOW | Approval node: 3-level approval | workflow, approval |
| DO-054 | WORKFLOW | Workflow completion | workflow, completion |
| DO-055 | WORKFLOW_WAITING | Waiting for human approval | waiting, human |
| DO-056 | WORKFLOW_WAITING | Waiting for time window (9:00-18:00) | waiting, time |
| DO-057 | WORKFLOW_WAITING | Waiting for predecessor task | waiting, dependency |
| DO-058 | WORKFLOW_PROGRESS | Step 1/5 -> Step 2/5 | progress, step |
| DO-059 | WORKFLOW_PROGRESS | Phase build -> test | progress, phase |
| DO-060 | WORKFLOW_PROGRESS | Final step triggers final DO | progress, final |

### DO-061 ~ DO-063: Edge Cases

| ID | Decision | Scenario | Key Test |
|----|---------|---------|---------|
| DO-061 | DENY | Object deep comparison: args == {cmd:"rm",opts:"-rf"} | object-deep-eq |
| DO-062 | PASS | Empty extensions normalization | empty-extensions |
| DO-063 | DENY | Integer safe range: count > MAX_SAFE_INTEGER | integer-safe-range |

---

## Part C: Audit Hash Vectors (12)

| AV | Source | Decision | Test Intent |
|----|-------|---------|-------------|
| AV-001 | DO-001 | DENY | Ring 0 security intercept |
| AV-002 | DO-013 | REQUEST_HUMAN | PII compliance approval |
| AV-003 | DO-011 | ALLOW | Override safe-direction |
| AV-004 | DO-009 | EMERGENCY_HALT | Ring 0 short-circuit |
| AV-005 | DO-017 | ESCALATE | Low-reputation agent |
| AV-006 | DO-024 | ALLOW | Unless exemption |
| AV-007 | DO-027 | PASS | Null-safe field access |
| AV-009 | DO-021 | CORRECT | Auto-correction |
| AV-010 | DO-031 | NOTIFY | Anomaly notification |
| AV-011 | DO-038 | ROLLBACK | Snapshot rollback |
| AV-012 | DO-051 | WORKFLOW | Multi-step workflow |
| AV-013 | DO-051 | (canary) | Chain position tampering — EXPECTED_MISMATCH |

---

## Part D: Dynamic Vectors (26)

| Category | IDs | Count | Description |
|----------|-----|:---:|-------------|
| Temporal | T-001~T-010 | 10 | Time-of-day, day-of-week, holidays, leap year, Y2K38 boundary |
| Seeded | S-001~S-008 | 8 | Deterministic random seeds |
| Stateful | ST-001~ST-008 | 8 | State machine transitions |

---

## Part E: Reserved Vectors

| ID | Type | Decision | Status |
|----|------|---------|--------|
| DO-064 | Decision | DELEGATE | Reserved for v1.4 |

---

## Part F: Verification Checklist

- [ ] 63 `vectors[]` all generated, no missing IDs
- [ ] 26 `dynamic_vectors` all generated
- [ ] 12 `audit_vectors` all generated
- [ ] AV-001~AV-012 audit.hash recomputed via five-step = MATCH
- [ ] AV-013 audit.hash = MISMATCH (chain canary)
- [ ] No `__` prefixed fields leak to output JSON
- [ ] All `vector_ref` values point to real DO IDs
- [ ] Actual decision types = metadata.decision_types_covered
- [ ] All string fields free of `\r` and `\n`
- [ ] `activated_fields` excludes `human_oversight` (CORE #13)
- [ ] All DOs have full audit object: `hash` + `previous_hash` + `commitment`

---

> "101 vectors. Each must be independently verifiable fact, not claimed numbers."
