# RUNNER_CONTRACT.md — 决策对象验证 Runner 一致性契约

> 本契约是「规范行为」的**权威定义**（RULE）。一个 conforming runner（符合契约的验证器）做什么、不做什么、哪些字段不进原像、哪些失败必须暴露——独立实现者可**仅凭本契约**从第一性原理实现验证器，无需阅读参考实现。
>
> 契约与预言、参考实现三者分离：
> - **本契约** = 规则（normative behavior spec）；
> - **答案文件** `decision-object-answers-v1.5.json` = 字节级诊断预言（oracle，非规则本身，物理隔离）；
> - **参考实现** `scripts/verify-v1.5.js` = 一个 conforming runner 的实例（非规范）。

---

## 1. 一致性要求（MUST）

一个 conforming runner MUST 满足以下全部要求。逐条可测，不满足即不 conforming。

### R1 — 重算 audit.hash（唯一删除点）

对每条 DO：deep clone → **删除 `audit.hash` 自身（+ 按 R2 防御性删除 `signature`/`signing_key_id`）** → JCS（RFC 8785）规范化 → SHA-256 → 前缀 `"sha256:"` → 与存储 `audit.hash` 逐字节对比。

```
audit.hash = "sha256:" + HEX( SHA-256( UTF8( JCS( DO − audit.hash ) ) ) )
```

- 删除语义唯一化：删除（delete key），禁止置空（blank）——两者产生不同 JCS 字节；
- 其余字段（CORE + JURISDICTION + extensions + `canonical_tree`）**无条件参与**，无白名单、无投影、无验证器侧字段取舍。

### R2 — 原像字段排除

MUST 排除（不进哈希原像）：

| 字段 | 排除原因 |
|------|---------|
| `audit.hash` | 自引用（唯一删除点） |
| `signature` / `signing_key_id` | 签名模式字段（哈希模式不存在，防御性删除为 no-op） |

字段内哈希的自引用排除：`policies[].hash`、`compliance_profile.profile_hash` 计算时，被计算字段自身 MUST 临时移除；其已算好的值作为普通字段参与全 DO 扁平哈希。`policies[].hash` 原像**不含 gloss**（gloss 是渲染产物，非规则内容）。

### R3 — 失败必须暴露（breach 码）

conforming runner MUST 在下列情况下暴露对应 breach 码（不得静默通过）：

**单 DO**（MUST 按 §9.1.1 优先级 P1→P6 报告第一条命中；且 MUST 校验向量的 `expected.also_present`——声明项须真实成立且被拑压，同时成立但未声明即判缺陷）：`jurisdiction_mismatch`（P1，语义收窄为「法域码不在权威六法域集合」，RFC-002 §9.1.2）/ `compliance_field_missing`（P2，含 `risk_level=critical` 但 `activated_fields` 未包含 `signature`）/ `oversight_missing`（P3）/ `sod_violation`（P4）/ `tree_snapshot_divergence`（P5）/ `content_unresolvable`（P6，**告警级 MUST 排最后**）——检测规则见 `docs/VERIFIER-GUIDE.md` §4.1。

**链**（按优先级）：`hash_mismatch` → `version_unsupported` → `chain_genesis_mismatch` → `previous_hash_dangling` → `chain_seq_gap` → `mode_mixed_chain` → `time_regression`。

**时间锚定**（随签名层）：`clock_drift_detected` / `timestamp_anchor_missing`。

### R4 — 双重验证（Check 1 + Check 2）

conforming runner MUST 同时通过两重门：

| 门 | 验证对象 | 验证内容 |
|----|---------|---------|
| **Check 1** | 工件自报的 `audit.hash` | 重算 hash vs 工件自报 hash（这是**部署场景**真正发生的验证） |
| **Check 2** | 独立答案文件 | 重算 canonical bytes vs 预言（这是**复现**检查，抓字节漂移） |

只通过其一不构成 conformance——七月教训：runner 可通过预言却从不检查工件自报 hash，反之亦然。

### R5 — 金丝雀必须判别

金丝雀 `V-DO-v15-K01`（v1.3 时代对应 AV-013）MUST 在 conforming runner 上产生可区分结果：

- 正确实现（仅删 `audit.hash`）→ 重算 hash ≠ 存储 hash → **MISMATCH**；
- 缺陷实现（删整个 `audit`）→ 重算 hash = 存储 hash → MATCH（被捕获）。

**验收判据**：`Check 1 = MISMATCH` 且 `Check 2 = MATCH`（canonical bytes 与预言一致，证明失配是 hash 层而非字节层）——金丝雀正确判别。

### R6 — 不得读取答案文件（中立性）

conforming runner MUST **自行实现 JCS（RFC 8785）**，MUST NOT 读取答案文件来「通过」验证（读取即绕过独立验证，违反中立承诺）。答案文件仅作为 Step 6 的**事后交叉比对**，由验证流程之外提供，且合规运行不可读。

---

## 2. 一致性判定（Conformance）

一个 runner 满足 R1–R6 全部要求，即声明为 conforming。判定方式：

1. **自行实现**：从本契约 + RFC 8785 从第一性原理实现（禁依赖 ERDL SDK / json-canonicalize）；
2. **逐条验证**：对 `decision-object-vectors-v1.5.json` 全部向量运行，Check 1 + Check 2 双门通过；
3. **金丝雀判别**：K01 满足 Check 1 MISMATCH + Check 2 MATCH；
4. **自动记录**：CI 运行 `scripts/generate-conformance.cjs`，在验证通过后自动生成 [conformance/CONFORMANCE.md](conformance/CONFORMANCE.md)（记录谁、哪天、通过多少条 + Check 1/2 + K01 判别 + R1–R6 对照结论）——结果由验证运行本身产出，非手工背书；
5. **提交注册**：PR 到 `submissions/`，登记于 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md)。

---

## 3. 验收测试（Acceptance Test）

**在参考实现缺席的情况下**，用契约文本独立判定一个 runner 是否 conforming，最有力的验收测试是金丝雀：

> 给定 `V-DO-v15-K01`，一个实现若在 Check 1 上返回 MISMATCH、在 Check 2 上返回 MATCH，则其「独立重算」行为与契约一致；若返回 MATCH（Check 1），则它跳过独立重算——不 conforming。

金丝雀因此是「诚实性哨兵」：它不验证算法对不对，而验证「验证器有没有真的在独立重算」。

---

## 4. 诊断预言（答案文件）

答案文件 `decision-object-answers-v1.5.json` 是**字节级诊断预言**，与契约分离：

- 存**向量集全部 DO** 的 `canonical_hex`（JCS 输出的 UTF-8 字节转 hex），非仅 MATCH 型：
  - `<id>` —— 单 DO 向量（含 BREACH 型与金丝雀）；
  - `<id>-base` / `<id>-tampered` —— 篡改对向量的两侧；
  - `<id>[i]` —— 链向量的第 i 个成员（含攻击链）；
- **唯一排除（版本门）**：`audit.preimage_version` 非本版常量的 DO **MUST NOT** 有预言键——conforming runner 按 R1/Step 1 必须提前终止（`version_unsupported`），本质上不产出本版管线的 canonical bytes；为其登记预言等于诱使验证器绕过版本门（v1.5 中唯一实例：`V-DO-v15-C07[1]`）；
- 物理隔离（`.gitignore`），提交者/CI 不可读；
- 用途：Check 2 的逐字节交叉比对，抓**字节漂移**（算法对但序列化细节错）；
- 非规则本身——conforming 由契约定义，不由「匹配预言」定义。

### 4.1 覆盖面不变式（MUST，可自动校验）

| 不变式 | 含义 | 违反后果 |
|------|------|---------|
| **零缺预言** | 每个适用 DO（版本受支持）MUST 有且仅有一个预言键 | Check 2 在该 DO 上名存实亡，字节漂移不可见 |
| **零死键** | 预言键 MUST 全部被 runner 读取 | 预言与向量集脱节，产生「覆盖假象」 |
| **版本门排除** | 版本不支持的 DO MUST 无预言键 | 验证器可能跳过版本门去凑字节 |

参考 runner 已将三条不变式实现为硬失败守卫，并在报告中输出覆盖面（`101/101 适用 DO + 1 N/A`）。

---

> *"中立性是被测出来的，不是宣称出来的。" — 契约让任何实现从第一性原理 conform，预言抓字节漂移，金丝雀抓诚实性。三者合围，才能断言「强于与自家生成器一致」。*
