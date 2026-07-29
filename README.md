# ERDL Decision Object v1.3 — 跨实现测试向量集

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> **版本**：v1.3.0  
> **状态**：已发布  
> **维护方**：OpenOBA (https://openoba.com)  
> **许可**：MIT

## 背景

ERDL Decision Object 是 AI Agent 规则评估的标准化、防篡改审计追踪格式。与传统 AI 系统的黑箱输出不同，Decision Object 记录了每一次决策的完整链条——哪些规则命中了、哪个运算符匹配了、什么上下文参与了评估——并通过 JCS（RFC 8785，JSON 规范化方案）与 SHA-256 哈希确保完整性。本项目提供了跨实现验证的标准测试向量集，任何符合 ERDL 协议的规则引擎均可通过独立运行验证来证明自身决策对象的正确性。

## 鸣谢

本项目能够顺利完成，离不开以下合作者的鼎力支持：

- **Christopher Hopley（chopmob-cloud / AlgoVoi）** — 独立技术审阅者。在 v1.2 白皮书草案的审查中，他发现了自引用哈希排除规则缺位、字符串小数跨引擎不一致、分层完整性缺口等关键问题，推动了平面哈希架构的确立。**在 v1.3 审计中，他写了一个洁净室 RFC 8785 JCS + SHA-256 检查器，验证了规范文本的内部一致性，报告了四个技术发现（C1~C4）和三个安全问题（S1~S3）——其中双哈希算法降级（CWE-757）和 schema_ref SSRF 攻击面的发现直接推动了 §9.6 和 §11.2 的安全加固。**他对 JCS RFC 8785 规范化与合规审计的深刻理解，对协议设计的严谨性产生了重要影响。
- **Erik Newton（Concordia）** — 首个独立 Runner 实现者，也是"中立性不是宣称的，是测出来的"原则的提出者。他在 A2A Discussion #2031 中确立了"三个独立实现、一个开放规范、没有单一所有者"的标准化路径，为 ERDL 从开源项目走向基础设施标准奠定了方法论基础。他用 Python 构建了 Decision Object 验证引擎，在 Node.js 实现之外首次逐字节验证了前 5 个审计向量（AV-001~AV-005），后扩展至全部 28 条合规向量，以实践证明了 JCS+SHA-256 跨实现验证的技术可行性。在 v1.1 冻结期审计中，他独立发现 `expected_sha256` 作为答案密钥的结构性风险，推动了陈旧回归向量的引入。**在 v1.3 审计中，他用自己的独立 RFC 8785 规范化器验证了全部 12 个 AV 向量（AV-001~AV-012），确认 11 个逐字节一致 + AV-008 正确失败——"a clean result"。他同时发现白皮书与代码删除策略不一致（E1）、previous_hash/commitment 排除导致链位置篡改不可检测（E2）、canonical_hex 泄露 JCS 答案（E3）三个关键问题——直接推动了 v1.3 的 audit 结构修复、AV-013 链完整性金丝雀设计、以及答案文件分离架构。**
- **Rulsynor 团队** — 作为 ERDL 规则引擎的参考实现，Rulsynor 是所有测试向量生成与验证的基准。其生产级引擎为 Decision Object 的字段设计提供了真实世界的约束输入——从 Agent 身份元数据到合规配置结构——确保协议定义经得起工程实践的检验。

我们对此深表感谢。正是他们的贡献，将一份规范转化为经过多方独立验证的跨实现标准。

## 概述

> **v1.3 关键变更**：audit 对象现包含 `hash` + `previous_hash` + `commitment` 三字段。`canonical_hex` 从向量移入独立答案文件。AV-008 被 AV-013 替代——链位置篡改金丝雀。见 [CHANGELOG.md](CHANGELOG.md)。
本仓库包含 ERDL（Entity-Rule Definition Language）Decision Object v1.2 协议的标准**101 条跨实现测试向量**。每条向量是一个完整的、可自验证的 Decision Object——AI Agent 规则评估决策的标准化、防篡改审计格式。

### 核心保证

| 保证 | 机制 |
|------|------|
| **确定性生成** | `node scripts/generate-vectors.cjs` 每次运行产出字节级完全相同的输出 |
| **防篡改** | JCS（RFC 8785）+ SHA-256 平面哈希——任何字段变更都会改变审计哈希 |
| **跨实现可验证** | `node scripts/verify.js` 零依赖运行——实现者可以验证自己的引擎 |
| **链完整性检测** | AV-013 作为金丝雀——跳过完整哈希重算的验证器将**失败** |
| **RFC 9562 UUIDv7** | 所有 `decision_id`/`execution_trace_id` 完全符合 RFC 9562（冻结时间戳） |

### 确定性架构

```
$ node scripts/generate-vectors.cjs
$ sha256sum decision-object-vectors-v1.3.json
├── decision-object-answers-v1.3.json      # 答案文件（调试用，合规运行不可读）
700a683dc76a65487cf97ebef321fba378cb0c141b966cdd13ebd26c40282aca

$ node scripts/generate-vectors.cjs  # 第二次运行
$ sha256sum decision-object-vectors-v1.3.json
a28c37dc6895706d84541e48a5cce74a36a903a5f524af59e9457554e800f369  # 完全一致
```

不使用 `Date.now()`，不使用 `crypto.randomBytes()`。冻结时间戳（`2026-07-29T00:00:00.000Z`）+ 确定性计数器 → **精确可复现**。

## 快速开始

### 验证现有向量文件

```bash
npm install
node scripts/verify.js                    # 默认：./decision-object-vectors-v1.3.json
node scripts/verify.js path/to/vectors.json
```

预期输出：`ALL VERIFICATIONS PASSED · 11/11 MATCH + CHAIN CANARY DETECTED`

### 从零生成向量（维护者使用）

```bash
npm install
node scripts/generate-vectors.cjs
# → 输出 decision-object-vectors-v1.3.json（~813 KB）
```

### 运行测试套件

```bash
npm test
# → 153 个测试覆盖 JCS、SHA-256、五步验证及全量向量完整性
```

## 向量集组成

### 静态决策向量（63 条）

| 决策类型 | 数量 | 覆盖内容 |
|----------|:----:|----------|
| ALLOW | 12 | 常规操作、override 安全方向、unless 豁免、运算符覆盖 |
| DENY | 12 | 安全基线、危险命令、关键路径、边界情况 |
| PASS | 10 | 选择性匹配、安全命令、空规则、空值安全、严格类型 |
| REQUEST_HUMAN | 4 | PII/HIPAA 合规、非营业时间、风险阈值 |
| EMERGENCY_HALT | 1 | Ring 0 短路 |
| CORRECT | 3 | 大小写规范化、单位转换、路径规范化 |
| ESCALATE | 3 | 低信誉 Agent、跨域操作、未知工具 |
| NOTIFY | 4 | 异常检测、审计记录、阈值告警、伴随 DENY |
| QUARANTINE | 3 | 可疑文件、异常行为、速率限制 |
| ROLLBACK | 3 | 快照恢复、部分失败、交易回滚 |
| WORKFLOW | 4 | 多步工作流、条件分支、审批节点 |
| WORKFLOW_WAITING | 3 | 人工审批等待、时间窗口等待、前置任务等待 |
| WORKFLOW_PROGRESS | 3 | 步骤推进、阶段完成、最终步骤 |

**覆盖运算符**：`eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`in`、`not_in`、`contains`、`matches`、`starts_with`、`ends_with`、`exists`（全部 13 种）

**边界情况**：空值传播、严格类型匹配、ReDoS 防护、速率限制、安全整数范围、深层对象比对、空扩展规范化

### 动态向量（26 条）

| 类别 | 数量 | 说明 |
|------|:----:|------|
| Temporal（T-001~T-010） | 10 | 时间段、星期、节假日、闰年、Y2K38 边界 |
| Seeded（S-001~S-008） | 8 | 确定性随机种子，可复现评估 |
| Stateful（ST-001~ST-008） | 8 | 状态机转换（idle→running→paused→error→recovering→stopped） |

### 审计哈希向量（12 条）

| 向量 | 引用 | 用途 |
|------|------|------|
| AV-001 | DO-001 | Ring 0 安全拦截（DENY） |
| AV-002 | DO-013 | PII 合规审批（REQUEST_HUMAN，GDPR Art.22） |
| AV-003 | DO-011 | Override 安全方向（ALLOW，多规则） |
| AV-004 | DO-009 | Ring 0 紧急停止（EMERGENCY_HALT） |
| AV-005 | DO-017 | 低信誉 Agent 升级（ESCALATE） |
| AV-006 | DO-024 | Unless 豁免触发（ALLOW） |
| AV-007 | DO-027 | 空值安全字段访问（PASS） |
| AV-013 | DO-051 | 链位置篡改金丝雀 — previous_hash 指向链外但 hash 按篡改前计算 |
| AV-009 | DO-021 | 自动修正（CORRECT） |
| AV-010 | DO-031 | 异常通知（NOTIFY） |
| AV-011 | DO-038 | 快照回滚（ROLLBACK） |
| AV-012 | DO-051 | 多步工作流（WORKFLOW） |

### v1.3 预留

| ID | 类型 | 状态 |
|----|------|------|
| DO-064 | DELEGATE | v1.3 预留 |

## 五步审计哈希验证

验证算法（白皮书 §13.3）遵循五个确定性步骤：

```
步骤 1：深拷贝 decision_object
步骤 2：删除自引用/签名字段（audit.hash — 保留 previous_hash 和 commitment；signature；signing_key_id）
        （extensions 保留在对象中，直接参与 JCS）
步骤 3：对全部剩余字段进行 JCS（RFC 8785）规范化
步骤 4：对规范化表示进行 SHA-256
步骤 5：将计算哈希与存储的 audit.hash 比较
```

任何走捷径的验证器（如直接比较预计算哈希）将**通过 AV-001~AV-007、AV-009~AV-012 但被 AV-013 金丝雀捕获**——专门用于检测偷懒的实现。

## 合规配置

所有向量内嵌 `erdl-compliance-v1.2` 合规配置，引用以下框架：

| 框架 | 管辖范围 | 生效日期 |
|------|----------|----------|
| EU AI Act（Regulation 2024/1689） | 欧盟 | 2027-12-02 |
| GB/Z 185-2026 | 中国 | 2026-05-22 |
| NIST AI RMF 1.0 | 美国 | 现行 |
| COSO GenAI 2026 | 全球 | 现行 |

完整参考文档见 `knowledge/regulatory/` 目录下的 12 个监管框架。

## 仓库结构

```
erdl-vectors/
├── decision-object-vectors-v1.3.json   # 101 条向量（~813 KB）
├── scripts/
│   ├── generate-vectors.cjs            # 确定性向量生成器
│   └── verify.js                       # 零依赖五步验证器
├── test/
│   ├── generate-comprehensive.test.ts  # 67 项生成器完整性测试
│   └── verify-comprehensive.test.ts    # 86 项 JCS/验证/审计测试
├── docs/
│   ├── RUNNERS-GUIDE.md                # Runner 实现者指南
│   ├── DESIGN-generate-vectors-v1.2.md # 生成器架构设计
│   ├── DESIGN-vector-inventory-v1.2.md # 完整 63 DO 清单
│   ├── DESIGN-verify-js-v1.3.md        # 验证器架构设计
│   ├── WHITEPAPER-v1.3-DRAFT-4.md      # 白皮书（中文版）
│   └── WHITEPAPER-v1.3-DRAFT-4.en.md   # 白皮书（英文版）
├── knowledge/
│   ├── regulatory/                     # 12 个监管框架
│   └── spec/                           # ERDL 规范参考
├── CHANGELOG.md                        # 版本历史
├── CONTRIBUTING.md                     # 贡献指南
├── package.json
├── README.md                           # 本文件（中文版）
└── README.en.md                        # English version
```

## 兼容等级

| 等级 | 要求 | 向量数 |
|:----:|------|:------:|
| **L1 — 基础** | v1.0 Decision Object 结构 + JCS + SHA-256 | 28 |
| **L2 — 已验证** | v1.1 全部向量 + 动态向量 | 45 |
| **L3 — 完整** | v1.2 全部 101 条向量，含链完整性检测 | 101 |

## Runner 实现指南

如果你正在构建 ERDL 规则引擎并希望实现跨实现兼容，请从 **[Runner's Guide](docs/RUNNERS-GUIDE.md)** 开始。它涵盖了五步验证算法、JCS 实现细节、常见陷阱和测试策略——附带了可翻译为任意语言的伪代码。

## 安全

本向量集已通过独立第三方安全审查，涵盖 JCS 正确性、SHA-256 用法、确定性可复现性和密码学安全性。零严重或高危发现。

## 参考资料

- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme（JCS）
- [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562) — Universally Unique IDentifiers（UUID）
- [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) — Secure Hash Standard（SHA-256）
- [ERDL Specification v1.1](https://openoba.github.io/erdl-landing/)
- [IETF Agent Audit Trail](https://datatracker.ietf.org/doc/draft-sharif-agent-audit-trail/)

---

> *"确定性架构，而非 Prompt 工程。中立性靠检验，不靠宣言。"*
>
> — OpenOBA · 2026-07-29 · ERDL Decision Object v1.3
