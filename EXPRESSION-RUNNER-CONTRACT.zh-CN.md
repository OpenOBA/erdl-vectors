# EXPRESSION-RUNNER-CONTRACT.zh-CN.md — 表达层 Runner 一致性契约（中文补充版）

> 本契约是表达层 runner「规范行为」的**权威定义**（RULE）。一个 conforming 表达层 runner 从 ERDL spec + 本契约**从第一性原理**实现表达内核，对 `v-engine-vectors.json` 的 233 条向量逐条重算——独立于参考实现、独立于本仓库的 `scripts/verify-v-engine.mjs`（那是参考实现的第二源，非第三方）。

> **与审计层契约的区别**：审计层契约（[`RUNNER_CONTRACT.md`](RUNNER_CONTRACT.md)，R1–R6）验证的是 **JCS + SHA-256 哈希**（字节级）；本契约验证的是**求值语义**（表达内核），产出是语义值（number / string / boolean），非字节哈希。

> **契约、预言、参考实现三者分离**：
> - **本契约** = 规则（normative behavior spec）；
> - **向量 `expected` 字段** = 语义预言（oracle，非规则本身）；
> - **`scripts/verify-v-engine.mjs`** = 参考实现的第二源（一个 conforming runner 的实例，非规范）。

> 英文为权威版本，本中文版仅为辅助阅读；二者冲突时以英文版为准。

---

## 1. 一致性要求（MUST）

一个 conforming 表达层 runner MUST 满足以下全部要求。逐条可测，不满足即不 conforming。

### ER1 — 从规范实现表达层

MUST 实现完整 ERDL 表达层：**34 节点内核**（取值 3 / 逻辑 3 / 比较 6 / 集合 1 / 字符串 4 / 存在量纲 3 / 量词 3 / 算术 5 / 时间 5 / 聚合 1）**加 Simple 编译（30 运算符）、gloss（16）、投影面（6）**——合计 233 条向量的覆盖面。语义以 [erdl-spec](https://github.com/OpenOBA/erdl-landing/blob/main/erdl-spec.md) §5 / §7 为**唯一规范源**。节点语义不属于本契约——本契约只规定「实现什么」与「怎么验收」，节点细节见 spec。

### ER2 — 独立实现

MUST 仅凭 spec 实现。MUST NOT 依赖 `@openoba/erdl`、`erdl-formal`、或任何 OpenOBA 引擎 / 库作为求值后端（依赖即不再是「独立实现」）。通用第三方库（日历、正则、大整数）允许，但 ERDL 语义本身必须自实现。

### ER3 — 输出格式

对每条向量，产出结果对象，schema 与向量 `expected` 一致：

```
{ "value": <number|string|boolean>, "value_type": "number"|"string"|"boolean", "errored": false, "warnings": [] }
```

### ER4 — 值级一致重算

对 `v-engine-vectors.json` 全部 **233 条**向量逐条重算，`value` 与 `expected.value` **值级一致**（按 `value_type`）：

| `value_type` | 一致性判据 |
|-------------|-----------|
| `number` | scale-14 定点整数**逐位相等**（ER5） |
| `string` | 字节级相等（NFC 规范化后） |
| `boolean` | 相等 |

`errored` 必须与 `expected.errored` 一致。

### ER5 — 定点小数（E2）

算术 MUST 用 **scale=14 定点 + half-even 舍入**（钱，禁浮点）。中间不舍入，仅输出节点 scale=14 + half-even。

### ER6 — 空数组折叠（E8）

`all` / `any` / `none` 作用在空数组上 MUST 折叠为 **false**（反空洞真）。

### ER7 — 叶子折叠（E11）

字段缺失在**比较叶子**处折叠为 false（非 Kleene 传播）；`exists` 是唯一感知字段存在性的算子。

### ER8 — 求值错误（E12）

除零、非数组 aggregate 等求值错误 MUST 按 E12 折叠（tier 3–5 折叠为 false / `Missing`）。

### ER9 — 不读预言（中立性）

MUST NOT 读取向量 `expected` 字段来「通过」验证（读取即绕过独立验证，违反中立承诺）。`expected` 仅作为 CI 的**事后交叉比对**，由验证流程之外提供。

---

## 2. 一致性判定（Conformance）

一个 runner 满足 ER1–ER9 全部要求，即声明为 conforming 表达层 runner。判定方式：

1. **自行实现**：从 spec + 本契约从第一性原理实现（禁依赖 ERDL SDK，禁读 `expected`）；
2. **逐条验证**：对 `v-engine-vectors.json` 全部 233 条向量运行，`value` 值级一致（ER4）；
3. **语义敏感向量全对**：61 条语义敏感向量（E2 / E8 / E10 + 算术 / 时间 / 聚合）必须全部一致（见 §3）；
4. **自动记录**：CI 交叉验证通过后，登记进 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) 表达层注册表（谁、哪天、通过多少条）——结果由验证运行本身产出，非手工背书；
5. **提交注册（自动）**：PR 到 `submissions/<runner>/`；CI 交叉验证通过后，合并时自动登记（未通过的不登记）。

---

## 3. 验收测试（语义哨兵）

表达层没有哈希金丝雀（审计层 K01 那种「存储哈希被缺陷实现生成」的哨兵），其「诚实性哨兵」是**语义边界向量**——E2 / E8 / E10 / E9 / E11 约束 + 算术 / 时间 / 聚合节点（**71 条**，即本仓第二源独立重算的那批）。注意：这 71 条是*诚实性哨兵子集*，不是验收面——conformance 要求**全部 233 条**（ER4）；71 条只是最难的边界用例。

> 给定 E2（half-even 舍入）、E8（空数组折叠）、E11（叶子折叠）等边界向量，一个**语义略错的实现**必失配；而一个**硬编码答案**的假 runner 无法自证实现——它没有可在任意输入上重算的求值内核，代码评审 + 无法复现即被识破。

语义哨兵不验证「有没有独立实现」，而验证「实现有没有真正按 spec 求值」；ER9（不读预言）保证「独立实现」这一前提。

---

## 4. 诊断预言（expected 字段）

向量 `expected` 字段是**语义预言**，与契约分离：

- 存每条向量的 `value` / `value_type` / `errored` / `warnings`；
- 用途：CI 交叉比对，抓「算法对但某节点语义错」的漂移；
- 非规则本身——conforming 由契约定义，不由「匹配预言」定义。

---

## 5. Runner 得到什么（Incentives）

表达层是边界清晰、定义良好的任务（通常一到两天的专注工作，AI 辅助下更快）。作为符合规 runner，你将获得：

- **永久署名**：你的名字、日期、向量数记入 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md)，与现有 runner 并列；
- **规范致谢**：写进 spec 的 Acknowledgments 段；
- **历史里程碑**：「首个表达层 runner」是永久、可引用的事实。

> **中立性注**：你的实现必须**开源**（可审计）——中立性在代码里，不在声明里。

---

> *"中立性是被测出来的，不是宣称出来的。" — 契约让任何实现从第一性原理 conform，语义边界向量抓语义漂移，ER9 不读预言抓诚实性。三者合围，才能断言「表达层强于与自家参考引擎一致」。*
