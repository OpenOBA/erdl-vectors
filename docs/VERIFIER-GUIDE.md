# ERDL Decision Object v1.5 — Runner 验证指南（自洽实现规范）

> 面向独立 Runner（第三方验证者）。本文档**自洽**——不依赖阅读完整 RFC-002 与 SPEC，即可独立实现一个验证器，对 `decision-object-vectors-v1.5.json` 逐条验证。
>
> **规范性契约**见 [RUNNER_CONTRACT.md](../RUNNER_CONTRACT.md)（规则 R1–R6，conforming 的权威定义）；本文档是**实现指南**（HOW），契约是**规则**（RULE）。权威依据：`docs/OPENOBA-DOBJ-RFC-002-CN.md`（哈希/链/向量体系）+ ERDL 规范 v2.0（数据模型/语义）。

---

## 0. 验证的核心命题

Decision Object（DO）是 AI Agent 单次决策的防篡改审计记录。Runner 要回答的唯一问题：

> **`audit.hash` 是否等于「全 DO 字段（仅删除 `audit.hash` 自身）经 JCS 规范化 + SHA-256」的重算结果？**

金丝雀（canary）向量额外回答：**正确实现与「跳过独立重算」的缺陷实现能否被区分？**

---

## 1. 哈希公式（唯一删除点）

```
audit.hash = "sha256:" + HEX( SHA-256( UTF8( JCS( DO − audit.hash ) ) ) )
```

- **删除点（R2）**：删除 `audit.hash` 自身（自引用排除），并防御性删除 `signature`/`signing_key_id`——哈希模式下后两者不存在，删除为 no-op；签名模式下 MUST 剔除。参考实现与生成器均已实现三字段删除（严格同构，避免未来签名模式向量两端原像分歧）。
- **删除语义唯一化**：删除（delete key），禁止置空（blank：空串/空对象/占位值）——两者产生不同 JCS 字节。
- **其余字段**（CORE + JURISDICTION + extensions + `canonical_tree`）**无条件参与**，无白名单、无投影、无验证器侧字段取舍。
- **字段内哈希自引用排除**：`policies[].hash`、`compliance_profile.profile_hash` 计算时，被计算字段自身的 hash 键 MUST 临时移除；其已算好的值作为普通字段参与全 DO 扁平哈希。
- **`policies[].hash` 原像不含 gloss**：gloss 是渲染产物（不进 DO），其篡改由渲染校验（`gloss == render(树)`）检出，非哈希失配。

---

## 2. JCS 实现约束（RFC 8785，严格零自定义）

| # | 约束 | 规则 |
|---|------|------|
| 1 | 对象键序 | UTF-16 码元序（`Object.keys().sort()`）；DO 字段名全 ASCII，无排序歧义 |
| 2 | 数字 | IEEE 754 双精度序列化（ECMA-262 §7.1.12.1，V8/Ryu 参考） |
| 3 | 整数约束 | number 字段 MUST 为安全整数（`Number.isInteger` 且 \|v\| ≤ 2^53−1）；业务小数（金额/比例）以定点字符串进 DO，禁原生 number |
| 4 | 字符串 | 原样保留（as-is）；lone surrogate（如 U+DEAD）MUST 报错终止；定点小数字符串生成端已完成最小规范表示（禁尾零/整数带小数点/科学计数法/前导零） |
| 5 | NFC | 规范化在引擎数据入口做一次；JCS 流程本身零规范化 |
| 6 | Omit over Null | 可选字段 null/undefined/空数组 → 物理删除键；**例外**：① 链锚定字段 `audit.previous_hash` 首条为 null MUST 保留；② `extensions` 空数组 MUST 保留 |
| 7 | 数组序 | MUST NOT 重排数组元素（数组序是语义事实） |
| 8 | 非法值 | NaN / Infinity / BigInt / Symbol / Function / Date / 非纯对象 → 拒绝 |

**参考实现**（Node.js，零依赖，可直接对照）：

```js
function jcsCanonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('NaN/Infinity');
    return String(value);
  }
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new Error('lone surrogate');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(jcsCanonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + jcsCanonicalize(value[k])).join(',') + '}';
  }
  throw new Error('unsupported type');
}
```

---

## 3. 五步验证法（Step 0–6 共 7 步）

> 「五步」为历史沿用名：v1.3 验证法为 Step 1–5 五步；v1.5 新增 Step 0（版本选路）与 Step 6（答案双检），共 7 步。

对每条 DO 依次执行：

| Step | 动作 | 说明 |
|:---:|------|------|
| 0 | 版本判别 | 含 `canonical_tree` 或 `audit.preimage_version` → v1.5 扁平哈希路径；否则 v1.3 历史路径（本验证器仅处理 v1.5） |
| 1 | 读域分隔符 | `audit.preimage_version` MUST 等于 `"erdl-do-v1.5-hash-flat"`（域分隔符，防跨版本碰撞） |
| 2 | 整数约束 | 递归断言全 DO 的 number 字段为安全整数 |
| 3 | 删除点 | deep clone → `delete clone.audit.hash` + 防御性 `delete clone.signature` / `delete clone.signing_key_id` |
| 4 | JCS | `canonical = jcsCanonicalize(clone)` |
| 5 | SHA-256 | `computed = "sha256:" + sha256(UTF8(canonical))` |
| 6 | 对比 | `computed === audit.hash` → MATCH；否则 hash_mismatch |

**答案文件交叉比对（Step 6，可选）**：对 MATCH 型向量，将 `canonical` 的 UTF-8 字节转 hex（`canonical_hex`），与独立答案文件比对，逐字节一致才算跨实现一致。

---

## 4. 语义 breach 检测（非 hash 兜底）

hash 自洽 ≠ 无攻击。语义类向量篡改后**重算 hash 保持自洽**，迫使验证器靠语义检测器检出具体 breach 码。

### 4.1 单 DO breach（RFC-002 §9.1/§9.3）

**检测优先级（MUST，RFC-002 §9.1.1）**：多条同时成立时按 P1→P6 报告**第一条命中**，与 §4.2 链层同构。下表行序即优先级。

| 优先级 | breach 码 | 检测规则 |
|:---:|-----------|---------|
| P1 | `jurisdiction_mismatch` | `compliance_profile.jurisdictions` 任一值不在权威集合 {CN, EU, US, SG, BR, IN}。**语义已收窄为「不可识别的法域码」（fail-closed）**；「声明法域 ≠ 部署期望」不在本码范围（无状态验证器不持有部署期望，见 RFC-002 §9.1.2）；实现 MUST NOT 自行扩展该集合 |
| P2 | `compliance_field_missing` | `activated_fields` 中任一字段在 DO 中缺失；**或** `risk_level === 'critical'` 但 `activated_fields` 未包含 `signature`（风险条件层未生效，RFC-002 §5.2） |
| P3 | `oversight_missing` | `risk_level ∈ {high, critical}` 且 `human_oversight.required !== true` |
| P4 | `sod_violation` | `agent.id === policies[].author_id`（职责分离违反） |
| P5 | `tree_snapshot_divergence` | `evaluation.matched_rules[].canonical_tree` 与 `policies[].when` 重编译后的 JCS 不一致 |
| P6 | `content_unresolvable` | `knowledge_references[].entry_id` 不在可解析集（**告警非断裂 → MUST 排最后**，否则告警会掩盖同时存在的真实违规） |

优先级由 **V-COMP-F10**（P1 压 P2）与 **V-COMP-F11**（P5 压 P6）两条多重违规向量铉定。

**`also_present` 校验（MUST）**：conforming runner 对语义 BREACH 向量 MUST 同时校验三件事——
① `expected.breach` 等于优先级排序后的首项；② `also_present` 每项真实成立且排在首项之后；
③ 凡同时成立但未声明的 breach 均判向量集缺陷。参考实现为硬失败（非警告）。

### 4.2 链 breach（RFC-002 §8，检测优先级）

按序检查，命中即返回：

1. 任一条 DO hash 重算不匹配 → `hash_mismatch`
2. 任一条 `preimage_version` 不支持 → `version_unsupported`
3. 创世块 `previous_hash !== null` → `chain_genesis_mismatch`
4. `previous_hash !== 上一条.hash` → `previous_hash_dangling`
5. `chain_seq !== 上一条.chain_seq + 1` → `chain_seq_gap`
6. 相邻 `audit.mode` 不同 → `mode_mixed_chain`
7. `timestamp < 上一条.timestamp` → `time_regression`

### 4.3 时间锚定 breach（RFC-002 §9.5，随签名层落地）

| breach 码 | 检测规则 |
|-----------|---------|
| `clock_drift_detected` | `DO.timestamp` 与 `timestamp_proof.token` 内 TSA 时间偏差 > 阈值（默认 60s） |
| `timestamp_anchor_missing` | 决策类型 ∈ {DELEGATE, ESCALATE, REQUEST_HUMAN} 时 `timestamp_proof` 缺失 |

---

## 5. 向量文件格式

`decision-object-vectors-v1.5.json` 顶层结构：

```jsonc
{
  "$schema": "...",
  "spec": "SPEC v2.0",
  "preimage_version": "erdl-do-v1.5-hash-flat",
  "version": "v1.5.0",
  "created": "2026-08-22",
  "vectors": [
    // 三种形态之一：
    // ① decision_object：独立 DO（MATCH 正例 / 语义 BREACH / 金丝雀）
    { "id": "V-DO-v15-D01", "category": "D", "decision_type": "ALLOW",
      "scenario": "...", "description": "...",
      "decision_object": { ... },
      "expected": { "type": "MATCH" } },

    // ② chain：DO 链（正常链 C01 + 攻击链 C02~C08）
    { "id": "V-DO-v15-C03", "category": "C",
      "chain": [ {...}, {...} ],
      "expected": { "type": "BREACH", "breach": "chain_seq_gap" } },

    // ③ base_do + tampered_do：篡改对（base 自洽，tampered 失配）
    { "id": "V-COMP-F06", "category": "V-COMP",
      "base_do": { ... }, "tampered_do": { ... },
      "expected": { "type": "BREACH", "breach": "hash_mismatch" } }
  ]
}
```

**expected.type 语义**：

- `MATCH`：hash 自洽，且 `required_fields` 全部存在、`checks`（如 sod）不违反；
- `BREACH`：hash 自洽（语义类）或 hash 失配（hash 类），语义检测器/链检测器须检出 `expected.breach` 精确值。

---

## 6. 金丝雀（K01）

金丝雀存储「缺陷实现会算出的 hash」：

- 正确实现：只 `delete audit.hash`（previous_hash 保留）→ 重算 hash ≠ 存储 hash → **MISMATCH**；
- 缺陷实现：删整个 `audit` → 重算 hash = 存储 hash → MATCH（被捕获）。

Runner 的验证器若在金丝雀上返回 MATCH，说明它「跳过独立重算」——回归被捕获。

---

## 7. 完整手算示例

给定最简 DO（D01 决策类型覆盖）：

```json
{
  "agent": { "id": "agent-001", "role": "guardian", "version": "v1.5.0" },
  "decision_type": "ALLOW",
  "audit": {
    "mode": "hash",
    "preimage_version": "erdl-do-v1.5-hash-flat",
    "previous_hash": null,
    "chain_id": "chain-d01",
    "chain_seq": 0,
    "hash": "sha256:..."
  }
}
```

验证步骤：deep clone → `delete audit.hash` → JCS 得到 `{"agent":{"id":"agent-001",...},...}` 的规范化字符串 → SHA-256 → `"sha256:" + hex` → 与存储 `audit.hash` 对比。字段被排序、null 按规则保留/删除、字符串原样、数字原生序列化。

---

## 8. 提交（Submission）

见 [submissions/README.md](../submissions/README.md)（提交格式 + 步骤）与 [IMPLEMENTATIONS.md](../IMPLEMENTATIONS.md)（注册表）：

1. 独立实现 JCS（RFC 8785）+ SHA-256，**禁依赖 ERDL SDK / json-canonicalize**；
2. 对 `decision-object-vectors-v1.5.json` 逐条验证，收集 canonical bytes；
3. 金丝雀 K01 正确实现 MUST MISMATCH（`k01_check1 = "MISMATCH"`）；
4. PR 到 `submissions/`（格式见 [submissions/README.md](../submissions/README.md)：`canonical_hex` + `k01_check1`）。
5. CI 交叉验证（`verify-submission.cjs`）通过后，合并时自动登记于注册表（`update-registry.cjs`），并生成 `conformance/CONFORMANCE.md`。

**在线验证工具**：无需安装即可验证单条 DO 的 hash，见 `web/verify.html`（浏览器端 self-built JCS + Web Crypto SHA-256）。

---

> *"中立性是被测出来的，不是宣称出来的。" — 本指南让任何 Runner 用与厂商不同的技术栈独立重算，消除「必须信任厂商」的风险。*
