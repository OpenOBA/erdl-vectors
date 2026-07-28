# ERDL Decision Object v1.2 — Enterprise AI Agent Audit Infrastructure Standard

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **Whitepaper · Request for Comments (RFC)**
>
> **Version**: Draft 3 · 2026-07-27
> **Authors**: OpenOBA Team
> **Requested Commenters**: Erik Newton (Concordia), Christopher Hopley (chopmob-cloud / AlgoVoi), Regulatory Compliance Experts, Joint Audit Committee
> **Status**: Request for Comments — Not a final version. All design details are subject to adjustment upon receiving feedback.
>
> **Keyword Interpretation**: The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://datatracker.ietf.org/doc/rfc2119/) and [RFC 8174](https://datatracker.ietf.org/doc/rfc8174/).
>
> **Revision History**:
> - Draft 1 (2026-07-27): Initial version, 23-field design
> - Draft 2 (2026-07-27): Revised per Joint Audit Committee feedback, expanded to 24 fields, added JCS numeric constraints, hot/cold separation privacy scheme, cross-version audit chain anchoring
> - Draft 3 (2026-07-27): Introduced flat hashing architecture — extensions participate directly in main JCS, reinforcing extension-zone tamper resistance
>
> **Abstract**: This whitepaper presents the ERDL Decision Object v1.2 design — a cross-implementation, tamper-proof, multi-jurisdiction-compatible audit decision record standard for enterprise AI Agents. The design is built on JCS (RFC 8785) + SHA-256 cryptographic foundations, technically aligned with IETF Agent Audit Trail (draft-sharif-agent-audit-trail-00), and covers audit requirements across 12 major global regulatory frameworks including EU AI Act, GB/Z 185, NIST AI RMF, and COSO 2026. The DO contains 24 top-level fields (CORE 14 + JURISDICTION 10), achieves on-demand adaptation through a jurisdiction activation mechanism, and ensures integrity through flat hashing architecture — all fields uniformly participate in JCS, and any tampering directly changes audit.hash.

---

## Table of Contents

**Part I: Architecture and Design**
1. Background and Motivation (including v1.0/v1.1 compatibility statement)
2. Design Philosophy: Universal Fact Container
3. Cryptographic Foundation: End-to-End JCS (RFC 8785) + Flat Hashing
4. Decision Object Schema: 24-Field Design (CORE 14 + JURISDICTION 10)

**Part II: Compliance and Adaptation**
5. Omni-Directional Compatibility × On-Demand Adaptation: Jurisdiction Activation Mechanism
6. 12 Regulatory Framework Compatibility
7. Ecosystem Compatibility (Three-Party Audit Perspectives / IETF AAT / MCP / A2A / Agent Frameworks / OpenTelemetry / Audit Report Output)
8. Privacy and Data Minimization Design
9. Regulatory Versioning and Upgrade Path

**Part III: Governance and Evolution**
10. Long-Term Maintenance and Compliance Evolution
11. Extension Zone Self-Describing Design
12. Field Governance Principles

**Part IV: Verification and Appendices**
13. Vector Set and Cross-Implementation Verification
14. Request for Comments
Appendix B: Reference Standards

---

## Part I: Architecture and Design

---

## 1. Background and Motivation

### 1.1 AI Agents Enter Highly Regulated Domains

By 2026, AI Agents have entered **highly regulated domains** — enterprise finance, healthcare, recruitment, insurance, critical infrastructure, and beyond. Global regulators are closing the window on "black-box decision-making":

- **EU AI Act**: Article 12 requires high-risk AI systems to automatically log events; Article 14 requires effective human oversight
- **GB/Z 185-2026**: China's first suite of national standards for intelligent agent interconnection, requiring 28-digit AID identity codes, five security mechanisms for tool invocation, and audit log retention ≥ 36 months
- **COSO 2026**: Generative AI internal control guidance, requiring logs/traceability covering model versions, prompts, inputs/outputs, and approval records
- **Colorado SB 205**: AI decisions must be explainable; consumers have the right to appeal

Enterprise compliance teams face a common technical barrier: **Agents from different vendors output decisions in different formats.** Auditors receive Prompt logs + conversation screenshots, not structured, verifiable decision records.

### 1.2 Positioning of the ERDL Decision Object

The ERDL Decision Object (DO) provides a **machine-readable, cross-implementation verifiable, tamper-proof, multi-jurisdiction-compatible** standard output format for Agent decisions.

Its core promise:

> **Given the same rule set and context, any conformant ERDL implementation MUST produce byte-identical Decision Objects.**

### 1.3 Why v1.2

v1.0 and v1.1 have been validated by three independent implementations (Rulsynor/TypeScript [OpenOBA], Concordia/Python [Erik Newton], chopmob-cloud/Python [Christopher Hopley]). However, engineering practice exposed several issues requiring correction:

| Issue | Source | v1.2 Solution |
|-------|--------|---------------|
| `policies[].hash` uses `JSON.stringify` (non-deterministic) | Independent audit report CQ-3, 2026-07-27 | End-to-end JCS (RFC 8785) |
| v1.1 DO covers 7/10 decision types, AV covers 6/10 (audit hash vectors missing for NOTIFY/ROLLBACK/QUARANTINE; DELEGATE defined in v1.2 SPEC, vector set deferred to v1.3) | Internal audit | DO+AV cover 13 external decision types (10+3 WORKFLOW), DELEGATE deferred to v1.3 |
| `expected_sha256` removed as answer key without replacement mechanism for verification integrity | Erik Newton, A2A #2031 | AV-008 stale regression vector + five-step verification method |
| Missing regulation versioning and jurisdiction adaptation mechanism | ERDL v1.2 design | `compliance_profile` + CORE × JURISDICTION layering |
| Missing long-term architectural guarantee for Schema Freeze and Compliance Evolution | ERDL v1.2 design | Flat hashing + content-addressable schema reference |
| v1.0/v1.1 → v1.2 migration path | ERDL v1.2 design | Breaking change scope declaration + cross-version audit chain anchoring (see §1.4) |

### 1.4 v1.0/v1.1 Backward Compatibility Statement

**v1.2 is a breaking version change.** The following changes render the v1.2 DO's `audit.hash` completely incompatible with v1.0/v1.1:

1. `policies[].hash` computation method changed (JSON.stringify → JCS canonicalize)
2. `rule_set_version` participates in JCS serialization (v1.1 had no such field)
3. Flat hashing architecture — extensions participate directly in main JCS

**v1.0 and v1.1 remain frozen.** Existing three-party verification results are preserved as historical archives.

**After v1.2 release, all new implementations SHOULD validate against the v1.2 101-vector set.** Erik Newton (Concordia) and Christopher Hopley (chopmob-cloud) have been invited to perform independent re-verification against the v1.2 vectors. Once verified, the v1.0/v1.1 vector sets will be marked "superseded by v1.2."

### 1.5 Purpose of Request for Comments

This whitepaper is a **Request for Comments (RFC)**, sent to:
- **Erik Newton (Concordia)**: Second independent runner of the ERDL Decision Object (Python implementation). Concordia independently discovered the structural risk of the `expected_sha256` answer key during the v1.1 freeze period
- **Christopher Hopley (chopmob-cloud / AlgoVoi)**: Proposer of the compliance substrate model and cross-validation vision. Independently audited the v1.1 c3f22df incident (em-dash space fix causing 3/7 vector audit.hash mismatches, commit c3f22df → 5cff368)
- **Regulatory Compliance Experts and the Joint Audit Committee**: For review of DO field design against 12 regulatory frameworks, and the long-term maintainability of the flat hashing architecture

All received feedback will be publicly recorded and responded to item by item before the final v1.2 release.

---

## 2. Design Philosophy: Universal Fact Container

### 2.1 Core Principle

**The ERDL Decision Object is positioned as a Universal Fact Container, not a compliance filing form for any specific regulation.**

The DO records immutable physical/digital facts generated during the decision process:

- Which model the Agent used (`model_id`)
- Which rules were evaluated (`policies[]`)
- Which conditions were matched (`evaluation.matched_rules[]`)
- What decision was output (`result.decision`)
- Who participated in oversight (`human_oversight`)
- How long it took (`evaluation_duration_ms`)

These "facts" remain stable across jurisdictions and regulatory frameworks — regardless of regulatory evolution, a record stating "an Agent was denied execution of a sudo command at 2026-07-27 14:00 UTC" is always a fact.

**Compliance determination (whether this decision complies with a given regulation) is dynamically computed by an external compliance evaluation engine (Policy as Code, e.g., OPA/Rego) reading the facts within the DO.** The definition of "high-risk AI" changed? Update the external engine's rule library; DO Schema stays unchanged.

### 2.2 Design Principles

1. **Self-Contained DO**: A regulator opening any single DO can find all compliance-required information within that JSON, without needing to jump to external systems. Self-containment boundary: the DO contains "decision metadata and hash evidence." For very large Contexts (e.g., file contents > 4KB), MUST use the `context_snapshot_hash` + `context_ref` reference pattern; large files MUST NOT be inlined
2. **Separation of Facts from Compliance**: The DO records facts; external engines determine compliance. Regulatory evolution is absorbed by updating external rules; core fields are permanently frozen
3. **CORE × JURISDICTION × EXTENSIONS**: The 14 CORE fields are permanently immutable; the 10 JURISDICTION fields are activated per jurisdiction; the extensions layer carries future regulatory extensions
4. **Cryptographic Integrity**: Flat hashing — CORE+JURISDICTION+EXTENSIONS participate in a single JCS; any field tampering directly changes audit.hash
5. **Append-Only Schema**: Once a field is published, it can only be marked `deprecated`, never physically deleted. All historical DOs remain verifiable by any version of the validator

---

## 3. Cryptographic Foundation: End-to-End JCS (RFC 8785) + Flat Hashing

### 3.1 JCS Numeric Type Constraints

JCS (RFC 8785 §3.2.2.3) serializes JSON numbers based on the IEEE 754 double-precision specification. IEEE 754 implementations differ across languages and may produce inconsistent cross-language JCS serialization results without constraints:

| Language | Risk |
|----------|------|
| Python | Supports arbitrary-precision integers/Decimal. `12` may be serialized as `12` or `12.0` |
| JavaScript | Only supports double-precision floating-point. Large integers (>2^53) lose precision |
| Go | `json.Marshal` by default serializes integers without decimal points |

**v1.2 Mandatory Constraints**:

1. **Integer types** (`evaluation.total_evaluated`, `total_matched`, `evaluation_duration_ms`, `policies[].version`, `ring`, etc.) MUST be guaranteed by each implementation to output as integers without decimal points, and their value ranges MUST fall within JavaScript's safe integer range (-(2^53-1) to 2^53-1)
2. **Float/monetary types** (e.g., finance-related fields in extensions) MUST use string representation (e.g., `"100.50"`); native number types are forbidden
3. **NaN/Infinity forbidden**: No numeric value participating in JCS serialization MUST be NaN or Infinity (RFC 8785 mandatory requirement)
4. **String format constraint**: Numeric string values participating in JCS MUST use canonical representation — no leading/trailing whitespace (`" 0.95"`), no scientific notation (`"1e-3"`), no leading zeros (`"00.95"`)
5. **Omit over Null**: All optional fields whose value is `null`, `undefined`, or empty array `[]` MUST be physically deleted (Omit) from the JSON tree before being passed to the JCS serializer; key names MUST NOT be preserved. `{"a": null}` and `{}` produce different canonical bytes under JCS

6. ⚠️ **Raw Data Pass-Through (Critical for Finance/Audit)**: ERDL does not perform financial calculations — no amount addition, currency conversion, rounding, or precision normalization. Numeric string values in extensions (e.g., amounts, tax rates, quantities) MUST preserve the **full precision and original form** as output by the business layer, including trailing zeros (e.g., `"100.500"` MUST NOT be simplified to `"100.5"`). This constraint has triple protection: (a) ERDL as notary — any bytes written to extensions cannot be modified by ERDL itself; tampering is detected by JCS+SHA-256; (b) Audit traceability — if the business layer introduces amount discrepancies due to floating-point precision or rounding rules, the error source (business layer, not record layer) can be located via the original values in the DO; (c) Precision specification ownership — ISO 4217 currency codes, Decimal128 precision baselines, banker's rounding, etc. are business-layer responsibilities; the business layer should reference the corresponding precision specification document via `schema_ref` in the extension entry

7. ⚠️ **Resource Boundaries (DoS Protection)**: To prevent maliciously constructed DOs from exhausting validator resources, the following hard limits are specified: (a) a single DO JSON serialization MUST NOT exceed **1 MB** (including extensions); (b) the extensions array MUST NOT exceed **100 entries**; (c) JSON nesting depth MUST NOT exceed **10 levels**. Validators MUST check these boundaries before parsing. DOs exceeding any limit MUST be rejected and flagged as `resource_limit_exceeded`

> Language-specific JCS preprocessing guidelines (Python integer precision, Go `json.Marshal` trailing `.0`, Java `BigDecimal`, Rust `serde_json`, etc.) are detailed in the [Runner's Guide](docs/RUNNERS-GUIDE.md) §9 "Language Binding Considerations".

### 3.2 End-to-End JCS

In v1.1, `policies[].hash` used `JSON.stringify`. `JSON.stringify` does not guarantee key ordering — ES2015+ in practice serializes in insertion order, but this behavior is not guaranteed by the specification. Different Node.js versions or different language implementations may produce different byte sequences. v1.2 unifies all hashes to JCS:

```
policies[].hash = SHA-256(JCS(policy))
```

**Self-Referencing Exclusion Convention**: When computing `policies[].hash`, the `hash` key MUST be temporarily removed from the policy object before JCS. The actual computation is `SHA-256(JCS(policy_without_hash_key))`, and the hash value is written back after computation. This convention applies to all hash fields in the Decision Object that depend on their own JCS — including `policies[].hash` and `compliance_profile.profile_hash` — ensuring hashes do not form self-referencing loops. `audit.hash` follows the same principle, implemented via physical deletion in Step 2 of the five-step verification method.

### 3.3 Flat Hashing Architecture

v1.2's `audit.hash` adopts a flat hashing architecture — all Decision Object fields (CORE + JURISDICTION + EXTENSIONS) participate in a single JCS serialization, producing a single cryptographic digest. Any field tampering directly changes `audit.hash`. Integrity is guaranteed at the cryptographic level, not the procedural level.

```
audit.hash calculation formula (Five-Step Verification):

  Step 1: Deep clone the decision_object
  Step 2: Physically delete self-referencing / external fields
          DELETE audit.hash + DELETE signature + DELETE signing_key_id
          (extensions remains in the object, participating in subsequent JCS)
  Step 3: JCS(CORE + JURISDICTION + EXTENSIONS) → canonical_full
  Step 4: SHA-256(canonical_full) → recomputed hash
  Step 5: Compare recomputed hash with stored audit.hash
```

**Design Principle**: The flat architecture ensures integrity depends on cryptography, not process. Extensions participate directly in the main JCS. Tampering with any field (including data inside extensions) changes `audit.hash`. The same applies to signatures — signature is stripped in Step 2, but extensions remain in the signature preimage, ensuring the non-repudiation required by HIPAA/PCI DSS covers all decision data.

### 3.4 Chain Anchoring

Each DO is linked to the previous DO's `audit.hash` via `audit.previous_hash`, forming a unidirectional incrementing audit hash chain (similar to lightweight blockchain linking — storing only hash references, not redundantly storing preceding content). Any tampering with any record in the chain breaks the hash consistency of all subsequent records.

**Chain Break Detection**: When a validator detects any of the following conditions, the audit chain is deemed broken at that position —
1. A DO's `audit.hash` does not match the independently recomputed result (single record tampering)
2. A DO's `audit.previous_hash` does not match the preceding DO's `audit.hash` (inter-chain break)
3. A DO in the chain is missing (audit record physically deleted)

**Post-Break Behavior**: The validator MUST mark the break position (DO ID + break type), locate the tampered/deleted record, and group DOs before and after the break point for reporting. The chain segment before the break point maintains audit integrity (tampering does not propagate backward); the chain segment after the break point MUST be marked as `chain_invalid` and cannot be used for compliance evidence.

> Chain breakage does not equal full-chain invalidation. Single-point tampering should be precisely located rather than causing the entire audit chain to be voided — this is the core advantage of lightweight linking: allowing auditors to independently verify the integrity on each side of the break point.

### 3.5 Technical Alignment with IETF AAT

IETF draft-sharif-agent-audit-trail-00 uses exactly the same cryptographic primitives:

| Alignment Item | ERDL DO v1.2 | IETF AAT |
|---------|-------------|----------|
| Normalization | JCS (RFC 8785) | JCS (RFC 8785) ✓ Consistent |
| Digest | SHA-256 (FIPS 180-4) | SHA-256 (FIPS 180-4) ✓ Consistent |
| Chain field | `audit.previous_hash` | `prev_hash` ✓ Semantically consistent |
| Signature | ECDSA P-256 (FIPS 186-5) | ECDSA P-256 (FIPS 186-5) ✓ Consistent |

---

## 4. Decision Object Schema: 24-Field Design (CORE 14 + JURISDICTION 10)

### 4.1 CORE Fields (14 — All DOs MUST include, permanently frozen)

| # | Field | Type | Description |
|---|-------|------|-------------|
| 1 | `spec` | const `"decision-object-v1.0"` | DO format identifier |
| 2 | `decision_id` | UUID v7 | Unique identifier for this decision |
| 3 | `compliance_profile` | object | Jurisdiction activation configuration (see §5) |
| 4 | `execution_trace_id` | UUID v7 | Global correlation ID across DO+AAT |
| 5 | `timestamp` | ISO 8601 UTC ms | Decision timestamp |
| 6 | `evaluation_duration_ms` | integer | Decision duration (milliseconds, integer) |
| 7 | `agent` | object | Agent identity (id/role/version + extended sub-fields) |
| 8 | `context` | object | Evaluation context (tool.name/args, etc.) |
| 9 | `rule_set_version` | object | Rule set version identifier (participates in JCS) |
| 10 | `policies` | array | Activated policy set (includes JCS hash + author_id) |
| 11 | `evaluation` | object | Rule evaluation details (matched_rules/totals) |
| 12 | `result` | object | Final decision (decision/severity/reason/action_taken) |
| 13 | `human_oversight` | object | Human oversight (includes override_reason sub-field) |
| 14 | `audit` | object | Tamper-proof audit (hash/previous_hash/commitment) |


### 4.2 JURISDICTION Fields (10 — Activated on demand by compliance_profile)

| # | Field | Type | Activation Condition |
|---|-------|------|---------------------|
| 15 | `model_id` | string | NIST / COSO / Colorado compliance |
| 16 | `fairness_assessment` | string | NIST / Colorado (high-risk decisions) |
| 17 | `impact_assessment_id` | UUID | Colorado / ISO 42001 compliance |
| 18 | `autonomy_level` | string | Singapore MGF / COSO compliance |
| 19 | `data_modification_expected` | boolean | HIPAA / PCI DSS / CAICT compliance |
| 20 | `context_snapshot_hash` | string | PII-containing scenarios / cross-Agent verification |
| 21 | `sanitized_context` | string | PII-containing scenarios / GDPR compliance |
| 22 | `confidence_score` | integer | NIST AI RMF compliance (0~100, integer, representing percentage; e.g., 95 means 95%) |
| 23 | `signature` | string (Base64url) | HIPAA / PCI DSS (critical decisions). ECDSA P-256 signature covering all DO content except audit/signature/signing_key_id |
| 24 | `signing_key_id` | string | Companion to `signature` field, identifies the public key version used for signature verification. Auditors use this ID to retrieve the corresponding public key from KMS. Does not participate in JCS serialization, does not participate in signature preimage — its role is purely key metadata; changing key_id does not affect the signature value |

> **Numbering Rule**: CORE #1–#14 (permanently frozen), JURISDICTION #15–#24 (activated on demand), EXTENSIONS is an open-ended extension zone and is not numbered.

### 4.3 extensions Field (Open-Ended Extension Zone — Directly Participates in Main JCS)

Self-describing structure of each extension entry:

```json
{
  "extensions": [
    {
      "id": "unique-extension-entry-id",
      "regulatory_ref": {
        "framework": "Framework-Name",
        "version": "Version-Identifier",
        "effective_date": "YYYY-MM-DD"
      },
      "schema_ref": "sha256:... (JCS+SHA-256 of the field's schema definition document, used as content-addressable reference)",
      "field": {
        "name": "field_name",
        "type": "number:string",
        "description": "Human-readable description"
      },
      "value": "actual data"
    }
  ]
}
```

**Role of `schema_ref`**: Points to the complete schema definition document of the extension field (type, value domain, source, example), retrievable content-addressably via hash. Even if the ERDL committee has disbanded, as long as that hash value can be retrieved from a content-addressable network to the corresponding schema document, auditors can fully understand the semantics of the extension field.

### 4.4 Sub-Object Extension Fields

**agent object**:

| Sub-field | Type | Description |
|-----------|------|-------------|
| `agent.id` | string | Agent unique identifier (DID:ERDL or AID format) |
| `agent.role` | string | guardian / operator / observed |
| `agent.version` | string | Agent software version |
| `agent.aid` | string | GB/Z 185 compliance (28-digit AID identity code) |
| `agent.known_limitations` | string[] | EU AI Act Art.13 compliance |
| `agent.tool_registry_hash` | string | GB/Z 185.7 compliance |
| `agent.algorithm_filing_no` | string | China algorithm filing number |
| `agent.model_registration_id` | string | China model launch filing number |

**policies object**:

| Sub-field | Type | Description |
|-----------|------|-------------|
| `policies[].id` | string | Policy unique identifier |
| `policies[].name` | string | Human-readable name |
| `policies[].author_id` | string | Identifier of the policy author (COSO SoD compliance) |
| `policies[].version` | integer | Policy version number |
| `policies[].hash` | string | JCS+SHA-256 hash of the policy's full content |

**evaluation object**:

| Sub-field | Type | Description |
|-----------|------|-------------|
| `evaluation.proposal_id` | UUID or null | Rule proposal ID |
| `evaluation.matched_rules[]` | array | List of matched rules |
| `evaluation.matched_rules[].rule_id` | string | Rule ID |
| `evaluation.matched_rules[].decision` | string | The rule's decision |
| `evaluation.matched_rules[].reason` | string | Reason/explanation |
| `evaluation.matched_rules[].correction` | string | Correction content (when CORRECT) |
| `evaluation.matched_rules[].instruction` | string | Suggestion (when ALLOW) |
| `evaluation.matched_rules[].ring` | integer | Execution ring level (0-3) |
| `evaluation.total_evaluated` | integer | Total number of rules evaluated |
| `evaluation.total_matched` | integer | Total number of rules matched |
| `evaluation.confidence_score` | integer | Raw LLM-provided confidence (integer, 0~100, representing percentage; e.g., 95 means 95%) |

> ⚠️ **Distinction from top-level `confidence_score`**: `evaluation.llm_raw_confidence` is the raw confidence value returned by the LLM during this specific evaluation (may vary per evaluation) — this is part of the rule engine execution record. The top-level JURISDICTION `confidence_score` is a configurable confidence baseline required by NIST AI RMF (activatable/configurable in JURISDICTION) — this is a compliance declaration. The two are independently populated and do not substitute for each other.

**human_oversight object**:

| Sub-field | Type | Required | Description |
|-----------|------|:---:|-------------|
| `human_oversight.required` | boolean | ✓ | Whether human intervention is legally required for this decision |
| `human_oversight.status` | string | ✓ | approved / rejected / overridden / pending / not_applicable |
| `human_oversight.human_actor_id` | string | Conditional | ID of the human operator who intervened |
| `human_oversight.timestamp` | string | Conditional | Timestamp of human action (ISO 8601 UTC ms). **MUST be ≥ `timestamp`** — human oversight must occur after the Agent decision. **MUST be physically omitted (Omit) if status is `not_applicable`** |
| `human_oversight.reason` | string | Optional | Reason for human action |
| `human_oversight.override_reason` | string | Conditional | MUST when status is overridden — the specific reason why a human overrode the Agent's decision (EU AI Act Art.14 "effective oversight" compliance) |

### 4.5 Field Bloat Comparison

| Deployment Scenario | Activated Fields | DO Size |
|---------------------|:---:|---------|
| Baseline (no jurisdiction requirements, CORE 14 fields only) | 14 | ~1050 bytes |
| China (GB/Z 185 + CAICT) | 18 (+ agent.aid, agent.tool_registry_hash, agent.algorithm_filing_no, agent.model_registration_id) | ~1120 bytes |
| EU High-Risk (EU AI Act) | 17 (+ agent.known_limitations, confidence_score) | ~1080 bytes |
| US Healthcare (HIPAA) | 18 (+ data_modification_expected, context_snapshot_hash, sanitized_context, signature, fairness_assessment) | ~1150 bytes |
| Global Full Activation (Vector Set) | 24 | ~1400 bytes |

---

## Part II: Compliance and Adaptation

---

## 5. Omni-Directional Compatibility × On-Demand Adaptation: Jurisdiction Activation Mechanism

### 5.1 Design Motivation

Globally deployed Agents may be simultaneously subject to regulations from multiple jurisdictions — each jurisdiction's regulatory scope is independent, and every DO cannot be required to carry all jurisdiction-specific fields.

### 5.2 `compliance_profile`: Declarative Jurisdiction Activation

```json
{
  "compliance_profile": {
    "profile_id": "erdl-compliance-v1.2",
    "profile_hash": "sha256:a1b2c3...",
    "jurisdictions": ["EU", "CN"],
    "industries": ["financial-services"],
    "risk_level": "high",
    "activated_fields": [
      "model_id", "impact_assessment_id", "agent.known_limitations",
      "agent.aid", "agent.tool_registry_hash",
      "confidence_score", "fairness_assessment",
      "data_modification_expected", "autonomy_level",
      "context_snapshot_hash", "sanitized_context", "signature"
    ],
    "regulatory_references": [
      {
        "framework": "EU-AI-Act",
        "version": "Regulation-2024-1689",
        "amended_by": "Digital-Omnibus-2026",
        "jurisdiction": "EU",
        "effective_date": "2027-12-02",
        "requires_fields": ["evaluation_duration_ms", "human_oversight", "agent.known_limitations"]
      },
      {
        "framework": "GB-Z-185-2026",
        "version": "2026-05-22",
        "jurisdiction": "CN",
        "requires_fields": ["agent.aid", "agent.tool_registry_hash"]
      }
    ]
  }
}
```

### 5.3 Three-Layer Declaration

| Layer | Field | Role |
|-------|-------|------|
| **Jurisdiction** | `jurisdictions` | Constrains regulatory applicability (CN/EU/US/SG/ALL) |
| **Industry** | `industries` | Activates industry-specific fields (healthcare → HIPAA, financial → SOX) |
| **Risk** | `risk_level` | Activates risk-related fields (critical → signature mandatory) |

### 5.4 `activated_fields` and Schema Trimming Rules

- Explicitly declares which JURISDICTION fields are activated in this DO
- An auditor opening a DO → immediately knows which additional compliance requirements are covered
- A field is in `activated_fields` but missing in the DO → compliance failure
- A field is NOT in `activated_fields` but present in the DO → redundant but not a violation
- Participates in JCS serialization → any tampering with the activated field set breaks `audit.hash`

**Schema Trimming Rules (Mandatory)**: Before computing `audit.hash`, the DO MUST undergo "pre-serialization trimming" — JURISDICTION fields NOT declared in `activated_fields` MUST be physically removed (Omit) from the JSON object; they must not be set to null, empty string, or any other placeholder value. Omit vs null produces different canonical byte sequences under JCS (same design rationale as delete-vs-blank in v1.1). Each language SDK MUST provide a "pre-serialization trim" utility function to be executed before JCS canonicalize. The vector set uses full activation mode, so trimming rules do not alter vector verification results.

### 5.5 Configuration Methods

`compliance_profile` supports configuration via API, CLI, configuration files, and admin panels. Enterprises may manually specify `activated_fields` for custom overrides (e.g., deployed in China but additionally requiring NIST's `fairness_assessment` field).

---

## 6. 12 Regulatory Framework Compatibility

### 6.1 Covered Frameworks

| Framework | Jurisdiction | Binding Force |
|-----------|:---:|:---:|
| EU AI Act (Regulation 2024/1689) | EU | Mandatory |
| NIST AI RMF 1.0 | US | Voluntary |
| COSO GenAI 2026 | Global | Industry Standard |
| ISO/IEC 42001:2023 | Global | Certifiable |
| GB/Z 185-2026 | CN | National Standard |
| OWASP Agentic Top 10 2026 | Global | Industry Standard |
| IEEE P3395 | Global | Under Development |
| HIPAA | US | Mandatory |
| PCI DSS v4.0.1 | Global | Contractually Enforced |
| Colorado SB 205 | US-CO | Mandatory |
| Singapore MGF for Agentic AI | SG | Best Practice |
| CAICT Trusted AI Agent Assessment 2.0 | CN | Industry Authoritative |

### 6.2 Per-Framework Key Requirement Coverage

| Requirement | EU AI Act | NIST | COSO | ISO | GB/Z | OWASP | HIPAA | PCI | CO-SB205 | SG-MGF | CAICT |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Automatic event logging | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tamper-proofing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agent identity | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Decision explainability | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ |
| Human oversight | ✓ | ✓ | ✓ | — | — | ✓ | — | — | ✓ | ✓ | ✓ |
| Rule version traceability | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Context review | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Digital signature | — | — | — | — | — | ✓ | ✓ | ✓ | — | — | — |
| Cross-system correlation | — | — | ✓ | — | ✓ | ✓ | — | — | — | — | ✓ |
| Model version | — | ✓ | ✓ | — | — | — | — | — | ✓ | — | — |
| Fairness assessment | — | ✓ | — | — | — | — | — | — | ✓ | — | — |
| Impact assessment | — | — | — | ✓ | — | — | — | — | ✓ | — | — |
| Autonomy level | — | — | ✓ | — | — | — | — | — | — | ✓ | — |
| Decision duration | ✓ | — | — | — | — | — | — | — | — | — | — |
| System limitations declaration | ✓ | — | — | — | — | — | — | — | — | — | — |
| Tool registry | — | — | — | — | ✓ | — | — | — | — | — | — |
| Data modification tracking | — | — | — | — | — | — | ✓ | ✓ | — | — | ✓ |
| Workflow orchestration (WORKFLOW) | — | — | ✓ | — | — | — | — | — | — | — | — |
| Workflow waiting (WORKFLOW_WAITING) | — | — | ✓ | — | — | — | — | — | — | — | — |
| Workflow progress (WORKFLOW_PROGRESS) | — | — | ✓ | — | — | — | — | — | — | — | — |
| Confidence/risk quantification | — | ✓ | — | — | — | — | — | — | — | — | — |
| Segregation of Duties (SoD) | — | — | ✓ | — | — | — | — | — | — | — | — |
| Algorithm filing | — | — | — | — | ✓ | — | — | — | — | — | — |
| Privacy/Right to erasure | ✓ (GDPR) | — | — | — | ✓ (PIPL) | — | ✓ | — | — | — | — |

**Note**: DELEGATE is defined in v1.2 SPEC but the vector set is reserved for v1.3.

**All 24 cross-framework requirements are fully covered through the DO's 24 fields plus the hot/cold separation architecture.**

---

## 7. Ecosystem Compatibility

### 7.1 Three-Party Audit Perspective Overview

The ERDL Decision Object serves three types of audit users, each with different review needs:

| Audit Type | Role | Core Question | Review Method | Frequency |
|------------|------|---------------|---------------|:---:|
| **Internal Audit** | Internal Audit Dept / Compliance Team | "Are AI decisions executed according to established rules? Are controls effective?" | Walkthrough tests, tests of controls, sampling | Quarterly/Semi-annual |
| **Third-Party Audit** | External auditors (e.g., Big Four accounting firms) | "Are DO records complete and tamper-proof? Can the audit chain be independently verified?" | Substantive testing, hash chain integrity verification, independent recalculation | Annual |
| **Regulatory Review** | Regulatory bodies (e.g., EU AI Office, Cyberspace Administration of China) | "Are regulatory requirements satisfied?" | Per-field compliance mapping, high-risk event spot checks | Ad hoc |

All three audit types share the same set of DOs as evidence sources, but use different review paths. The following sections define ERDL DO's specific support for each audit type.

### 7.2 Internal Audit Support

#### 7.2.1 Walkthrough Test

Internal auditors trace the complete evidence chain of a single DO to verify "the rule engine operates as designed":

1. **Rule version confirmation**: Compare `rule_set_version.id` against the rule set hash in deployment records → confirm the correct rule version was used
2. **Rule trigger tracing**: `evaluation.matched_rules[].rule_id` → locate the specific rule line in the specific rule file
3. **Per-condition verification**: Field values in `context` → compare item by item against when conditions → confirm matching logic is correct
4. **Decision consequence confirmation**: `result.decision` + `result.action_taken` → confirm the Agent actually executed the decision
5. **Human oversight confirmation**: `human_oversight.status` → confirm decisions requiring human intervention received approval

A single DO provides all evidence required for one walkthrough test — no need to switch to other systems to view logs or code.

#### 7.2.2 Test of Controls

The COSO five components require periodic testing of internal control effectiveness. DOs support control testing as follows:

| COSO Control Test | DO Field | Test Method |
|-------------------|----------|-------------|
| Access control effectiveness | `result.decision` = DENY + `matched_rules[]` | Calculate block rate; spot-check whether rule triggers for blocked operations are reasonable |
| Segregation of Duties (SoD) | `agent.id` vs `policies[].author_id` | Confirm rule author ≠ rule executor |
| Change management compliance | `rule_set_version.id` + `timestamp` | Trace rule change timeline against approval records |
| Human oversight adequacy | `human_oversight.status` + `override_reason` | Calculate human intervention rate; review whether override reasons are sufficient |
| System limitation compliance | `agent.known_limitations` | Confirm DOs always operate within system capability boundaries |

#### 7.2.3 Sampling

Internal auditors sample from the DO stream using statistical methods:
- **Stratified sampling by decision type**: e.g., from 10,000 DOs, sample 100 DENY, 50 ALLOW, 20 REQUEST_HUMAN
- **Risk-weighted sampling**: Full review of critical/high severity DOs; proportional sampling for medium/low
- **Time-window sampling**: Randomly select N time windows within the audit period and fully review each window

After sampling, perform a walkthrough test on each DO. The five-step verification method ensures the sample has not been filtered or tampered with.

### 7.3 Third-Party Audit Support

#### 7.3.1 Independent Verification

Third-party auditors do not depend on the Agent runtime environment — only the DO JSON files and the public vector set are needed:

1. **Hash chain integrity verification**: Traverse every DO on the audit chain, verifying the `audit.previous_hash` → `audit.hash` link is complete
2. **JCS+SHA-256 independent recalculation**: Using the auditor's own canonicalizer implementation (Python/Go/Rust), recalculate the `audit.hash` of any DO and compare
3. **Vector set validation**: Use the public 101-vector set to confirm the auditor's canonicalizer implementation is correct
4. **Signature verification**: For DOs containing `signature`, verify the ECDSA P-256 signature using the Agent's public key

All verification requires no access to the Agent runtime, rule engine code, or internal enterprise systems. The auditor only needs the DO JSON files to complete all cryptographic validation.

#### 7.3.2 Audit Working Papers

The DO itself serves as audit working papers. Third-party auditors' audit procedures can reference DO fields as direct evidence:

| Audit Procedure | DO Evidence Referenced |
|-----------------|------------------------|
| "Obtain and inspect all high-severity decision records within the audit period" | Query DOs where `severity=high,critical` |
| "Verify audit chain integrity" | `audit.previous_hash` chain + independent recalculation |
| "Test effectiveness of key blocking rules" | Sample 100 DOs where `decision=DENY`, verify `matched_rules` individually |
| "Confirm operation of human oversight mechanisms" | Check fill rate of `human_oversight` and override reasons |
| "Verify rule set version matches deployment records" | Compare `rule_set_version.id` against change management system records |

#### 7.3.3 Cross-Implementation Verifiability

Third-party auditors can verify DOs using a **completely different technology stack** from the Agent runtime environment. This property is guaranteed by the public 101-vector set — the auditor first validates their JCS+SHA-256 implementation against the vector set, then uses the same implementation to verify production DOs. This eliminates the trust risk that "auditors must rely on the Agent vendor's verification tools."

### 7.4 Complementary Positioning with IETF AAT

| Dimension | ERDL Decision Object | IETF AAT |
|-----------|---------------------|----------|
| **Layer** | Decision evaluation results | Full operation logs |
| **Granularity** | when/then evaluation per Tool Call | Per Agent operation |
| **Scenario** | "Why was this operation blocked/allowed?" | "What did the Agent do?" |
| **Depth** | Deep (policies/matched_rules/evaluation details) | Broad (tool_call/delegation/error/lifecycle) |
| **Regulatory Mapping** | 12 frameworks, per-field mapping | EU AI Act + SOC 2 + ISO/PCI |

Both use identical cryptographic primitives (JCS + SHA-256 + ECDSA P-256), linked via `execution_trace_id`.

**Responsibility Boundary**: The ERDL DO records the deterministic evaluation results of the rule engine (13 decision types). The following runtime exception types fall outside the ERDL rule evaluation scope and are not covered by DO:
- **ERROR** (Agent runtime errors, e.g., LLM call failures, tool timeouts)
- **TIMEOUT** (Operation exceeded time budget)
- **FALLBACK** (Degradation/fallback decisions)

These events can be independently recorded by transport-layer or operations-layer audit protocols (e.g., IETF AAT, OpenTelemetry spans, etc.).

**Bridge Reservation**: The DO's extensions support an optional entry `referenced_transport_events` for recording reference identifiers of key transport-layer events (errors, timeouts, etc.) that occur between two consecutive DOs. Entry format:

```json
{
  "type": "referenced_transport_events",
  "events": [
    {
      "event_type": "ERROR",
      "event_id": "evt-xxxx",
      "timestamp": "2026-07-28T12:00:01.000Z",
      "summary": "LLM call to model X timed out after 30s"
    }
  ]
}
```

This entry is optional — it does not reference any specific transport-layer audit protocol, only providing a generic event reference container. Auditors can retrieve detailed records in the corresponding transport-layer audit system via `event_id`, ensuring the temporal continuity of the decision chain is not interrupted by non-decision events.

```
┌─────────────────────────────────────────┐
│         Agent Runtime                   │
│                                         │
│  Tool Call Occurs                       │
│       ↓                                 │
│  ERDL Rule Evaluation → Decision Object │  ← "Why blocked/allowed?"
│       ↓                                 │
│  Agent Executes/Rejects Tool Call       │
│       ↓                                 │
│  IETF AAT Record → Audit Record         │  ← "What did the Agent do?"
│                                         │
│  DO.execution_trace_id  ←→  AAT         │
└─────────────────────────────────────────┘
```

### 7.5 Relationship with MCP (Model Context Protocol)

MCP is the open connection standard between models and external tools/data sources (led by Anthropic, revised to stateless architecture on 2026-07-28). ERDL DO integrates with MCP through the following paths:

**Proxy Mode (Protocol-Level Interception)**: Point the MCP endpoint of dangerous Tools to an ERDL proxy. Agent calls MCP Tool → ERDL Guard intercepts → Rule evaluation (when/then) → Generate Decision Object → Allow or block. The Agent cannot bypass — it cannot reach the original MCP Tool endpoint.

**`execution_trace_id` Generation Rule**: `execution_trace_id` is independently generated by the ERDL Engine (UUID v7), serving as the globally unique identifier for this decision. The MCP 2026-07-28 revision has deprecated session IDs; request-level identifiers are managed by the Agent client itself. Auxiliary identifiers such as `mcp_request_id` can be recorded in the DO's `context` field, coexisting with `execution_trace_id` to support bidirectional traceability. `execution_trace_id` remains the authoritative primary key — all external identifiers serve only as auxiliary indexes and do not participate in JCS integrity calculation.

**MCP Tool Declaration**: ERDL rule files are exposed as MCP Tools through an MCP Server. Agents see the ERDL rule verification capability in the MCP tool list and invoke it via standard MCP protocol.

### 7.6 Relationship with A2A (Agent-to-Agent Protocol)

A2A is the Agent-to-Agent communication standard promoted by Google. ERDL DO integration paths:

**Agent Card Extension**: The Agent's A2A Agent Card declares an `erdl` extension, carrying the compliance profile and list of acceptable decision types. The counterpart Agent can understand the target Agent's rule constraints through this extension before delegating tasks.

Standard JSON structure of the `erdl` extension:
```json
{
  "extensions": {
    "erdl": {
      "spec_version": "v1.2",
      "compliance_profile": {
        "profile_id": "erdl-compliance-v1.2",
        "jurisdictions": ["EU"],
        "industries": ["financial-services"]
      },
      "supported_decisions": ["ALLOW", "DENY", "CORRECT", "REQUEST_HUMAN", "ESCALATE", "NOTIFY", "EMERGENCY_HALT", "QUARANTINE", "ROLLBACK", "WORKFLOW"],
      "guard_enabled": true,
      "verification_endpoint": "https://agent.example.com/.well-known/erdl/verify",
      "rules_hash": "sha256:a1b2c3..."
    }
  }
}
```

**Cross-Agent Audit Chain**: The DO's `decision_id` is referenced by A2A Task messages, and the DO's `execution_trace_id` links the entire A2A delegation chain. In multi-Agent scenarios, each decision node generates an independent DO, forming a cross-Agent audit chain through `audit.previous_hash`.

### 7.7 Relationship with Mainstream Agent Frameworks

ERDL DO is not bound to any specific Agent framework. The following integration modes apply to all mainstream frameworks:

| Framework | Integration Mode | DO Generation Timing |
|-----------|-----------------|----------------------|
| **OpenClaw** | NATIVE — ERDL Guard built into the tool call pipeline | DO auto-generated before each Agent tool call |
| **LangChain / LangGraph** | MIDDLEWARE — Insert ERDL Guard via ToolMiddleware | Intercept + generate DO before each Tool call |
| **CrewAI** | MIDDLEWARE — via Crew's before_tool_call hook | Same as above |
| **AutoGen** | MIDDLEWARE — via AssistantAgent's tool interception mechanism | Same as above |
| **Any MCP-enabled framework** | MCP MODE — via MCP proxy mode | Same as above |
| **Custom Agent** | SDK — Import ERDL Engine + DO Builder library | Application code invokes |

**Integration Principle**: ERDL DO does not require Agent frameworks to modify their core architecture. It only requires the framework to provide an interception point (hook / middleware / proxy) before Tool Call execution, at which the ERDL Engine performs rule evaluation and generates a DO.

**Performance Consideration**: In MIDDLEWARE and MCP MODE integration modes, each Tool Call requires an external RPC call to the ERDL Engine (single call latency approximately 2-5ms, depending on deployment topology). For latency-sensitive scenarios (e.g., high-frequency Agents), the NATIVE mode (co-located ERDL Engine in the same process) or asynchronous audit architecture (§9.4) is recommended.

### 7.8 Relationship with OpenTelemetry

ERDL audit records are output as OTLP Spans. Each rule trigger generates one Span:

```
Span: ERDL-Rule-Evaluation
  ├── decision_id: "018c4a3e-..."
  ├── result.decision: "DENY"
  ├── total_evaluated: 1
  ├── total_matched: 1
  └── parentSpanId: ← execution_trace_id mapping
```

Cross-Agent audit chains are mapped via `execution_trace_id` → OTLP `parentSpanId`. Compatible with existing APM and observability infrastructure.

### 7.9 Audit Report Output Format

The ERDL Decision Object audit lifecycle consists of three phases: **Generation → Storage → Reporting**. The DO is the on-chain raw evidence; the audit report is a structured query result over the DO stream.

#### 7.9.1 Audit Query Interface

Compliance auditors query the DO repository through a standard REST API to obtain structured audit reports:

```
GET /api/audit/decisions?from=2026-07-01&to=2026-07-27
  &jurisdiction=EU
  &decision=DENY,REQUEST_HUMAN
  &severity=high,critical
  &agent_id=agent-001
```

Supported query dimensions:

| Dimension | Field | Audit Purpose |
|-----------|-------|---------------|
| Time range | `timestamp` | Audit period definition |
| Jurisdiction | `compliance_profile.jurisdictions` | Regulatory coverage confirmation |
| Decision type | `result.decision` | Block/allow statistics |
| Severity | `result.severity` | Risk event localization |
| Action taken | `result.action_taken` | Consequence statistics (blocked/halted/escalated) |
| Agent | `agent.id` | Behavior attribution |
| Tool | `context.tool.name` | Operation auditing |
| Rule | `evaluation.matched_rules[].rule_id` | Rule trigger tracing |
| Human oversight | `human_oversight.status` | Human intervention confirmation |

Semantic query example — "Query all blocked operations":
```
GET /api/audit/decisions?from=2026-07-01&to=2026-07-27
  &action_taken=blocked,halted,quarantined,rolled_back
```

Semantic query example — "Query all operations requiring human intervention that are not yet handled":
```
GET /api/audit/decisions?from=2026-07-01&to=2026-07-27
  &human_oversight_status=pending
```

#### 7.9.2 Standard Audit Report Format

```json
{
  "report_type": "ERDL-Audit-Report-v1.2",
  "report_id": "018c4a3e-0000-7000-8000-000000000099",
  "generated_at": "2026-07-27T15:00:00.000Z",
  "query": {
    "from": "2026-07-01T00:00:00.000Z",
    "to": "2026-07-27T23:59:59.999Z",
    "jurisdiction": "EU",
    "decisions": ["DENY", "REQUEST_HUMAN"]
  },
  "summary": {
    "total_decisions": 1247,
    "by_decision": {
      "ALLOW": 892,
      "DENY": 203,
      "CORRECT": 87,
      "REQUEST_HUMAN": 42,
      "NOTIFY": 15,
      "ESCALATE": 5,
      "EMERGENCY_HALT": 2,
      "WORKFLOW": 1
    },
    "by_severity": {
      "none": 892,
      "low": 15,
      "medium": 134,
      "high": 203,
      "critical": 3
    },
    "by_agent": {
      "agent-001": 623,
      "agent-002": 624
    },
    "by_tool": {
      "exec": 312,
      "write_file": 285,
      "read_file": 410,
      "web_search": 240
    },
    "human_oversight_events": 42,
    "chain_integrity_alerts": 0,
    "first_decision_timestamp": "2026-07-01T00:03:12.000Z",
    "last_decision_timestamp": "2026-07-27T23:58:45.000Z",
    "chain_verified": true
  },
  "compliance_profile_applied": {
    "profile_id": "erdl-compliance-v1.2",
    "jurisdictions": ["EU"],
    "industries": ["financial-services"],
    "activated_fields": ["model_id", "impact_assessment_id", "agent.known_limitations", "human_oversight"]
  },
  "high_severity_decisions": [
    {
      "decision_id": "018c4a3e-0001-7000-8000-000000000001",
      "timestamp": "2026-07-27T14:00:00.000Z",
      "agent_id": "agent-001",
      "decision": "DENY",
      "severity": "high",
      "tool": "exec",
      "rule_triggered": "FIN-SEC-001",
      "reason": "exec blocked by financial security policy"
    }
  ],
  "chain_integrity": {
    "verified": true,
    "total_records_checked": 1247,
    "chain_breaks": 0,
    "first_hash": "sha256:abc...",
    "last_hash": "sha256:xyz..."
  }
}
```

#### 7.9.3 Compliance-Ready Declaration

The audit report can serve as direct input for regulatory review. The report itself proves completeness through the `report_id` + `generated_at` + `chain_integrity` triple.

**`chain_verified` Verification Method**: The audit system traverses every DO on the chain, verifying the `audit.previous_hash` → `audit.hash` link, and marks `true` only when all match. A regulator can independently verify as follows:
1. Request the complete JSON of any DO on the chain
2. Use the five-step verification method (§13.3) to recalculate the DO's `audit.hash`
3. Compare the recalculated result against the stored value on the chain
4. Trace back the `previous_hash` chain to `first_hash`

Tampering with any single DO will cause all subsequent DOs' `audit.hash` to mismatch, setting `chain_verified` to `false` and marking the break position.

The report supports output in the following formats:
- **JSON** — Machine-readable (API / CI/CD integration)
- **CSV** — Tabular audit (Excel / audit tool import)
- **SARIF** — Static Analysis Results Interchange Format (GitHub Code Scanning compatible)
- **PDF** — Stamped delivery (rendered via template engine)

#### 7.9.4 SIEM/SOAR Integration

Audit reports support export in OCSF (Open Cybersecurity Schema Framework) format, compatible with SIEM systems such as Splunk, Elastic, and Microsoft Sentinel. Core field mapping:

| DO Field | OCSF Field | OCSF Type |
|----------|-----------|-----------|
| `decision_id` | `metadata.uid` | string |
| `timestamp` | `time` | timestamp_t |
| `result.decision` | `finding_info.title` | string |
| `result.severity` | `severity_id` | integer (0-5) |
| `result.reason` | `finding_info.desc` | string |
| `agent.id` | `device.uid` | string |
| `context.tool.name` | `unmapped.action_name` | string |
| `evaluation.matched_rules[].rule_id` | `finding_info.uid` | string |
| `human_oversight.status` | `status_detail` | string |
| `audit.hash` | `metadata.correlation_uid` | string |

When `result.decision` is `DENY`/`EMERGENCY_HALT`/`QUARANTINE`, a SOAR playbook is automatically triggered. The OCSF `activity_id` maps to `3` (Deny) or `5` (Block) to trigger SIEM alert rules.

---

## 8. Privacy and Data Minimization Design

**Scenario: Coexistence of GDPR Right to Erasure and Tamper-Proof Hash Chain**

GDPR Article 17 grants data subjects the right to delete their personal data. However, the Decision Object is solidified via hash chains — if a DO's `context` contains user PII, direct deletion would break the entire hash chain.

**v1.2 Hot/Cold Separation Scheme**:

```
┌─────────────────────────────────────────────────┐
│ Audit Chain (Immutable)                         │
│                                                 │
│  DO: { context_snapshot_hash: "sha256:abc..." }  │  ← Hash only
│  DO: { context_snapshot_hash: "sha256:def..." }  │
│  DO: { sanitized_context: "tool=exec, args=<PII>" }│ ← Sanitized version
│                                                 │
└──────────────┬──────────────────────────────────┘
               │ Indexed by context_snapshot_hash
               ▼
┌─────────────────────────────────────────────────┐
│ Cold Storage (Physically Deletable)              │
│                                                 │
│  DO-001.context.raw → User Zhang San, CC 1234... │  ← Original PII
│                                                 │
│  GDPR deletion request → Delete original in cold storage │
│  Audit chain unchanged → context_snapshot_hash still verifiable │
│  Regulatory review → Key semantics via sanitized_context   │
└─────────────────────────────────────────────────┘
```

**Core Principles**:
1. Audit chain stores only Hashes — no raw PII
2. Original Context falls into cold storage — supports physical deletion
3. GDPR deletion = Delete original records in cold storage
4. Cold storage retention policy follows each jurisdiction's statutory minimum retention period
5. The boundary between hot/cold storage is defined by the `context_snapshot_hash` and `sanitized_context` fields

**Storage Layer Behavior Contract (for cold storage implementers)**:

ERDL does not prescribe specific cold storage implementations (S3 Glacier, Azure Cool Blob, local tape, etc. are all acceptable), but requires the cold storage layer to satisfy the following behavior contract to ensure audit chain integrity:

1. **Write Immutability**: Records in cold storage cannot be modified once written. Any "update" operation MUST generate a new version record, linking to the original record via `previous_hash`.
2. **Read Verification**: Cold storage SHOULD support retrieval of the complete DO record via `audit.hash`, and SHOULD attach the SHA-256 checksum from storage time when returning, to detect silent data corruption.
3. **Retention Period Governance**: Cold storage MUST maintain a `retention_until` timestamp for each record (calculated based on jurisdiction statutory minimum retention period); physical deletion is forbidden before expiration. Deleted records MUST retain a deletion log at the storage layer (record ID + deletion time + operator).
4. **Storage Location Traceability**: Each cold record SHOULD record its storage location (URI, ARN, or physical archive number), so auditors can locate the corresponding original data in the DO's `context` or extensions.

> The above contract does not prescribe specific CRUD APIs — storage vendors may freely implement within the behavioral constraints. Core requirements: no tampering after write, verifiable on read, no deletion before expiration, logging on deletion.

---

## 9. Regulatory Versioning and Upgrade Path (including Async Audit Architecture, Dual Hashing Transition, Storage Optimization)

### 9.1 Incremental Upgrade (Regulatory Update, No Field Changes)

Using the EU AI Act compliance deadline postponement from 2026-08-02 to 2027-12-02 as an example:

1. Update the `effective_date` and `amended_by` of the EU AI Act entry in `compliance_profile.regulatory_references`
2. Recalculate `compliance_profile.profile_hash`
3. `profile_hash` participates in JCS serialization → `audit.hash` changes
4. All subsequent DOs on the audit chain have their `audit.previous_hash` pointing to the new `audit.hash`

Audit value: Regulators can precisely trace "when the compliance configuration changed."

### 9.2 Structural Upgrade (New Regulations Require New Fields)

Do not add fields to CORE or JURISDICTION. Carry them through self-describing entries in the extensions zone:

```json
"extensions": [
  {
    "id": "eu-ai-act-2027-amendment-carbon",
    "regulatory_ref": { "framework": "EU-AI-Act", "version": "2027-Amendment-Art-12b", "effective_date": "2027-12-02" },
    "schema_ref": "sha256:...",
    "field": { "name": "carbon_footprint_kg", "type": "number:string", "description": "..." },
    "value": "0.042"
  }
]
```

**Core advantage**: Extension entries directly participate in the main JCS serialization. Any compliance requirement change — whether adding new fields or modifying existing ones — is directly reflected in `audit.hash`, ensuring audit chain integrity is guaranteed by cryptography.

### 9.3 Cross-Version Audit Chain Anchoring (v1.1 → v1.2)

`audit.previous_hash` is merely a string reference pointing to the previous DO's final `audit.hash` value — it does not participate in "JCS serialization of the referenced record." The first v1.2 DO's `audit.previous_hash` can directly be set to the last v1.1 DO's `audit.hash` value; the evidence chain is not broken by this.

### 9.4 Asynchronous Audit Architecture (Performance Engineering Guide)

v1.2 DO generation requires execution of: 1× extensions JCS + SHA-256, 1× main object JCS + SHA-256, optional 1× ECDSA P-256 signature. The complete set of cryptographic operations takes approximately 2-5ms (Node.js, V8 optimized) to 25ms (Python/GIL). For high-frequency Agents handling 100+ Tool Calls per second, an asynchronous audit architecture is recommended:

```
Agent Main Thread                Audit Worker Cluster
    │                               │
    ├─ Generate DO plain JSON ──────→ Push to message queue (Kafka/Redis Stream)
    │  (<1ms)                        │
    │                          ┌────┴────┐
    │                          │ Deep Clone│
    │                          │ JCS ext  │
    │                          │ SHA-256  │
    │                          │ JCS core │
    │                          │ SHA-256  │
    │                          │ ECDSA P-256│
    │                          └────┬────┘
    │                               │
    │                          ┌────┴────┐
    │                          │ Write to │
    │                          │ Immutable│
    │                          │ Store(WORM)│
    │                          └─────────┘
```

The Agent main thread only generates the DO plain JSON and pushes it to an in-memory queue; a sidecar Audit Worker cluster asynchronously performs cryptographic operations and persistence. This architecture reduces the DO generation latency impact on the Agent main flow to <1ms.

### 9.5 Storage Optimization Guide

- **Online hot queries**: Use Elasticsearch/ClickHouse to store parsed structured fields (such as decision, severity, timestamp) for real-time monitoring and rapid retrieval
- **Cold archive storage**: DO JSON used for tamper-proof verification can be archived after Brotli or Zstandard compression (saving 60%+ storage costs). Compression does not affect JCS verification — decompress first, then recalculate `audit.hash`
- **Compliance retention**: See §8 for minimum statutory retention periods per jurisdiction (Hot/Cold Separation Architecture)

### 9.6 Dual Hashing Transition Scheme (Cryptographic Evolution)

When SHA-256 is marked as Legacy (but not Deprecated) in the future (e.g., 2035), transition-period DOs' `audit` objects should simultaneously contain both old and new hashes:

```json
"audit": {
  "hash_sha256": "sha256:...",
  "hash_sha512": "sha512:...",
  "previous_hash": null,
  "commitment": "..."
}
```

- **During transition**: Validators MUST verify all existing hash values. Both passing → highest security level
- **After SHA-256 full deprecation**: Remove the `hash_sha256` field (as a deprecated field following §12 Deprecation governance principles)

---

---

## Part III: Governance and Evolution

## 10. Long-Term Maintenance and Compliance Evolution

### 10.1 CORE Field Freeze Guarantee

```
┌──────────────────────────────────────────────────────────┐
│                    Decision Object                       │
│                                                          │
│  ┌─────────────────────────────┐                         │
│  │      CORE (14 fields)       │  ← Permanently frozen    │
│  │      Never modified          │  Participates in main JCS│
│  └─────────────┬───────────────┘                         │
│                │                                          │
│  ┌─────────────┴───────────────┐                         │
│  │   JURISDICTION (10 fields)  │  ← Activated per jurisdiction│
│  │     Controlled by activated_fields│  Participates in main JCS│
│  │     Omit rules apply        │                         │
│  └─────────────┬───────────────┘                         │
│                │                                          │
│           JCS(core + jurisdiction)                        │
│                │                                          │
│  ┌─────────────┴───────────────┐                         │
│  │   EXTENSIONS (open-ended)   │  ← Independent self-describing│
│  │     Each entry carries schema_ref│  Directly participates in main JCS, preserves full semantics│
│  │     Directly participates in main JCS   │  MUST NOT be modified by ERDL itself    │
│  └─────────────┬───────────────┘                         │
│                │                                          │
│           JCS(core + jurisdiction + extensions)           │
│                │                                          │
│  ┌─────────────┴───────────────┐                         │
│  │  audit.hash = SHA-256(      │                         │
│  │    JCS(core + jurisdiction  │                         │
│  │      + extensions)           │                         │
│  │    ↑ extensions directly     │                         │
│  │      participate in         │                         │
│  │      JCS serialization      │                         │
│  │  )                          │                         │
│  └─────────────────────────────┘                         │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Long-Term Evolution Guarantee

| Year | Event | Impact on DO | Validator Behavior |
|------|-------|-------------|--------------------|
| 2026 | v1.2 released | CORE 14 + JURISDICTION 10 released | Full validation |
| 2028 | New EU AI Act Amendment requires carbon footprint recording | Append entry to extensions zone | audit.hash automatically covers new fields |
| 2030 | Quantum computing threatens SHA-256 | Activate dual-hash transition scheme | See §9.6 |
| 2032 | New international treaty requires Agent decision records to include human rights impact assessment | Append entry to extensions zone | audit.hash automatically covers all fields |

---

## 11. Extension Zone Self-Describing Design

### 11.1 Entry Structure

```json
{
  "extensions": [
    {
      "id": "eu-ai-act-2027-amendment-carbon",
      "regulatory_ref": {
        "framework": "EU-AI-Act",
        "version": "2027-Amendment-Art-12b",
        "effective_date": "2027-12-02"
      },
      "schema_ref": "sha256:e3f5a7b9c1d2...",
      "field": {
        "name": "carbon_footprint_kg",
        "type": "number:string",
        "description": "One-time carbon footprint of this AI decision in kg CO2e"
      },
      "value": "0.042"
    }
  ]
}
```

### 11.2 Content-Addressable Mechanism of `schema_ref`

`schema_ref` is a JCS+SHA-256 hash pointing to the complete schema definition document for that field:

```json
{
  "id": "eu-ai-act-2027-amendment-carbon",
  "schema_version": "2027-03-15",
  "field_name": "carbon_footprint_kg",
  "type": "number:string",
  "format": "Decimal string with up to 6 decimal places",
  "value_domain": ">= 0",
  "source": "EU AI Act 2027 Amendment, Article 12b",
  "contact": "eu-ai-office@ec.europa.eu",
  "example": "0.042"
}
```

**Long-term applicability**: An auditor does not need to depend on the ERDL committee's continued existence. As long as the hash value `sha256:e3f5a7b9c1d2...` can be retrieved from any content-addressable network (IPFS, Git, object storage, regulatory archive system) to the corresponding schema document, the semantics of the `carbon_footprint_kg` field can be fully understood.

> ⚠️ **Security Constraint**: Verifiers/audit tools MUST NOT automatically initiate external network fetches for schema resolution during verification. `schema_ref` resolution MUST follow an offline-first principle: (1) use a locally preloaded allowlist schema library; (2) if external retrieval is required, the target address must be in a configured allowlist; (3) response payload MUST NOT exceed 1MB. Automatic fetch of arbitrary URLs is an SSRF attack surface and MUST be disabled in production verification paths.
>
> **Local Cache and Expiration Strategy**: Content-addressable network (IPFS, Git, etc.) availability does not constitute a cryptographic guarantee. To ensure schemas remain resolvable within statutory periods, it is recommended: (a) validators pre-load a complete schema cache copy at deployment time (including mappings for all known schema_ref); (b) cache entries carry a `last_fetched` timestamp and `valid_until` expiration — expired entries trigger background refresh rather than blocking verification; (c) if a `schema_ref` is missing from cache and the external network is unreachable, the validator SHOULD mark that extension field as `semantics_unresolved` but MUST NOT block the entire DO's hash verification — hash correctness does not depend on schema resolution.

---

## 12. Field Governance Principles

### 12.1 Append-Only Schema

- **CORE fields**: Permanently frozen. Unless a cryptographic security vulnerability is discovered, they will never be modified, deleted, or reordered
- **JURISDICTION fields**: Can be added (with new regulations), but existing fields are never deleted
- **Deprecation**: When a field is no longer required by any regulation, it is marked as `deprecated`. The validator's tolerant mode: deprecated field present → normal verification; absent → no error
- **extensions**: Open-ended; new entries can be appended at any time

### 12.2 Invariants

The following invariants remain unchanged in any future version, ensuring all historical DOs can be verified by any version of the validator:

1. `spec` is always `"decision-object-v1.0"` (version differentiation is achieved through `compliance_profile.profile_id`, e.g., `"erdl-compliance-v1.2"`)
2. `audit.hash` always uses the flat hashing formula (JCS(core+jurisdiction+extensions) → SHA-256)
3. Cryptographic primitives: JCS (RFC 8785) + SHA-256 (FIPS 180-4) (parameterized: future stronger hash algorithms can be configured, but SHA-256 remains supported as default)
4. The basic flow of the five-step verification method (delete audit.hash/signature/signing_key_id, JCS+SHA-256 all fields, compare stored hash)

### 12.3 Governance Lifecycle

```
[Proposal] → [RFC] → [Community Review ≥ 30 days] → [Adoption] → [Stable] → [Deprecated]
                                                                               ↓
                                                                       [Retained Forever]
```

---

## Part IV: Verification and Appendices

---

## 13. Vector Set and Cross-Implementation Verification

### 13.1 Verification Principle

> **Given the same rule set and context, any conformant ERDL implementation MUST produce byte-identical Decision Objects.**

Neutrality is tested, not declared.

### 13.2 Vector Set Scale

| Category | Count | Description |
|----------|:---:|-------------|
| Static Decision Vectors | 63 | 13 external decision types (10 from v1.1 + NOTIFY/ROLLBACK/QUARANTINE + 3 WORKFLOW) + 13 operators fully covered + null propagation/type safety/rate limiting edge cases exhausted |
| Dynamic Decision Vectors | 26 | Temporal(10) + Seeded(8) + Stateful(8) |
| Audit Hash Vectors | 12 | AV-001~AV-008 + 4 new (CORRECT/NOTIFY/ROLLBACK/WORKFLOW) |
| **Total** | **101** | |

**DELEGATE Decision Type**:
- SPEC v1.1 §3.4 already defined DELEGATE as a Ring 2 decision type
- DELEGATE is formally included in the v1.2 SPEC as an independent decision type (`result.decision: "DELEGATE"`); the DELEGATE decision vector (DO-064) and audit vector (AV-013) are reserved for v1.3

**Vector Growth Rate Explanation**: v1.2's 101 vectors have exhausted all boundary behaviors of the 13 operators (null propagation, strict type matching, ReDoS protection, rate limiting, string/object comparison). Future versions will only append vectors under the following conditions: (a) SPEC adds new decision types, (b) SPEC adds new operators, (c) undiscovered edge behaviors are identified. The vector set scale is independent of the number of rule files — an Agent with 200 rules and one with 10,000 rules use the same 101-vector DO validation set.

### 13.3 Five-Step Verification Method

**Pre-Principle**: After extracting the `claimed_hash`, the validator MUST perform a Deep Clone of the DO. All subsequent physical deletion operations (pop/delete) MUST be performed on the clone; the original DO in-memory instance MUST NOT be polluted.

> **Schema trimming is already completed by the DO generator**: Per §5.4, the DO has already undergone Schema trimming at construction time — JURISDICTION fields not declared in `activated_fields` have been physically removed (Omit) from the DO object. The five-step verification method receives an already-trimmed DO and does not repeat the trimming operation. If the generator did not trim correctly, `audit.hash` will contain fields that should not exist and will mismatch the reference value, which will be automatically detected by Step 5.

```
Step 1: Deep clone the decision_object
Step 2: Physically delete self-referencing / external fields
        DELETE audit.hash + DELETE signature + DELETE signing_key_id
        (extensions preserved, participating in subsequent JCS)
Step 3: JCS(CORE + JURISDICTION + EXTENSIONS) → canonical bytes
Step 4: SHA-256 (FIPS 180-4) → recomputed hash
Step 5: Compare recomputed hash with stored audit.hash
```

### 13.4 Stale Regression Vector

The vector set's 12 audit hash vectors include a deliberately stale canary vector: its `canonical_bytes` are identical to another valid vector, but its `audit.hash` retains the old version's hash value. Any runner that recalculates JCS+SHA-256 from first principles will detect a MISMATCH — shorthand runners (that only compare pre-computed hashes without recalculating) will be exposed.

> Validators MUST NOT special-case this vector by hardcoding vector IDs. All 12 audit vectors MUST go through the same five-step verification process.

### 13.5 Compatibility Levels

| Level | Requirement | Vector Count |
|:---:|-------------|:---:|
| L1 Basic | All v1.0 vectors | 28 |
| L2 Verified | All v1.1 vectors | 45 |
| L3 Full | All v1.2 101 vectors (including WORKFLOW series; DELEGATE reserved for v1.3; null/type/rate edges exhausted) | 101 |

---

## 14. Request for Comments

This whitepaper is a Request for Comments (RFC). We welcome feedback from experts in the following areas:

1. **End-to-End JCS + Flat Hashing**: `policies[].hash` uses JCS + SHA-256, and `audit.hash` uses the flat hashing formula. Can this scheme be correctly reproduced in all mainstream languages?
2. **Jurisdiction Activation Mechanism**: `compliance_profile.activated_fields` + Schema trimming rules (Omit vs null). Does this design meet multi-jurisdiction deployment compliance needs?
3. **Audit Hash Regression Detection**: The vector set includes regression vectors retaining old version hash values, for detecting validator implementations that skip independent hash recalculation. Is this design sound?
4. **Flat Hashing Extensibility**: Under the extensions self-describing design + append-only governance principle, is the extension zone's content integrity sufficiently guaranteed?
5. **IETF AAT Alignment**: ERDL DO and AAT share cryptographic primitives. Is `execution_trace_id` sufficient as a cross-format bridge key?
6. **Compliance Substrate**: Can `compliance_profile` be viewed as an effective implementation of the compliance substrate model?

## Appendix B: Reference Standards

- RFC 8785 — JSON Canonicalization Scheme (JCS)
- RFC 9562 — UUID (v4/v7)
- FIPS 186-5 — Digital Signature Standard (ECDSA P-256)
- FIPS 180-4 — Secure Hash Standard (SHA-256)
- draft-sharif-agent-audit-trail-00 — Agent Audit Trail (IETF, 2026-03-29)
- EU AI Act — Regulation (EU) 2024/1689
- NIST AI 100-1 — AI Risk Management Framework 1.0 (2023-01-26)
- COSO — Achieving Effective Internal Control Over Generative AI (2026-02-23)
- ISO/IEC 42001:2023 — AI Management System
- GB/Z 185-2026 — Artificial Intelligence Agent Interconnection (7 Parts, 2026-05-22)
- OWASP Top 10 for Agentic Applications (2026)
- Colorado SB 24-205 — Consumer Protections for AI (2026-06-30)
- Singapore MGF for Agentic AI (2026-01-22)
- CAICT — Trusted AI Agent Assessment Framework 2.0 (2026-04-15)

---

> *"Deterministic architecture, not prompt engineering. Neutrality is tested, not declared."*
>
> -- OpenOBA · 2026.07.27 · ERDL Decision Object v1.2 Request for Comments (Draft 3)
