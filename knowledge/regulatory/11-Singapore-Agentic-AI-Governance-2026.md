# 新加坡 Model AI Governance Framework for Agentic AI (MGF) — 2026

## 基本信息

- **官方名称**: Model AI Governance Framework for Agentic AI (MGF for Agentic AI)
- **发布时间**: 2026年1月22日（World Economic Forum 2026, Davos）
- **发布机构**: Infocomm Media Development Authority (IMDA)，新加坡资讯通信媒体发展局
- **主管部门**: Ministry of Digital Development and Information (MDDI)
- **官方页面**: https://www.imda.gov.sg/about-imda/emerging-technologies-and-research/artificial-intelligence
- **反馈渠道**: https://go.gov.sg/mgfagentic-feedback
- **性质**: 全球首个专门针对 Agentic AI 的治理框架（非强制性最佳实践）

## 核心内容

### 概述

MGF for Agentic AI 是全球首个专门针对能够自主规划、推理和行动的 AI Agent 的治理框架。它在2020年推出的 MGF for AI 基础上构建，解决 AI 系统被授权在数字或物理环境中采取自主行动时产生的新风险。

**关键区别**: 与仅输出文本、图像或预测的模型不同，Agentic AI 可以:
- 将任务分解为子任务
- 选择工具
- 执行行动
- 适应实时反馈

### 四维治理方法

#### 维度 1: Assess and Bound Risks Upfront（前置评估和风险界定）

**核心要求**:
- 组织应进行**用例特定的风险评估**，考虑 Agentic 特定因素:
  - 自主程度 (autonomy level)
  - 对敏感数据的访问 (access to sensitive data)
  - 可用数据的广度 (breadth of available data)
- **通过设计界定风险** (bounding risks by design):
  - 限制 Agent 的工具访问
  - 限制权限
  - 限制操作环境
  - 限制可采取的行动范围
- 这些是防止意外或有害行动的**第一道防线**

#### 维度 2: Make Humans Meaningfully Accountable（使人类有意义地负责）

**核心要求**:
- **人类始终最终负责** (humans are ultimately accountable)
- 建立有意义的人工监督机制
- 确保问责链条清晰
- 人工应能够理解和干预 Agent 的决策

#### 维度 3: Implement Technical Controls and Processes（实施技术控制和流程）

**核心要求**:
- 实施技术保障措施
- 建立生命周期管理流程
- 确保系统安全性和可靠性
- 包括监控、测试和验证机制

#### 维度 4: Enable End-User Responsibility（使终端用户能够负责）

**核心要求**:
- 为终端用户提供理解和控制 Agent 行为的工具
- 透明度和可解释性
- 用户同意和选择权
- 投诉和救济机制

### 与早期框架的关系

| 框架 | 发布时间 | 焦点 |
|------|----------|------|
| MGF for AI (v1) | 2020 | 传统 AI |
| MGF for Generative AI | 2024 | 生成式 AI |
| **MGF for Agentic AI** | **2026** | **Agentic AI** |

## 与审计日志/决策记录/AI Agent 行为相关的要求

### 审计日志要求

- **工具访问日志**: 记录 Agent 访问的所有工具和权限
- **操作环境日志**: 记录 Agent 的操作环境范围
- **行动日志**: 记录 Agent 采取的所有行动
- **决策日志**: 记录 Agent 的决策过程和理由
- **异常日志**: 记录偏离预期行为的情况
- **人工干预日志**: 记录人工监督和干预的情况

### 决策记录要求

- **风险评估记录**: 用例特定的风险评估，包括自主程度、数据访问和行动范围
- **风险界定决策**: 通过设计界定风险的决策（工具限制、权限限制、环境限制）
- **人工问责分配**: 记录谁对 Agent 的行为负责
- **技术控制选择**: 记录选择的技术控制措施及理由
- **用户责任机制**: 记录为终端用户提供的控制和透明度机制

### AI Agent 行为相关

| 治理维度 | Agent 行为要求 |
|----------|----------------|
| **风险界定** | 限制 Agent 的工具访问、权限、操作环境和行动范围 |
| **人工问责** | 确保人类能够理解、监督和干预 Agent 行为 |
| **技术控制** | 实施监控、测试、验证和生命周期管理 |
| **用户责任** | 为终端用户提供透明度和控制权 |

### Agent 特定风险

MGF 识别的 Agentic AI 特定风险:

| 风险类别 | 说明 |
|----------|------|
| **未经授权的行动** | Agent 执行超出授权范围的行动 |
| **有偏见的行动** | Agent 的自主决策产生歧视性结果 |
| **错误行动** | Agent 因误解或错误推理采取错误行动 |
| **数据泄露** | Agent 访问敏感个人数据导致泄露 |
| **系统破坏** | Agent 更改操作系统导致中断 |
| **级联故障** | 一个 Agent 的错误传播到其他连接的 Agent |

## 适用行业

- **所有在新加坡部署 Agentic AI 的组织**，包括:
  - 金融服务（银行、保险）
  - 医疗保健
  - 政府服务
  - 电信
  - 零售和电子商务
  - 物流和供应链
  - 制造业

## 处罚措施

- **非强制性框架**: MGF 不施加具有法律约束力的义务
- 但提供:
  - 新加坡监管方向的强烈指示
  - 行业采用的最佳实践
  - 未来立法的参考基础
- 组织应将 MGF 视为:
  - 监管预期合规的指南
  - 负责任 AI 部署的行业标准
  - 与 IMDA 和 PDPC 合作的基准

## 与其他框架的关系

| 框架 | 关系 |
|------|------|
| **新加坡 MGF for AI (2020)** | MGF Agentic 是其 Agentic 扩展 |
| **NIST AI RMF** | 互补的风险管理方法 |
| **EU AI Act** | MGF 更灵活，基于原则而非规则 |
| **ISO/IEC 42001** | MGF 提供 Agentic 特定的指导 |
| **OWASP Agentic Top 10** | MGF 提供治理框架，OWASP 提供安全风险清单 |

## 关键引用

> "Unlike models that only output text, images or predictions, agentic AI can break tasks into subtasks, select tools, execute actions and adapt to real-time feedback."
> — IMDA, MGF for Agentic AI (2026)

> "Singapore's newly released MGF provides the first comprehensive guidance for managing AI systems capable of autonomous planning, reasoning and action."
> — Baker McKenzie (2026-01-29)

> "The framework is first in the world to include a comprehensive guide for enterprises to deploy Agentic AI responsibly."
> — MDDI Press Release (2026-01-22)

## 公众咨询

框架目前开放公众反馈:
- **反馈链接**: https://form.gov.sg/696863b064be73e344d1a26b
- **案例研究**: IMDA 邀请组织贡献其 Agentic 治理经验的案例研究

---

**文档来源**: MDDI 官方新闻稿 (2026-01-22), IMDA 官方, Baker McKenzie (2026-01-29), Hogan Lovells (2026-01-27), regulations.ai  
**最后更新**: 2026-07-27
