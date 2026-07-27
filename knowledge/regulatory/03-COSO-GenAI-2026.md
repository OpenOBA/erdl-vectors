# COSO — Achieving Effective Internal Control Over Generative AI (2026)

## 基本信息

- **官方名称**: Achieving Effective Internal Control Over Generative AI
- **发布时间**: 2026年2月23日（COSO 官方发布），2026年3-4月各大机构解读
- **发布机构**: Committee of Sponsoring Organizations of the Treadway Commission (COSO)
- **基础框架**: COSO Internal Control — Integrated Framework (ICIF, 2013)
- **官方页面**: https://www.coso.org/generative-ai

## 核心内容

### 概述

COSO GenAI 指导文件将 COSO 2013 内部控制整合框架（ICIF）应用于生成式 AI 用例，提供了一种基于能力的方法（capability-based approach）来管理 GenAI 的新风险。

### 八大 GenAI 能力分类 (Capability-First Taxonomy)

COSO 将 GenAI 用例分为八个能力类别:

| # | 能力 | 说明 |
|---|------|------|
| 1 | **Ingestion（摄入）** | 数据提取和摄入 |
| 2 | **Transformation（转换）** | 自动化交易处理和对账 |
| 3 | **Posting（过账）** | 数据写入和记录 |
| 4 | **Orchestration（编排）** | 工作流编排和自主任务执行 |
| 5 | **Judgment（判断）** | 洞察生成和决策支持 |
| 6 | **Monitoring（监控）** | AI 驱动的监控和持续审查 |
| 7 | **Knowledge Retrieval（知识检索）** | 知识获取和 RAG |
| 8 | **Human-AI Interaction（人机交互）** | 人类与 AI 协作 |

### COSO 五要素 × GenAI 对齐

每个能力类别都与 COSO 框架的五个内部控制要素对齐：

| COSO 要素 | 说明 |
|-----------|------|
| **Control Environment（控制环境）** | 组织的治理结构、道德价值观、胜任能力 |
| **Risk Assessment（风险评估）** | 识别和分析 GenAI 相关风险 |
| **Control Activities（控制活动）** | 确保管理层指令被执行政策和程序 |
| **Information & Communication（信息与沟通）** | 支持其他要素运作的信息系统 |
| **Monitoring Activities（监控活动）** | 评估内部控制在时间上运行质量的流程 |

### 六步实施路线图

COSO GenAI 指导提供六步实施路线图:

1. **Govern（治理）**: 建立问责、控制和升级协议，确保对包括"影子 AI"在内的所有 GenAI 用例的一致监督
2. **Inventory（盘点）**: 维护 GenAI 用例清单，将范围内用例映射到关键业务流程、相关断言和关键控制
3. **Assess（评估）**: 应用基于用例的决策框架，根据每个用例的风险概况确定人工参与程度
4. **Design（设计）**: 实施 COSO 对齐的控制"构建块"
5. **Implement（实施）**: 对财务相关的 GenAI 用例应用更高的严格程度
6. **Monitor（监控）**: 确保适当的沟通、对齐和文档

### 控制构建块 (Control Building Blocks)

| 控制类型 | 内容 |
|----------|------|
| 访问和可接受使用限制 | 包括供应商工具和插件 |
| 输入/数据控制和检索约束 | 确保数据质量和安全 |
| 提示/配置治理和变更控制 | Prompt 版本管理和审批 |
| 输出验证和异常处理 | 包括输出的接受和问责 |
| **日志/可追溯性** | **模型/版本、提示、关键输入/输出、审批** |
| 监控控制 | 漂移、异常和未授权使用的检测 |

## 与审计日志/决策记录/AI Agent 行为相关的要求

### 审计日志要求

- **日志/可追溯性**: 模型/版本、提示 (prompts)、关键输入/输出、审批记录
- **监控控制**: 漂移检测、异常检测、未授权使用检测
- **审计就绪控制映射**: 每个能力类别包括嵌入示例、最低控制期望和用于运营监控和审计证据收集的说明性指标
- **文档保留**: 风险评估矩阵、控制测试程序和指标仪表板

### 决策记录要求

- **人工参与程度**: 基于风险概况确定人工审查、审批和职责分离
- **输出验证**: 对 GenAI 输出的接受和问责记录
- **升级协议**: 清晰的问责路径和升级机制
- **影子 AI 治理**: 发现和管理组织内未授权的 AI 使用

### AI Agent 行为相关

- **编排 (Orchestration)**: 工作流编排和自主任务执行的控制
- **人机交互**: 人类与 AI 协作的控制
- **判断 (Judgment)**: AI 辅助决策的验证和审批
- **财务影响**: 对可能影响财务报表金额的 GenAI 输出应用更高级别的监督

## 适用行业

- **所有使用 GenAI 的组织**，特别是:
  - 财务报告相关流程（ICFR）
  - 运营和合规功能
  - 高风险决策领域
  - 上市公司（SOX 合规要求）

## 处罚措施

- COSO 本身不具有执法权力
- 但作为 SEC 和 PCAOB 认可的内控框架
- 不遵守可能导致:
  - 审计意见不合格
  - 财务报告重述
  - SEC 执法行动
  - 投资者诉讼

## 关键引用

> "GenAI introduces risks that evolve as quickly as the technology, itself. By grounding GenAI governance in COSO's established internal control principles, organizations can build systems that are both adaptable and audit ready."
> — David Wood, Professor, Brigham Young University (COSO 新闻稿)

> "Generative AI is transforming how organizations work, make decisions, and manage information."
> — Lucia Wind, Executive Director and Chair of COSO

---

**文档来源**: COSO 官方, Deloitte Heads Up (April 3, 2026), IIA Internal Auditor (March 11, 2026), KPMG Defining Issues (April 2026)  
**最后更新**: 2026-07-27
