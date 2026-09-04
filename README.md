# ERDL Decision Object · 跨实现验证向量 v1.5

> Copyright © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.) · 向量与规范 CC0-1.0 · 代码 Apache-2.0（见 LICENSE / LICENSE-CC0）

> **规范依据**：ERDL-DOBJ-RFC-002 — Decision Object v1.5 扁平哈希链（[`docs/OPENOBA-DOBJ-RFC-002-CN.md`](docs/OPENOBA-DOBJ-RFC-002-CN.md)）
> **向量版本**：v1.5.0 · Core 向量 301 条（审计层 78 + 表达层 223）
> **基于 ERDL 设计**：[ERDL（Entity-Rule Definition Language）](https://github.com/OpenOBA/erdl-landing) —— 声明式规则执行协议；Decision Object 即其决策的审计记录，数据模型见 [ERDL 规范 v2.0](https://github.com/OpenOBA/erdl-landing/blob/main/spec/erdl-spec-v2.0.md)

AI 治理的跨实现验证基准：一套不属于任何单一实现的中性测试向量。任何语言、任何技术栈的 runner，都可以仅凭规范从第一性原理独立实现 JCS（RFC 8785）+ SHA-256，逐字节重算 Decision Object 哈希并比对。

> **谁、哪一天、通过多少条——是测出来的，不是宣称的。**

## 为什么需要独立验证

AI Agent 正在越来越多地替企业做决定：审批、放行、拒绝、越级。当做决定的一方本身就是软件时，治理信任不能建立在单一厂商的宣称之上——它必须能被任何独立实现验证。

一份规范如果只有一个实现"通过"，无法区分"规范是对的"还是"这个实现恰好与自己的生成器一致"。只有当多个互不相关的实现，各自从规范文本出发独立实现，得到逐字节一致的结果，规范本身才算成立。

本仓库就是这项验证的测量现场：向量是中性的，答案是隔离的，记录是自动的，没有任何人给任何人背书。

## Decision Object：每一次决策的审计记录

Decision Object 是 ERDL 规则引擎一次决策的审计记录——基于 [ERDL（Entity-Rule Definition Language）](https://github.com/OpenOBA/erdl-landing) 设计，完整记录决策发生时的命中规则、匹配运算符与评估上下文。数据模型与哈希规则定义于规范 [`docs/OPENOBA-DOBJ-RFC-002-CN.md`](docs/OPENOBA-DOBJ-RFC-002-CN.md)。

其完整性由哈希链锚定：

- **防篡改证据**：对象移除 `audit.hash` 自身后，经 JCS（RFC 8785）规范化、SHA-256 计算，得到自报的 `audit.hash`（`sha256:` 前缀）；任何字段篡改都会导致审计哈希失配——可检测、可追溯；
- **三层证据体系**：哈希证明完整性，签名证明身份，时间戳证明时间；
- **扁平哈希链**：决策记录以 `previous_hash` 串链，篡改历史、删记录、指针悬空、时钟回退、整链重建、版本降级、混链等攻击均被建模为可检测场景（见下文链攻击向量）。

## 跨实现验证：征集独立 Runner

**这是本仓库的核心目的。**

78 条审计层向量是一个中性基准：它不预设任何语言、框架或技术栈，只预设规范本身。我们公开征集独立 runner：

1. 只读规范与契约：[RUNNER_CONTRACT.md](RUNNER_CONTRACT.md)（规则 R1–R6）+ [docs/VERIFIER-GUIDE.md](docs/VERIFIER-GUIDE.md) + RFC-002；
2. **自行实现 JCS（RFC 8785）+ SHA-256**——不依赖 `json-canonicalize` 或任何第三方 canonicalizer（R6）；
3. 对 `decision-object-vectors-v1.5.json` 全部 78 条向量逐条重算，通过 Check 1（与工件自报 `audit.hash` 自洽）+ Check 2（canonical bytes 与独立预言逐字节一致）双重门；
4. 金丝雀 K01 必须正确判别：Check 1 MISMATCH + Check 2 MATCH（见下文验证原则）;
5. 提交 `canonical_hex` + `k01_check1`（见 [submissions/README.md](submissions/README.md)），CI 交叉验证，合并后自动登记进 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) 注册表。

逐字节重算一致，即证明这份标准在你的实现下成立。v1.5 的 78 条哈希层向量现已有两个独立第三方 Runner 逐字节验证（Go / norviq-go，2026-09-01；Python / concordia-python，2026-09-02），各 107/107 canonical bytes——见 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) 注册表。

## A2A 发展语境

A2A（Agent-to-Agent）协议生态正在快速生长。当 Agent 之间开始互相委托决策、互相审批、交换证据时，跨实现的信任不能靠双边背书，而必须建立在可独立验证的基础之上——一方 Agent 产出的决策记录，必须能被另一方的独立实现逐字节核验。

Decision Object 的验证体系遵循的正是这条标准化路径（Erik Newton 于 A2A Discussion #2031 提出）：

> **三个独立实现 + 一个开放规范 + 没有单一所有者。**

每一个独立 runner，既是对本规范的验证，也是为 A2A 时代的信任基础设施添一块砖。

## 向量体系

Core 合计 **301 条** = V-DO-v15 审计层 78 + V-ENGINE 表达层 223。

### 覆盖总览

| 验证层 | 类别 | 覆盖对象 | 数量 | 状态 |
|--------|------|---------|:---:|------|
| 审计层 | V-DO-v15 | 决策类型 13 / 链攻击 8 / 锚定 10 / 金丝雀 1 / 结论 14 / 法域 32 | 78 | ✅ 已验证（第三方 ×2） |
| 表达层 | V-ENGINE | 节点语义 136 + 求值约束 35 + Simple 编译 30 | 201 | 未验证（仅参考） |
| 表达层 | V-GLOSS / V-PROJ | gloss 16（渲染 12 + 完整性 4）+ 投影面 6 | 22 | 未验证（仅参考） |
| **合计** | | **Core** | **301** | **部分验证（78/301）** |

**验证状态（二元）**：

- **已验证**：审计层 V-DO-v15 78 条哈希层向量，由两个独立第三方 Runner 逐字节验证——norviq-go（Go，2026-09-01）、concordia-python（Python，Erik Newton，2026-09-02），各 107/107 canonical bytes；历史 v1.3 的 13 条 AV（Erik Newton，2026-07-30）已由 v1.5 取代；
- **未验证**：表达层 223 条（V-ENGINE 201 + V-GLOSS / V-PROJ 22），仅参考实现通过，待独立第三方 Runner 验证。

**规划未生成（不计数）**：签名 V-SIGN 5 + 时间锚定 TSA 3 + 状态验证 V-TEMPORAL 4。

> **向量文件**：`decision-object-vectors-v1.5.json`（V-DO-v15 审计层 78 条）+ `v-engine-vectors.json`（V-ENGINE 表达层 223 条）。

### V-DO-v15 审计层（78 条）

| 类别 | 编号段 | 数量 | 内容 |
|------|------|:---:|------|
| 决策类型覆盖 | V-DO-v15-D01..D13 | 13 | 13 种决策类型 × 扁平哈希（含 canonical_tree 字段） |
| 链攻击检测 | V-DO-v15-C01..C08 | 8 | 正常链基线 + 7 攻击（篡改 / 删记录 / 指针悬空 / 时钟回退 / 整链重建 / 版本降级 / 混链） |
| 锚定攻击检测 | V-DO-v15-A01..A10 | 10 | 知识 / 引用 / 分片 / 附件 / 意图 / 记忆 / 树快照 / 树篡改 / B 类文本 |
| 金丝雀 | V-DO-v15-K01 | 1 | 链位置金丝雀（延续 AV-013 模式） |
| 结论层 | V-DO-v15-G01..G14 | 14 | 结构攻击恒定 6 + 领域示例 8（政务 4 + 企业 4） |
| 法域合规 | V-COMP-001..021 + F01..F11 | 32 | 字段符合性 21（辖区 7 + 框架 14）+ 失败检测 11（含第一层篡改 / 风险条件层 / 优先级锚定） |
| **哈希层合计** | | **78** | D / C / A / K / G / V-COMP |

规划、未生成、不计数：时间锚定 V-DO-v15-T01..T03（3 条）、签名链 V-SIGN-001..005（5 条），随签名层实现后补入。

### V-ENGINE 表达层（223 条）

节点语义 136（34 节点 × 4 场景）+ 求值约束 35（E1–E12 可向量化子集）+ Simple 编译 30（运算符）+ gloss 16（渲染 12 + 完整性 4）+ 投影面编译 6。

### 语义重推与生产侧一致性（2026-09-02 新增，非 Core 301）

在 Core 301 之上，新增两类验证对象，覆盖「决策-规则一致性」与「记录-执行保真度」——这是哈希/字段检查（V-DO、V-ENGINE）够不到的两个维度：

| 验证对象 | 系列 | 数量 | 内容 |
|---------|------|:---:|------|
| decision_divergence（跨层语义重推） | V-DIVERGENCE | 3 | 按 RFC-002 §1.5 从 DO 存储的 context+rules 重推决策，断言 `result.decision` 一致；catch「allow 引用 deny」等内部不自洽 |
| V-PRODUCER（producer-side 一致性） | 场景 | 3 | 按 §1.6 Producer Contract 运行 producer，捕获 enforcement vs 发射 DO，断言一致；唯一能触达 P-05 fidelity 的地方 |

> **bound 非 closure**：decision_divergence 覆盖「决策-规则一致性」，V-PRODUCER 覆盖「记录-执行保真度」（附录 A P-05）——前者可从成品 DO 验证，后者只能从 producer 运行验证。脚本：`npm run verify:decision` / `npm run verify:producer`。

### Extension（随行业增长）

`V-JURIS` / `V-SCENE` / `V-STAKE` / `V-NL` 随行业知识包增长，新增条目纳入冻结管理；Core 基线定基期内只增不减。

## 快速开始（Runner 导向）

### 0. 先读契约

- 规范性契约：[RUNNER_CONTRACT.md](RUNNER_CONTRACT.md)——R1–R6 与 conformance 判定的权威定义，可仅凭契约从第一性原理实现验证器；
- 实现指南：[docs/VERIFIER-GUIDE.md](docs/VERIFIER-GUIDE.md)——字段、breach 码、Check 1/2 检测规则；
- 规范原文：[docs/OPENOBA-DOBJ-RFC-002-CN.md](docs/OPENOBA-DOBJ-RFC-002-CN.md)。

### 1. 本地验证（参考实现）

```bash
npm install             # 安装依赖（json-canonicalize 仅供参考管线做确定性比对，vitest 用于测试；runner 自身 MUST NOT 依赖它）
npm run generate          # 生成 V-DO 78 条向量 + 答案文件（canonical_hex 物理隔离，.gitignore）
npm run generate:vengine  # 生成 V-ENGINE 223 条向量（@openoba/erdl 参考引擎）
npm run verify            # V-DO 五步验证法 Step 0–6 + 语义 breach 检测
npm run verify:vengine    # V-ENGINE 表达层独立验证（57 条语义敏感向量）
npm run verify:vengine:full  # V-ENGINE 全量 223 条
npm run verify:decision  # decision_divergence 跨层语义重推（需 @openoba/erdl）
npm run verify:producer  # V-PRODUCER producer-side 一致性
npm run conformance       # 自动生成 conformance/CONFORMANCE.md（Check 1/2 + K01 + R1–R6 合规报告）
npm test                  # vitest 回归套件（含 web/Node 一致性 + 对抗性回归守门）
```

### 2. 在线验证（无需安装）

打开 `web/verify.html`（浏览器端 self-built JCS + Web Crypto SHA-256），粘贴单条 DO 验 hash，或加载向量文件验证全部 78 条。可直接双击打开（file://），或 `npx serve web/` 本地托管。

### 3. 提交你的验证结果

按 [submissions/README.md](submissions/README.md)：

1. Fork 本仓库，从规范 + 契约自行实现 JCS（RFC 8785）+ SHA-256（无 SDK），对全部 78 条向量跑通；
2. 写入 `submissions/<your-runner-name>-output.json`：每个向量的 **canonical_hex**（删 `audit.hash` 后的 JCS 输出字节，hex 编码）+ **k01_check1**（必须为 `"MISMATCH"`）；
3. 开 PR——CI 逐字节交叉验证（`verify-submission.cjs`）并回帖结果；
4. 合并后自动登记进 [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md) 注册表（`scripts/update-registry.cjs` 从 `submissions/*.json` 派生，未通过的不登记）。

**自动记录**：CI 验证通过后自动生成 [conformance/CONFORMANCE.md](conformance/CONFORMANCE.md)，记录「谁、哪天、通过多少条」+ Check 1/2 + K01 判别 + R1–R6 对照结论——结果由验证运行本身产出，非手工背书，且 CI 有新鲜度门禁（stale 即红）。

## 验证原则

- **Measurements, not endorsements**：注册表只记录测量事实——谁、哪天、通过多少条；不认证、不背书、不保证。
- **金丝雀是诚实性哨兵**：金丝雀 K01 的存储哈希由「删掉整个 `audit` 对象」的缺陷实现生成。正确实现只删 `audit.hash`，重算必然失配——**Check 1 MISMATCH + Check 2 MATCH 才算正确判别**（失配在 hash 层而非字节层）；Check 1 返回 MATCH 的 runner 即跳过了独立重算，被当场捕获。
- **答案隔离**：答案预言（`decision-object-answers-v1.5.json`，canonical_hex）物理隔离（`.gitignore`），提交者与合规运行不可读；conformance 由契约定义，不由「匹配预言」定义。
- **跨实现对等**：同一向量在 TS / Python / Rust（Go 可选第四实现）下结果逐字节一致。
- **每条有归属**：每条向量明确验证哪个对象，覆盖成矩阵，回归可捕获。

## 致谢

对本规范的中立验证原则做出贡献的合作者：

- **Christopher Hopley（chopmob-cloud / AlgoVoi）**——独立技术审阅者。在 v1.2 / v1.3 审计中发现自引用哈希排除规则缺位、字符串小数跨引擎不一致等关键问题，推动扁平哈希架构确立；其洁净室 RFC 8785 JCS + SHA-256 检查器报告了四个技术发现（C1–C4）与三个安全问题（S1–S3），其中双哈希算法降级（CWE-757）与 schema_ref SSRF 攻击面直接推动了安全加固。
- **Erik Newton（Concordia）**——首个独立 Runner 实现者，「中立性不是宣称的，是测出来的」原则的提出者。在 A2A Discussion #2031 确立「三个独立实现、一个开放规范、没有单一所有者」的标准化路径；以 Python 纯规范实现（自建 JCS）逐字节验证 v1.3 全部 13 条 AV 向量；贡献了链完整性金丝雀设计、答案文件分离架构与 generated-artifact + clean-room + registry 的 CI 验证架构。
- **Santosh Kumar Puppala（norviq-dev）**——提出 record-emission fidelity 缺口（附录 A P-05）及 PEP/缓存命中路径的真实事故案例；提出 P6 可解析集语义歧义；将 decision_divergence 界定为「bound 非 closure」。
- **Rulsynor 团队**——参考规则引擎实现，为 Decision Object 字段设计提供真实工程约束输入，是测试向量生成的基准。

## 归档说明

| 目录 | 内容 | 状态 |
|------|------|------|
| `archive/v1.3/` | v1.3 全量：101 条 AV 向量 + 生成/验证脚本 + 测试 + RFC-001（CN/EN）+ 设计文档 + Runner 注册表 | 历史档案 + JCS 回归套件 |

v1.3 的 AV-* 编号归档后不复用、不与 V-DO-v15 并存于现行审计层。

---

> *中立性是被测出来的，不是宣称出来的。*
