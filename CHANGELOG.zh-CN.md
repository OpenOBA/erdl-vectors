# Changelog — ERDL Decision Object Test Vectors

> Copyright © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.) · 向量与规范 CC0-1.0 · 代码 Apache-2.0

> **License change (2026-09-01)**: MIT → Apache-2.0 (explicit patent grant).
>
> **License split (2026-09-04)**: two-tier license — test vectors + spec docs → CC0-1.0; code → Apache-2.0.

## v1.6.0（现行）- 2026-09-09

### Changed
- **表达层 239 → 240 向量**（Core 317 → 318）：新增 E10 in-membership NFC 向量。
- **ER3 结果对象格式**（`value`/`value_type` ∈ number/string/boolean）：内部类型（rational/date/undefined/null/object）折叠为 ER3；number 序列化为定点字符串（RFC 8785 §3.1）；`errored` 语义明确（E3 求值错误 → `true`）。
- **gloss/projection 期望值英文单语**（spec §5.5 英文 canonical）；GLOSS / INTEGRITY / PROJ 期望值改为 ER3 `value`/`value_type`。
- **warning 语义统一**：比较/字符串类型不匹配 → 静默 false；quantifier over 缺失字段 → 静默 false（E11）。

### Added
- **expression-layer 提交管线**：`verify-v-engine-submission.mjs`（ER3 envelope 交叉验证）+ `update-expression-registry.cjs` + IMPLEMENTATIONS.md 的 expression-layer registry + CI（按 layer 分派交叉验证 + 自动记录）。

### Fixed
- **rate 修饰符真值反转修正**（SPEC §5.2：超限 → true）。
- **`in` 成员比较 NFC 归一**（E10）。

## v1.5.1（现行）- 2026-09-06

### Added
- null 非对称向量（表达层 236 → 239）：锁定 `== null`/`!= null` 字段存在感知语义。

### Fixed
- V-GLOSS 向量 `node` 字段归一化为具体节点名（补 `node_group`）。

### Changed
- spec 字段 `erdl-spec-v2.0` → `v2.1`；修复死链；RFC-002 交叉引用映射。
- 补徽章、POC 欢迎提示与 support 邮箱。

## v1.5.0

Decision Object v1.5 扁平哈希链跨实现测试向量集。

- **V-DO-v15 审计层 78 条**（`decision-object-vectors-v1.5.json`）：决策类型 13 / 链攻击检测 8 / 锚定攻击检测 10 / 金丝雀 1 / 结论层 14 / 法域合规 32
- **V-ENGINE 表达层 236 条**（`v-engine-vectors.json`）：节点语义 136（34 节点 × 4 场景）/ 求值约束 48 / Simple 编译 30 / gloss 16 / 投影面 6
- **规范性契约**：`RUNNER_CONTRACT.md`（规则 R1–R6）+ `docs/VERIFIER-GUIDE.md`
- **验证程序**：五步验证法 Step 0–6（RFC-002 §7），参考实现 `scripts/verify-v1.5.js`（零依赖 self-built JCS）
- **自动记录**：`scripts/generate-conformance.cjs` → `conformance/CONFORMANCE.md`（CI 自动生成，记录 Check 1/2 + K01 判别 + R1–R6；`npm run conformance`）+ `submissions/README.md`（第三方 runner 提交管道）
- **2026-09-06 增量（非 DO 升版，Core 311 → 314）**：新增 3 条 E11 类型不匹配约束向量锁定 G4 语义——混合非空类型（布尔 vs 数字、字符串 vs 数字）的 `ne`/`eq` 对 eq 和 ne **均折叠为 false**（SPEC §7.3(a)，禁止 JS `!==` fail-open）。表达层 233 → 236，语义敏感向量 71 → 74；独立验证器同步补类型不匹配折叠。引擎修复镜像同步 erdl-landing / rulsynor-core / rulsynor backend。
- **2026-09-06 增量（非 DO 升版，Core 305 → 311）**：新增 6 条约束向量锁定 G1/G2/G3 语义——`== null`/`!= null` 字段存在性感知（E11 ×3）、`min`/`max` 空数组安全折叠为 false（E8 ×2）、`date_add` 非整数 amount 拒绝（E9 ×1，§7.3(f) amount MUST 整数）。表达层 227 → 233，语义敏感向量 61 → 71；独立验证器（`verify-v-engine.mjs`）同步补 E11 空值传播 + `date_add` 整数拒绝。
- **2026-09-05 增量（非 DO 升版，Core 301 → 305）**：新增 E9 时间节点 UTC 语义约束向量 4 条（`epoch_ms` 无时区后缀按 UTC / `Z` 后缀 / `+08:00` 偏移 / `days_between` floor），锁定规范 §7.3(f)「无时区后缀按 UTC」的跨实现语义；表达层 223 → 227，语义敏感向量 57 → 61。同步修复独立验证器（`verify-v-engine.mjs`）时间解析：严格 ISO 8601（无时区后缀补 Z 按 UTC）+ `days_between` `Math.round` → `Math.floor`（对齐 §7.3(f)）。
- **2026-09-02 增量（非 DO 升版，Core 301 不变）**：新增 §1.4 生产侧不变量 / §1.5 决策推导语义 / §1.6 Producer Contract；新增 decision_divergence（跨层语义重推，V-DIVERGENCE 3 条，`npm run verify:decision`）+ V-PRODUCER（producer-side 一致性，`npm run verify:producer`）；附录 A 新增 P-05 残余风险；P6 可解析集语义澄清。鸣谢：Santosh Kumar Puppala（norviq-dev）。

## v1.3（历史档案，归档于 archive/v1.3/）

Decision Object v1.3，13 条 AV 向量，经 Erik Newton（Concordia）独立 Runner 逐字节验证。
