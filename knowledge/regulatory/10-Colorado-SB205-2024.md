# Colorado SB 24-205 — Consumer Protections for Artificial Intelligence

## 基本信息

- **官方名称**: Colorado Senate Bill 24-205 — Consumer Protections for Artificial Intelligence Act
- **签署时间**: 2024年5月17日（Governor Jared Polis 签署）
- **原生效时间**: 2026年2月1日
- **延后生效时间**: 2026年6月30日（2025年8月28日修正案）
- **执法机构**: Colorado Attorney General（独占执法权）
- **官方页面**: https://leg.colorado.gov/bills/sb24-205
- **法案文本**: https://leg.colorado.gov/sites/default/files/2024a_205_signed.pdf

## 核心内容

### 概述

Colorado SB 205 是美国首个全面的州级 AI 监管框架，监管用于"consequential decisions"（重大决策）的"high-risk artificial intelligence systems"（高风险 AI 系统）。该法律对开发者和部署者施加风险管理、影响评估、消费者披露和向 Attorney General 报告的义务。

### 关键定义

**Artificial Intelligence System（人工智能系统）**:
> "Any machine-based system that, for any explicit or implicit objective, infers from inputs it receives how to generate outputs including content, decisions, predictions, or recommendations that can influence physical or virtual environments."

**High-Risk AI System（高风险 AI 系统）**:
> "Any AI system that, when deployed, makes or is a substantial factor in making a consequential decision."

**Consequential Decision（重大决策）**:
对消费者在以下领域的获取或条件产生实质性法律效果或类似重大影响的决策：
- 教育入学或机会
- 就业或就业机会
- 金融或贷款服务
- 基本政府服务
- 医疗服务
- 住房
- 保险
- 法律服务

### 开发者义务 (Developer Obligations)

| 义务 | 说明 |
|------|------|
| **合理注意义务** | 对已知或可合理预见的算法歧视风险使用合理注意 |
| **系统信息文档** | 创建关于预期用途、已知风险、训练数据和歧视测试能力的文档 |
| **公开 AI 系统摘要** | 公开发布所提供的高风险 AI 系统摘要 |
| **歧视测试信息** | 提供信息使部署者能够在特定部署环境中测试算法歧视 |
| **已知风险记录** | 在整个系统商业可用期间保持已知风险和缓解措施的记录 |

### 部署者义务 (Deployer Obligations)

| 义务 | 说明 |
|------|------|
| **风险管理政策** | 建立治理程序、员工培训和技术保障 |
| **影响评估** | 在部署前记录系统目的、预期用途、已知风险和歧视测试结果 |
| **消费者披露** | 在 AI 辅助的重大决策前告知消费者，并提供人工审查选项 |
| **不利决策解释** | 当 AI 导致不利决策时，解释主要原因、描述使用的数据类型，并提供上诉或更正机会 |
| **有意义的人工监督** | 确保员工理解系统限制并能干预以防止算法歧视 |
| **公开政策披露** | 公开发布部署者关于高风险 AI 系统使用的政策 |
| **AG 通知** | 当高风险 AI 系统涉及歧视指控时通知 Attorney General |

### 安全港条款 (Safe Harbor)

- 遵守全国或国际认可的 AI 风险管理框架（如 NIST AI RMF、ISO 标准）可创建**合理注意的可反驳推定**
- 这激励组织采用结构化治理方法

## 与审计日志/决策记录/AI Agent 行为相关的要求

### 审计日志要求

- **影响评估记录**: 必须在部署前完成并保留
- **歧视测试结果**: 记录算法歧视测试的结果
- **不利决策日志**: 当 AI 导致不利决策时，必须记录:
  - 决策的主要原因
  - AI 对决策的影响
  - AI 工具使用的数据
  - 数据来源
- **持续合规记录**: 定期审查高风险 AI 系统的合规性
- **文档保留**: 使用期间加上停用后3年

### 决策记录要求

| 要求 | 说明 |
|------|------|
| **不利决策解释** | 必须向消费者解释 AI 辅助的不利决策 |
| **人工审查机会** | 提供人工审查和更正的机会 |
| **风险缓解决策** | 记录选择的风险缓解措施及理由 |
| **系统修改决策** | 当系统被实质性修改时更新影响评估 |
| **上诉机制** | 为消费者提供上诉 AI 决策的渠道 |

### AI Agent 行为相关

- **算法歧视防范**: AI Agent 做出重大决策时需要防范算法歧视
- **有意义的人工监督**: 确保人工可以理解 Agent 的决策过程并干预
- **透明度**: 向消费者披露 AI Agent 的使用
- **行为监控**: 持续监控 Agent 的行为以发现歧视模式
- **问责**: 当 Agent 行为导致歧视时通知 Attorney General

### 消费者权利

| 权利 | 说明 |
|------|------|
| **知情权** | 在 AI 辅助的重大决策前被通知 |
| **解释权** | 获得不利决策的解释 |
| **上诉权** | 对不利决策提出上诉或更正 |
| **退出画像权** | 退出 AI 驱动的画像 |

## 适用行业

- **在 Colorado 开展业务的实体**，使用 AI 进行重大决策的:
  - 就业（招聘、晋升、解雇）
  - 教育（入学、奖学金）
  - 金融服务（贷款、信用评分）
  - 医疗保健（诊断、治疗推荐）
  - 住房（租赁、购房）
  - 保险（承保、定价）
  - 法律服务

## 处罚措施

| 违规类型 | 处罚 |
|----------|------|
| **不公平贸易行为** | 违反 SB 205 要求构成 Colorado 消费者保护法下的不公平贸易行为 |
| **AG 执法** | Attorney General 可以:
  - 调查和起诉
  - 要求民事罚款
  - 寻求禁令救济 |
| **通知-纠正期** | 2026年3月修正案草案提议90天通知和纠正期 |

### 立法动态

| 日期 | 事件 |
|------|------|
| 2024年1月 | SB24-205 在 Colorado 议会提出 |
| 2024年5月8日 | 法案通过两院 |
| 2024年5月17日 | Governor Polis 签署成为法律 |
| 2024-2025 | AG 关于歧视测试和框架认可的规则制定 |
| 2025年8月28日 | 修正案将生效日期延后至2026年6月30日 |
| 2026年3月 | 工作组草案提议更实质性的修订（ADMT 焦点），重置生效日期至2027年1月1日 |
| **2026年6月30日** | **当前法律生效日期** |

> **注意**: 截至2026年7月，Colorado 正在考虑将法律从"高风险 AI"框架转向更窄的"自动决策技术 (ADMT)"焦点模型。组织应继续按当前框架准备合规，同时关注立法发展。

## 关键引用

> "On and after February 1, 2026, the act requires a developer of a high-risk artificial intelligence system to use reasonable care to protect consumers from any known or reasonably foreseeable risks of algorithmic discrimination."
> — SB24-205

> "When AI contributes to adverse decisions, deployers must explain the principal reasons, describe data types used, and provide appeal or correction opportunities."
> — SB24-205

---

**文档来源**: Colorado General Assembly 官方, regulations.ai, Cooley LLP (2026-04-24), Littler (2024-05-16), American Bar Association (2024-07-23)  
**最后更新**: 2026-07-27
