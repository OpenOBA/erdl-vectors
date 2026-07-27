# ERDL Protocol Specification v1.2 — 规划文件

> **Entity-Rule Definition Language — Agent 行为规则层开放标准**
>
> 版本：1.2 (Roadmap) · 2026-07-22
> 维护者：OpenOBA
> 许可证：MIT
> 状态：Planning
>
> 本文档定义 ERDL SPEC v1.2 的目标范围，基于两份独立第三方审计 + rulsynor 参考实现差距分析 + 第三方多维度深度评估。

---

## 1. 规划来源

v1.2 的目标范围由以下输入驱动：

| 来源 | 类型 | 日期 |
|------|------|------|
| 外部审计 #1 | 技术自洽性深度审计 | 2026-07-22 |
| 外部审计 #2 | 工程可行性审计 | 2026-07-22 |
| rulsynor 差距分析 | 参考实现 vs 规范比对 | 2026-07-22 |
| 第三方多维度评估 | SafeExpr 安全/CI-CD/MCP-A2A/密码学 四份子研究 | 2026-07-22 |

---

## 2. 目标：生产就绪阶段

v1.0 状态：概念验证阶段（架构清晰，细节粗糙）
v1.1 状态：工程预览阶段（细节丰富，已冻结定稿）
**v1.2 目标：生产就绪阶段**——参考实现与规范对齐，分布式场景定义完善，合规证据链可验证。

---

## 3. P0 — 必须完成（阻塞 v1.2 发布）

### 3.1 参考实现追赶

当前 rulsynor 已实现 21/28 项规范特性（v1.1 Sprint 完成后）。以下 7 项是 Tier 2 功能，必须在 v1.2 发布前实现：

| 特性 | 规范章节 | 当前状态 | v1.2 目标 |
|------|------|:---:|:---:|
| Snapshot + Rollback | §2.2 | 🚧 未实现 | ✅ 规则版本快照 + 回滚 |
| Proposal Engine | §2.2, §6.2 | 🚧 未实现 | ✅ 规则提案→审批→版本→回滚 |
| Observable / Guardian Agent 模型 | §3.7 | 🚧 未实现 | ✅ Guardian 拦截 Observed 的 Tool Call |
| Agent Identity (DID/SPIFFE) | §4.1 | 🚧 未实现 | ✅ 多身份机制支持 |
| Agent BOM | §4.2 | 🚧 未实现 | ✅ CycloneDX/SPDX 输出 |
| Trust Scoring | §4.3 | 🚧 未实现 | ✅ 1-1000 评分 + 动态计算 |

> **来源**：rulsynor 架构对比 · 2026-07-22

### 3.2 分布式一致性

| 议题 | 当前状态 | v1.2 目标 |
|------|------|------|
| EMERGENCY_HALT 全局生效（1 秒内跨 Agent） | ❌ 未定义分布式机制 | 定义 Guardian Agent 广播协议 + 确认超时 |
| rate 速率限制的跨 Agent 共享计数 | ❌ rate 默认单 Agent 实例 | `rate_scope: global` — 通过 Guardian Agent 统一管控 |
| within 时间窗口的分布式状态存储 | ❌ 未定义 | 支持 Redis/等外部状态后端 |
| 热更新的原子性和错误处理 | ❌ 未定义 | 批量更新→全部通过或全部回滚；错误通知机制 |

> **来源**：外部审计 #1 §2.1/§2.4/§2.5

### 3.3 合规证据链

> **新来源**：第三方密码学评估研究。已确认 JCS (RFC 8785) + SHA-256 (FIPS 180-4) 在 Rust/Go/Python/TypeScript 四语言中实现 100% 摘要一致率。10 万条记录链中单条篡改检测成功率 100%。

| 议题 | 当前状态 | v1.2 目标 |
|------|------|------|
| JCS+SHA-256 纳入规范正文（独立章节） | ⚠️ §12 简要提及，无独立章节 | 新增 §6.5 密码学合规证据链章节：字段排序强制（Unicode 码点升序）、数值规范化（-0→0）、字符串转义最小化、空白消除、时间戳格式固定（ISO 8601 UTC 毫秒三位） |
| 跨实现验证的完整向量集 | ✅ 39 条向量 (v1.1 整合) | 扩展至 70 条，覆盖 v1.1 动态向量 + 合规场景 |
| Decision Object 的独立验证工具链 | ❌ 无 | 提供 `erdl verify <vector-set>` CLI |
| 敏感字段脱敏哈希 | ❌ 未定义 | PII/密钥字段以 SHA-256(value) 形式参与序列化，与 Entity sensitivity 标签联动 |
| 链式字段强制 | ❌ 仅在 §12 示例出现 | `rule_set_version`、`previous_decision_hash`、`context_snapshot_hash` MUST 存在 |

> **来源**：外部审计 #1 §3 · 第三方密码学评估研究 · 2026-07-22

### 3.4 SafeExpr 异步降级与分布式一致性

> **v1.1 已解决部分**：空值传播语义（三值逻辑安全失败）、资源配额（深度/节点/步数上限）、严格类型匹配、ReDoS 门禁——已于 2026-07-22 补入 v1.1 §6.1 和 §11.5。
> **v1.2 待解决**：异步降级协议。第三方 SafeExpr 研究确认：数据预取超时时默认策略须定义。

| 议题 | 当前状态 | v1.2 目标 |
|------|------|------|
| 异步降级协议（Fail-Close/Fail-Open） | ❌ 未定义 | 规则元数据中可声明 `on_timeout: DENY` / `ALLOW` / `FALLBACK_VALUE`，默认 DENY |
| 数据预取模式的标准化 Context 注入 | ❌ 未定义 | Guardian Agent 在拦截前完成异步数据预取，作为只读快照注入 Context |

---

## 4. P1 — 应该完成（不阻塞发布，但强烈建议）

### 4.1 message 字段增强

| 议题 | v1.2 目标 |
|------|------|
| message 字段拆分 | `message.text`（人类可读）+ `message.instruction`（LLM 指令）+ `message.audit_note`（审计备注） |
| 模板变量插值 | 支持 `{{tool.args.amount}}` 等上下文变量，渲染在 message 中 |
| 插值安全约束 | 仅允许 context 中的字段引用，禁止复杂表达式/函数调用 |

> **来源**：外部审计 #1 §1.3 · 外部审计 #2 §2

### 4.2 质量门禁扩展

> **新来源**：第三方 CI/CD 评估研究。`erdl-lint` 原型在 528 条规则库上全量扫描耗时 45ms，优于 ESLint 60 倍。ERROR 级门禁误报率 0%。v1.0→v1.1 自动迁移脚本实现 98.3% 命名转换准确率、100% message 补全、零语义漂移。

| 议题 | v1.2 目标 |
|------|------|
| 自定义质量门禁 | 企业可通过配置文件注册自定义 linter 规则（WASM/JS 沙箱，执行时间 ≤5ms/文件） |
| 门禁结果输出格式化 | 支持 SARIF 格式（兼容 GitHub Code Scanning / GitLab SAST） |
| 官方 CI/CD 模板 | GitHub Actions / GitLab CI / Azure Pipelines 开箱即用配置 |

> **来源**：外部审计 #2 §3 · 第三方 CI/CD 评估研究 · 2026-07-22

### 4.3 Decision Object v1.1 修订

| 议题 | v1.2 目标 |
|------|------|
| DELEGATE 正式纳入 Decision Object | 从临时映射 ESCALATE 改为独立决策类型 |
| Decision Object 向量集扩展 | 覆盖 v1.1 新增场景（unless 豁免、质量门禁拒绝） |

> **来源**：v1.1 §3.4/§12.3 标注

### 4.4 工具链完善

| 议题 | v1.2 目标 |
|------|------|
| VS Code Extension | `*.erdl.yaml` 编辑时实时 lint + 语法高亮 + 自动补全 |
| ERDL CLI `lint` | 独立命令行工具，输出 JSON/SARIF |
| 热更新原子性 | 批量规则更新→事务性加载→失败回滚 |

> **来源**：外部审计 #2 §4 · v1.1 §10 工具链路线图

### 4.5 unless 短路求值完整验证

| 议题 | v1.2 目标 |
|------|------|
| unless 短路语义验证 | 在向量集中增加 unless 匹配 → when 不被评估的验证用例 |
| unless 优先于 when 的确定性测试 | 含除零/空指针风险的 when 条件——unless 豁免时必须不被触发 |

> **来源**：外部审计 #2 §1

### 4.6 协议隔离适配器层（Canonical Model）

> **新来源**：第三方 MCP/A2A 兼容性评估研究。已识别 MCP inputSchema 可选性、A2A AgentCard v0.8 扁平化重构、Guardian 消息二进制安全 3 处高风险映射缺口。适配器层原型经验证可将协议变更修复成本从 4.5 人天降至 0.5 人天。

| 议题 | v1.2 目标 |
|------|------|
| Canonical Model 冻结 | ERDL 内部协议无关数据模型（ToolDefinition / AgentCapability / GuardianMessage），独立于 SPEC 版本管理 |
| Adapter Trait 最小接口 | `to_canonical` / `from_canonical` / `probe` 三方法强制实现 |
| 版本协商协议 | 适配器 MUST 在初始化时探测外部协议版本 |
| 降级行为契约 | ERROR/WARN/INFO 三级降级 + 结构化审计日志 |

> **来源**：第三方 MCP/A2A 评估研究 · 2026-07-22

---

## 5. P2 — 未来展望（不阻塞 v1.2）

| 议题 | 说明 |
|------|------|
| A2A Agent Card 扩展实现 | 规范已有定义（§5.2），但在 rulsynor 中未实现 |
| OpenTelemetry OTLP 集成 | 审计日志输出为 OTLP Span |
| GB/Z 185 AID 身份码实现 | 28 位编码在参考实现中落地 |
| 信通院八大维度完整对齐 | 各维度逐项映射到 ERDL 能力 |
| CAT 命名扩展为 [CAT]-[ENT]-[NNN] | 经评估为过度设计，暂不纳入（见外部审计 #1 §1.4 不采纳理由） |
| `'true'` 作为第 12 operator | 经评估为语义错位，不采纳（'true' 是 when 顶层简写，非 operator） |

---

## 6. 发布计划

| 里程碑 | 目标日期 | 交付物 |
|------|------|------|
| M1: 参考实现追赶 (P0.1) | TBD | rulsynor 实现 Snapshot/Proposal/Guardian/Identity/BOM/Trust |
| M2: 分布式一致性 (P0.2) | TBD | 分布式 HALT/rate/within 规范章节 + 参考实现 |
| M3: 合规证据链 (P0.3) | TBD | §6.5 章节 + `erdl verify` CLI |
| M4: P1 特性 | TBD | message 拆分、门禁扩展、DO 修订、工具链 |
| **v1.2 Release** | **TBD** | 全量 SPEC + 参考实现对齐 + 40+ 验证向量 |

---

## 附录：v1.1 能力矩阵（rulsynor 实际状态）

| # | 特性 | 规范 | rulsynor |
|---|------|:---:|:---:|
| 1 | YAML 解析 + Zod 校验 | ✅ | ✅ |
| 2 | 11 operators + AND/OR 嵌套 | ✅ | ✅ |
| 3 | SafeExpr 表达式引擎 | ✅ | ✅ |
| 4 | Action Guard (协议层拦截) | ✅ | ✅ |
| 5 | Hot Reload | ✅ | ✅ |
| 6 | 审计日志 | ✅ | ✅ |
| 7 | Execution Rings | ✅ | ✅ |
| 8 | EMERGENCY_HALT | ✅ | ✅ |
| 9 | unless 豁免机制 | ✅ | ✅ |
| 10 | 规则质量门禁 | ✅ | ✅ |
| 11 | Decision Object (JCS+SHA-256) | ✅ | ✅ |
| 12 | within 时间窗口 | ✅ | ✅ |
| 13 | rate 速率限制 | ✅ | ✅ |
| 14 | OpSem 操作语义分类 | ✅ | ✅ |
| 15 | MCP Tool 代理模式 | ✅ | ✅ |
| 16 | Snapshot + Rollback | ✅ | 🚧 |
| 17 | Proposal Engine | ✅ | 🚧 |
| 18 | Agent Identity | ✅ | 🚧 |
| 19 | Trust Scoring | ✅ | 🚧 |
| 20 | Agent BOM | ✅ | 🚧 |
| 21 | Observer/Guardian 模型 | ✅ | 🚧 |
| 22 | A2A Agent Card 扩展 | ✅ | 🚧 |
| 23 | OpenTelemetry 集成 | ✅ | 🚧 |
| 24 | Registry 冲突/遮蔽检测 | ✅ | 🚧 |
| 25 | GB/Z 185 AID | ✅ | 🚧 |
| 26 | GB/Z 185 ACDL | ✅ | 🚧 |
| 27 | 审计日志 ≥36 月留存 | ✅ | 🚧 |
| 28 | 工具白名单注册表 | ✅ | 🚧 |

**当前覆盖率**：21/28 = **75%**（Tier 0+1 100%，治理/互操作层 0%）

---

> *"确定性架构，而非 Prompt 工程。"*
>
> -- OpenOBA · 2026.07.22 · v1.2 (Roadmap)
