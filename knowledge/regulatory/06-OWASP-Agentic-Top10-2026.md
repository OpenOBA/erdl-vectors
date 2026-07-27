# OWASP Top 10 for Agentic Applications (2026)

## 基本信息

- **官方名称**: OWASP Top 10 for Agentic Applications for 2026
- **发布时间**: 2025年12月9日（Black Hat Europe 2025 期间发布），2026年标签
- **发布机构**: OWASP GenAI Security Project
- **官方页面**: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- **性质**: 全球同行评审的安全风险框架

## 核心内容

### 概述

OWASP Top 10 for Agentic Applications 是首个专门针对自主和 Agentic AI 系统的安全风险框架。由100多位行业专家、研究人员和从业者协作开发，识别了 Agentic AI 系统面临的十大最关键安全风险。

**关键区别**: 该框架扩展了 OWASP Top 10 for LLM Applications，但专注于**行动层**而非语言模型层。Agentic AI 不仅仅是生成文本，而是会规划、调用工具、持有记忆、与其他 Agent 交互，并使用真实凭证在真实工作流中行动。

### 十大安全风险 (ASI01-ASI10)

| 代码 | 风险名称 | 主要攻击向量 | 主要控制域 |
|------|----------|--------------|------------|
| **ASI01** | Agent Goal Hijack（Agent 目标劫持） | 恶意内容改变 Agent 的目标或决策路径 | 输入验证、提示安全 |
| **ASI02** | Tool Misuse and Exploitation（工具滥用和利用） | Agent 被操纵滥用合法工具 | 最小权限、沙箱 |
| **ASI03** | Identity and Privilege Abuse（身份和权限滥用） | 继承或缓存的凭证被利用 | Agent 身份、PKI、短期凭证 |
| **ASI04** | Agentic Supply Chain Vulnerabilities（供应链漏洞） | 被篡改的工具、模型或提示模板破坏执行 | 依赖审查、来源验证 |
| **ASI05** | Unexpected Code Execution（意外代码执行） | Agent 生成或运行攻击者控制的代码 | 沙箱、出口控制 |
| **ASI06** | Memory and Context Poisoning（记忆和上下文投毒） | 持久化破坏记忆或 RAG 存储 | 记忆验证、分段隔离 |
| **ASI07** | Insecure Inter-Agent Communication（不安全的 Agent 间通信） | Agent 间消息被伪造、重放或篡改 | 双向认证、消息完整性 |
| **ASI08** | Cascading Agent Failures（级联 Agent 故障） | 小错误在 Agent 间传播和放大 | 断路器、输出验证 |
| **ASI09** | Human-Agent Trust Exploitation（人-Agent 信任利用） | 用户过度信任有说服力的 Agent 并批准有害操作 | 带外同意 |
| **ASI10** | Rogue Agents（流氓 Agent） | 受损或失调的 Agent 看似合法地有害行动 | 行为监控、Agent 身份 |

### 各风险详解

#### ASI01: Agent Goal Hijack（Agent 目标劫持）

**攻击向量**: 攻击者通过在 Agent 读取的内容中植入恶意指令来重定向 Agent 的目标——工具输出、检索文档、电子邮件或外部页面。

**缓解措施**:
- 将所有 Agent 消费的内容视为不可信
- 将可信指令与检索数据分离
- 在工具输出影响规划前进行验证
- 将 Agent 限制在定义的目标范围内
- **最小代理原则**: 自主权应为任务而获得，而非默认授予

#### ASI02: Tool Misuse and Exploitation（工具滥用和利用）

**攻击向量**: 工具是合法的，但 Agent 通过提示注入、失调或不安全委托被说服以有害方式使用工具。

**缓解措施**:
- 对所有工具权限强制执行最小权限
- 根据严格模式验证每个高影响工具操作
- 监控异常工具使用模式

#### ASI03: Identity and Privilege Abuse（身份和权限滥用）

**攻击向量**: Agent 继承高权限凭证，这些凭证可被重用、升级或在 Agent 间传递而无适当范围限制。

**缓解措施**:
- 使用短期、任务范围的凭证，绝不使用长期令牌
- 将 Agent 视为需要显式范围权限的特权非人类身份 (NHI)
- 实施凭证轮换和吊销机制

#### ASI04-ASI10

（详见 OWASP 官方文档获取完整描述）

### 风险链示例

单个受损的 Agent 部署可能同时暴露多个风险：

- **EchoLeak Chain (ASI01 + ASI02 + ASI03)**: 通过邮件的目标劫持 → Agent 滥用邮件工具 → 使用用户继承凭证 → 数据泄露
- **Supply Chain Cascade (ASI04 + ASI05 + ASI08)**: 受损 MCP 服务器 → 任意代码执行 → 通过下游 Agent 传播

## 与审计日志/决策记录/AI Agent 行为相关的要求

### 审计日志要求

- **行为监控**: 跟踪 Agent 访问的操作、工具和数据源类型，并对偏离既定模式发出警报（ASI10）
- **工具使用日志**: 记录所有工具调用及其参数（ASI02）
- **身份验证日志**: 记录 Agent 身份验证和凭证使用（ASI03）
- **通信日志**: 记录 Agent 间的所有消息交换（ASI07）
- **异常检测**: 监控和记录异常行为模式（ASI08, ASI10）

### 决策记录要求

- **目标变更**: 要求人工批准任何执行期间的目标变更（ASI01）
- **高影响操作**: 对敏感操作实施强制确认和冷静期（ASI09）
- **人工干预点**: 记录决策过程中的人工干预和覆盖
- **不确定性度量**: 显示 AI 不确定性指标（ASI09）

### AI Agent 行为相关

- **Kill Switch**: 部署物理隔离的终止开关（不可协商、可审计）（ASI10）
- **沙箱**: 限制潜在流氓 Agent 在检测问题前可以访问的内容（ASI02, ASI05, ASI10）
- **最小权限**: 每个 Agent 只能做其任务所需的内容（ASI01, ASI02, ASI03, ASI05）
- **双向认证**: Agent 间通信需要双向身份验证（ASI07）
- **凭证管理**: 短期、任务范围的凭证（ASI03）
- **断路器**: 防止级联故障（ASI08）

### 实施优先级

| 优先级 | 行动 | 解决的风险 |
|--------|------|------------|
| 1 | **盘点 Agent 及其凭证** | ASI03 |
| 2 | **限制自主权和工具范围** | ASI01, ASI02, ASI05 |
| 3 | **强化输入和记忆** | ASI06, ASI01 |
| 4 | **保护 Agent 间通信** | ASI07 |
| 5 | **实施行为监控** | ASI08, ASI10 |

## 适用行业

- **所有使用 Agentic AI 的行业**，包括:
  - 软件开发（代码 Agent）
  - 金融服务（交易 Agent）
  - 客户支持（对话 Agent）
  - IT 运维（自动化 Agent）
  - 企业工作流自动化

## 处罚措施

- OWASP 框架为**自愿性最佳实践**，无直接法律处罚
- 但已成为:
  - 采购团队要求供应商覆盖特定风险的依据
  - 审计师要求供应商映射控制的基准
  - 安全工具供应商宣传解决哪些风险的参考
  - 行业安全评估的事实标准

## 关键引用

> "An agentic AI system does not just answer a prompt. It plans, calls tools, holds memory, talks to other agents, and acts with real credentials across live workflows."
> — OWASP GenAI Security Project

> "A prompt injection against a chatbot produces bad text. A prompt injection against an agent triggers unauthorized API calls, data exfiltration, and destructive operations."
> — OWASP Agentic Security Initiative

---

**文档来源**: OWASP GenAI Security Project 官方, arnav.au, securew2.com, startupdefense.io, paperclipped.de  
**最后更新**: 2026-07-27
