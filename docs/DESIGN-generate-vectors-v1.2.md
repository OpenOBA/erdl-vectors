# DESIGN: generate-vectors.cjs �?v1.3 向量生成器设�?
> Copyright © 2026 唐启�?(Tang Qixin). All rights reserved.

> 版本: 2.1 · 2026-07-29
> 状�? Released
> 权威�? SPEC v1.1 §3.4 + 白皮�?Draft 4 §13
> 策略: v1.2 �?v1.3 升级（含第三方审计修复）

---

## 0. 策略说明

### 为什么不继承 v1.0/v1.1�?
1. **v1.2 是破坏性变�?* �?`policies[].hash` 升级�?JCS，`rule_set_version` 参与 JCS，平面哈希改变了 `audit.hash` 公式。直接升级旧向量再重算的复杂度和从零构建一样�?2. **v1.1 向量覆盖不完�?* �?37 �?DO 只覆�?7/13 种决策类型，运算符测试分散在 all-operators 类别中但不系统�?3. **新版应自证完整�?* �?63 条静态向量应有明确的映射表证明每种决策类�?× 每种运算符都被覆盖�?
### �?v1.0/v1.1 继承什�?
**不继承数据，但继承技术陷阱的经验�?* v1.0/v1.1 的独立审计报告（2026-07-27）暴露了 10 个技术陷�?+ 4 条额外约束。详�?`DESIGN-vector-inventory-v1.2.md` Part A。关键要求：

- T1: 生成脚本必须端到端可复现（单一入口，禁止手动编�?JSON�?- T2: 禁止内部状态字段（`__placeholder` 等）泄漏到输�?�?`stripInternalFields()` 最终过�?- T3: description 与实际内容自动校�?�?`validateVectorSet()` 自检
- T4: AV-008 �?vector_ref 指向真实存在�?ID（`AV-003`，非�?ID�?- T5: 彻底移除 `expected_sha256` 答案密钥
- T9: 严格遵守 `delete obj.field` 而非 `obj.field = null`（JCS: Omit over Null�?
**继承测试场景的设计模�?*（不继承具体数据）：v1.0/v1.1 �?security-baseline、compliance-workflow、ring-0-precedence、all-operators 等场景类别在 v1.2 中得到保留和扩展�?
### 参考架�?
架构模式参�?v1.1 `generate-vectors.cjs` 的干净设计�?- 单一 `.cjs` 文件，`node generate-vectors.cjs` 一键运�?- 依赖 `json-canonicalize` (npm) 进行 JCS 序列�?- 输出 `decision-object-vectors-v1.2.json`

**不参�?*：v1.1 的向量数据内容（规则定义、context、expected 值）�?全部从零编写�?
### 关联文档

- **向量完整清单**: `DESIGN-vector-inventory-v1.2.md` �?63 �?DO + 26 条动�?+ 12 �?AV 的逐条定义
- **技术陷阱继�?*: 同上，Part A

---

## 1. 向量规模（权威源：白皮书 §13.2�?
```
静态决策向�?   63 �?   13 种决策类�?x 5-6 种代表性场�?动态决策向�?   26 �?   Temporal(10) + Seeded(8) + Stateful(8)
审计哈希向量    12 �?   AV-001~AV-008 + AV-009~AV-012
─────────────────────
总计           101 �?```

**DELEGATE 预留**: DO-064 �?AV-013 预留�?v1.3（参考实现引擎未完成），在输�?JSON 中以 `reserved_vectors` 字段声明，不生成具体内容�?
---

## 2. 决策类型清单（权威源：SPEC v1.1 §3.4 + 白皮�?§13.2�?
SPEC v1.1 定义�?13 �?*外部可见**决策类型�?
| # | 决策类型 | Ring | v1.1 规范状�?| v1.2 向量覆盖 |
|---|---------|:---:|-------------|:---:|
| 1 | ALLOW | 3 | �?已实�?| �?|
| 2 | DENY | 0 | �?已实�?| �?|
| 3 | CORRECT | 3 | �?已实�?| �?|
| 4 | REQUEST_HUMAN | 2 | �?已实�?| �?|
| 5 | ESCALATE | 2 | �?已实�?| �?|
| 6 | NOTIFY | 3 | �?SPEC 定义 | �?|
| 7 | EMERGENCY_HALT | 0 | �?已实�?| �?|
| 8 | QUARANTINE | 1 | �?SPEC 定义 | �?|
| 9 | ROLLBACK | 1 | �?SPEC 定义 | �?|
| 10 | WORKFLOW | 3 | �?SPEC 定义 | �?|
| 11 | WORKFLOW_WAITING | 3 | �?SPEC 定义 | �?|
| 12 | WORKFLOW_PROGRESS | 3 | �?SPEC 定义 | �?|
| 13 | PASS | �?| 引擎内部（无规则命中�?| �?|
| (14) | DELEGATE | 2 | �?SPEC 定义 | 预留 v1.3 |

> PASS: 虽然 SPEC 未将其列�?外部决策类型"，但向量集需要验�?无规则命中时 DO 仍正确生�?的场景，PASS 作为事实上的�?13 �?DO 结果类型�?
### 四种内部推理动作（不进入 DO�?
`STRATEGIZE` / `AUDIT` / `CALCULATE` / `VALIDATE` �?仅在 Agent 内部使用，不生成 Decision Object。向量集不覆盖�?
---

## 3. 63 条静态向量的分配方案

分配基于向量清单（`DESIGN-vector-inventory-v1.2.md` Part B），按决策类型统计：

| 决策类型 | 向量�?| 主要 DO 编号 | 覆盖场景 |
|---------|:---:|------------|------|
| ALLOW | 12 | DO-011,012,020,024,026,030,041~043,046~048 | 放行 + override安全方向 + override不安全方�?+ unless豁免 + in/not_in/contains/lte/starts_with/ends_with + metadata fallback |
| DENY | 10 | DO-001,003,005,008,010,025,044,049,061,063 | 安全拦截 + 危险命令 + 关键系统 + �?优先 + 严重性升�?+ unless未豁�?+ ReDoS + exists真�?+ 对象深层比较 + 整数安全范围 |
| PASS | 10 | DO-002,004,006,007,014,027~029,050,062 | 规则选择性匹�?+ 安全命令通过 + 规则集版�?+ 空规则集 + 上下文差�?+ null安全(neq/eq) + 严格类型 + exists缺失 + 空扩展规范化 |
| REQUEST_HUMAN | 4 | DO-013,015,016,045 | PII审批 + 非工作时�?+ HIPAA医疗 + 高风险评�?|
| NOTIFY | 4 | DO-031~034 | 异常通知 + 操作审计 + 阈值预�?+ 伴随DENY |
| WORKFLOW | 4 | DO-051~054 | 多步�?+ 条件分支 + 审批节点 + 完成 |
| ESCALATE | 3 | DO-017~019 | 低信誉Agent + 跨域 + 未知工具 |
| CORRECT | 3 | DO-021~023 | 大小写纠�?+ 单位转换 + 路径规范�?|
| QUARANTINE | 3 | DO-035~037 | 可疑文件 + 异常模式 + 速率限制 |
| ROLLBACK | 3 | DO-038~040 | 快照回滚 + 部分失败 + 交易回退 |
| WORKFLOW_WAITING | 3 | DO-055~057 | 等待人类审批 + 等待时间窗口 + 等待前置任务 |
| WORKFLOW_PROGRESS | 3 | DO-058~060 | 步骤推进 + 阶段完成 + 最终步�?|
| EMERGENCY_HALT | 1 | DO-009 | �?紧急终止（短路所有评�?+ 全局生效�?|
| **总计** | **63** | DO-001~DO-063 | |

> 注：运算符覆盖（13 种）系统性地分布�?DO-041~050 区间，边缘穷尽（7 种）分布�?DO-027~029、DO-044、DO-049、DO-061~063。两者都已经计入上述决策类型的分配中，不是独立的 8 条�?
### 运算符覆盖映射（13 运算�?�?DO 编号�?
```
eq       �?DO-001 (DENY: tool.name = "exec")
neq      �?DO-027 (PASS: context.field != "value" on missing field �?null-safe)
gt       �?DO-045 (REQUEST_HUMAN: risk_score > 80)
gte      �?DO-045 同上
lt       �?DO-046 (ALLOW: risk_score < 50)
lte      �?DO-046 同上
in       �?DO-041 (ALLOW: tool.name in ["read","search","list"])
not_in   �?DO-042 (ALLOW: tool.name not_in ["exec","write","delete"])
contains �?DO-043 (ALLOW: file_content contains "SAFE_MARKER")
matches  �?DO-044 (DENY: 恶意正则可疑输入 �?ReDoS 防护测试)
starts_with �?DO-047 (ALLOW: tool.name starts_with "safe_")
ends_with   �?DO-048 (ALLOW: file_name ends_with ".log")
exists   �?DO-049 (DENY: context.high_risk_flag exists and is true)
  +      �?DO-050 (PASS: context.high_risk_flag 不存�?�?不触�?
```

---

## 4. v1.3 元数据注�?
每条 DO 在生成后必须注入以下字段才能计算 `audit.hash`�?*v1.3 特别要求**：`audit` 对象必须包含三个字段——`hash`、`previous_hash`、`commitment`�?
### 4.1 常量填充（全激活模式）

向量集验证全功能兼容性，故使用全激活模式——所�?JURISDICTION 字段都填充常量值：

| 字段 | 常量�?| 来源 |
|------|--------|------|
| `spec` | `"decision-object-v1.0"` | 白皮�?§12.2 不变�?#1 |
| `compliance_profile` | �?4.2 | 白皮�?§5.2 |
| `execution_trace_id` | 每条 DO 独立 UUID v7 (RFC 9562, 确定�? | 白皮�?§7.4 |
| `evaluation_duration_ms` | `12` | 常量 |
| `agent.id` | `"did:erdl:sha256:test-runner-v1.2"` | �?|
| `agent.role` | `"guardian"` | �?|
| `agent.version` | `"v1.2.0"` | �?|
| `agent.aid` | `"91110108MA12345678A00000001E"` | 白皮�?附录 A |
| `agent.known_limitations` | `["This is a test runner; does not perform real operations","Timeout after 30s for contexts >10KB"]` | 白皮�?附录 A |
| `agent.tool_registry_hash` | `"sha256:0000000000000000000000000000000000000000000000000000000000000000"` | 虚拟 |
| `agent.algorithm_filing_no` | `"NET-2026-000000"` | 虚拟 |
| `agent.model_registration_id` | `"MR-2026-000000"` | 虚拟 |
| `model_id` | `"test-model-v1.2"` | �?|
| `confidence_score` | `95` | 固定（整数，表示 95%�?|
| `fairness_assessment` | `"not_applicable"` | 测试场景 |
| `impact_assessment_id` | `"018c4a3e-0009-7000-8000-000000000009"` | 固定 UUID |
| `data_modification_expected` | `false` | �?|
| `autonomy_level` | `"L2"` | �?|
| `context_snapshot_hash` | `"sha256:0000000000000000000000000000000000000000000000000000000000000000"` | 虚拟 |
| `sanitized_context` | `null` | �?PII |
| `signature` | `"TEST_SIGNATURE_BASE64URL_PLACEHOLDER"` | 测试占位 |
| `signing_key_id` | `"key-v1-test-2026-07"` | 测试密钥 |
| `extensions` | `[]` | 空数组（直接参与�?JCS，平面哈希架构） |
| `rule_set_version.id` | SHA-256(JCS(policies)) | 每条 DO 独立计算 |
| `rule_set_version.timestamp` | `"2026-07-28T00:00:00.000Z"` | 固定 |

### 4.2 compliance_profile（全激活模式）

```json
{
  "compliance_profile": {
    "profile_id": "erdl-compliance-v1.2",
    "profile_hash": "toBeComputed",
    "jurisdictions": ["EU", "CN", "US", "SG"],
    "industries": ["financial-services"],
    "risk_level": "high",
    "activated_fields": [
      "model_id", "impact_assessment_id", "agent.known_limitations",
      "agent.aid", "agent.tool_registry_hash", "confidence_score",
      "fairness_assessment", "data_modification_expected",
      "autonomy_level", "context_snapshot_hash", "sanitized_context", "signature"
    ],
    "regulatory_references": [
      { "framework": "EU-AI-Act", "version": "Regulation-2024-1689", "amended_by": "Digital-Omnibus-2026", "jurisdiction": "EU", "effective_date": "2027-12-02" },
      { "framework": "GB-Z-185-2026", "version": "2026-05-22", "jurisdiction": "CN" },
      { "framework": "NIST-AI-RMF", "version": "1.0", "jurisdiction": "US" },
      { "framework": "COSO-GenAI", "version": "2026", "jurisdiction": "ALL" }
    ]
  }
}
```

**�?*: `human_oversight` �?CORE #13，不�?`activated_fields` 中。所�?DO 必然携带，无需激活�?
---

## 5. 平面哈希计算流程

对应白皮�?§3.3 的定义，在生成器中按以下顺序执行�?
```
For each DO:

Step 0: 构建 compliance_profile（不�?profile_hash�?        �?JCS(cp) �?SHA-256 �?写回 profile_hash

Step 1: 组装完整 v1.2 DO JSON (24 字段 + 子对�?
        包括: context, policies, evaluation, result,
              human_oversight, audit(占位), extensions

Step 2: 计算 rule_set_version.id
        rule_set_version.id = 'sha256:' + SHA-256(JCS(policies))

Step 3: 计算 policies[].hash (JCS 升级)
        每条 policy.hash = 'sha256:' + SHA-256(JCS(policy))

Step 4: 深拷�?�?以下在拷贝上操作

Step 5: 删除自引�?外部字段（v1.3 修正：仅�?audit.hash，保�?previous_hash + commitment�?        delete clone.audit.hash
        delete clone.signature
        delete clone.signing_key_id
        // extensions 保留在对象中，直接参与后�?JCS
        // signing_key_id �?signature 配对但不参与 JCS（白皮书 §4.2�?
Step 6: �?JCS + SHA-256
        const canonicalFull = JCS(clone)
        // canonicalFull = JCS(CORE + JURISDICTION + EXTENSIONS + previous_hash + commitment)
        const auditHash = 'sha256:' + SHA-256(canonicalFull)

Step 7: 写回
        clone.audit.hash = auditHash
        clone.signature = originalSignature

Step 8: 记录 canonical_hex
         canonical_hex = hex(JCS(CORE + JURISDICTION + EXTENSIONS + previous_hash + commitment))
         // 不含: audit / signature / signing_key_id
         // �? extensions（直接参与主 JCS�?```

---

## 6. 审计哈希向量

### 6.1 选择原则

�?63 条静�?DO 中�?12 条生�?AV，覆�?11 种决策类�?+ AV-008 回归�?
| AV | �?DO | 决策 | 测试目的 |
|----|-------|------|---------|
| AV-001 | DO-001 | DENY | 安全拦截 �?Ring 0 单规则命�?|
| AV-002 | DO-013 | REQUEST_HUMAN | 合规审批 �?PII 上下�?|
| AV-003 | DO-011 | ALLOW | Override 安全方向 �?多规�?matched_rules |
| AV-004 | DO-009 | EMERGENCY_HALT | �? 紧急终�?�?短路评估 |
| AV-005 | DO-017 | ESCALATE | 低信�?Agent 升级 |
| AV-006 | DO-024 | ALLOW | Unless 豁免触发 |
| AV-007 | DO-027 | PASS | Null-safe 字段访问 |
| AV-008 | DO-011 | (回归) | 陈旧回归向量（canonical_bytes �?AV-003, audit.hash 保留旧值） |
| AV-009 | DO-021 | CORRECT | 自动纠偏 |
| AV-010 | DO-031 | NOTIFY | 异常通知记录 |
| AV-011 | DO-038 | ROLLBACK | 快照回滚 |
| AV-012 | DO-051 | WORKFLOW | 工作流启�?|

### 6.2 AV-008 特殊构�?
```javascript
// AV-008 不通过正常流程生成。手动构造：
const av008 = JSON.parse(JSON.stringify(av003)); // av003 = AV derived from DO-011
av008.id = 'AV-008';
// canonical_bytes 不变（与 AV-003 相同�?// audit.hash 使用硬编码的旧值——该值在 commit c3f22df 的旧算法下计�?//（JSON.stringify 而非 JCS + 无平面哈希），与 v1.2 平面哈希必然不同
av008.decision_object.audit.hash = 'sha256:342b4e9652101d0b75ef39bed7f5a7e6de4d890618ec6eeafe3a9a3490ddb64d';
av008.vector_ref = 'AV-003';
av008.source_commit = 'c3f22df';
av008.note = 'STALE REGRESSION VECTOR: canonical_bytes identical to AV-003, audit.hash intentionally stale (v1.1 legacy value). Any validator that recomputes from first principles will detect MISMATCH; cached/shorthand validators will falsely PASS.';
```

---

## 7. 输出规范

### 7.1 `decision-object-vectors-v1.2.json`

```json
{
  "$schema": "https://openoba.com/erdl/decision-object-v1.0/schema.json",
  "spec": "decision-object-v1.0",
  "version": "1.2.0",
  "compliance_profile": "erdl-compliance-v1.2",
  "created": "2026-07-28",
  "updated": "2026-07-28",
  "maintainer": "OpenOBA (https://openoba.com)",
  "description": "101 cross-implementation test vectors for ERDL Decision Object v1.2. 63 static DOs + 26 dynamic (Temporal 10 / Seeded 8 / Stateful 8) + 12 audit hash vectors. Flat hashing: JCS(CORE+JURISDICTION+EXTENSIONS+previous_hash+commitment) �?SHA-256.",
  "vectors": [
    { "id": "DO-001", "category": "...", "scenario": "...", "rules": [...], "context": {...}, "expected": {...} },
    ... 63 entries
  ],
  "dynamic_vectors": {
    "temporal": [ ... 10 entries ],
    "seeded": [ ... 8 entries ],
    "stateful": [ ... 8 entries ]
  },
  "audit_vectors": [
    { "id": "AV-001", "vector_ref": "DO-001", "category": "audit-hash", "canonical_bytes": "...", "decision_object": {...} },
    ... 12 entries
  ],
  "reserved_vectors": {
    "decision_vectors": [
      { "id": "DO-064", "decision_type": "DELEGATE", "status": "reserved_for_v1.3", "note": "Reference implementation (rulsynor) engine code path not yet implemented" }
    ],
    "audit_vectors": [
      { "id": "AV-013", "vector_ref": "DO-064", "decision_type": "DELEGATE", "status": "reserved_for_v1.3" }
    ]
  },
  "metadata": {
    "decision_types_covered": ["ALLOW","DENY","CORRECT","REQUEST_HUMAN","ESCALATE","NOTIFY","EMERGENCY_HALT","QUARANTINE","ROLLBACK","PASS","WORKFLOW","WORKFLOW_WAITING","WORKFLOW_PROGRESS"],
    "operators_covered": ["eq","neq","gt","gte","lt","lte","in","not_in","contains","matches","starts_with","ends_with","exists"],
    "edge_cases_covered": ["null-propagation","strict-type-matching","ReDoS-protection","rate-limiting","integer-safe-range","object-deep-comparison","empty-extension-normalization"],
    "compatibility_levels": { "L1": 28, "L2": 45, "L3": 101 }
  }
}
```

### 7.2 兼容等级说明

| 等级 | 向量�?| 含义 | 来源 |
|:---:|:---:|------|------|
| L1 Basic | 28 | v1.0 等价范围 (早期决策类型) | SPEC v1.1 §12 冻结�?v1.0 DO 定义 |
| L2 Verified | 45 | v1.1 等价范围 (37 DO + 8 AV) | v1.1 向量集规�?|
| L3 Full | 101 | v1.2 全部 (63 DO + 26 dynamic + 12 AV) | 白皮�?§13.2 |

---

## 8. 依赖

```json
{
  "name": "erdl-vectors",
  "scripts": {
    "generate": "node scripts/generate-vectors.cjs",
    "verify": "node scripts/verify.js"
  },
  "dependencies": {
    "json-canonicalize": "^1.0.0"
  }
}
```

生成器依�?`json-canonicalize`。验证器（`verify.js`）零依赖�?
---

## 9. 实现顺序

1. 搭建脚本骨架 �?常量子对象、JCS/SHA-256 封装
2. 编写 DO Builder �?接收 (decision, rules, context, expected) �?输出完整 DO JSON
3. 编写 63 条向量的 rules/context/expected 定义
4. 注入 v1.2 元数�?+ 平面哈希计算
5. 生成 12 �?AV
6. 动态向量生成器（Temporal/Seeded/Stateful�?7. 组装 JSON �?输出 `decision-object-vectors-v1.2.json`
8. 自验�?�?遍历所�?AV，五步法重算�?1/12 MATCH + AV-008 MISMATCH

---

> *中立性是被测出来的，不是宣称出来的�?
