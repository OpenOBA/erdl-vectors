# NIST AI Risk Management Framework (AI RMF 1.0)

## 基本信息

- **官方名称**: NIST AI 100-1, Artificial Intelligence Risk Management Framework (AI RMF 1.0)
- **发布时间**: 2023年1月26日
- **发布机构**: 美国国家标准与技术研究院 (NIST)
- **官方文本**: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
- **配套资源**: https://www.nist.gov/itl/ai-risk-management-framework

## 核心框架 — 四大功能 (Core Functions)

AI RMF 的"Core"由四个高层功能组成：**GOVERN**、**MAP**、**MEASURE**、**MANAGE**。每个功能进一步分解为类别 (Categories) 和子类别 (Subcategories)。

### 1. GOVERN（治理）— 横切功能

The GOVERN function:
- Cultivates and implements a culture of risk management within organizations designing, developing, deploying, evaluating, or acquiring AI systems
- Is designed to be a **cross-cutting function** to inform and be infused throughout the other three functions

**类别与子类别**:

| 类别 | 子类别 |
|------|--------|
| **GOVERN 1**: 组织内 AI 风险映射、测量和管理的政策、流程、程序和惯例到位、透明且有效实施 | GOVERN 1.1: 理解和记录法律法规要求 |
| | GOVERN 1.2: 可信 AI 特征融入风险管理政策 |
| **GOVERN 2**: 问责结构到位，适当团队和个人被授权、负责并接受培训 | GOVERN 2.1: 角色、职责和沟通线路记录清楚 |
| | GOVERN 2.2: 人员和合作伙伴接受 AI 风险管理培训 |
| | GOVERN 2.3: 执行领导层对 AI 系统开发和部署的风险决策负责 |
| **GOVERN 3**: 劳动力多样性、公平、包容和无障碍流程在 AI 风险管理全生命周期中被优先考虑 | GOVERN 3.1-3.2 |
| **GOVERN 4**: 组织的 AI 风险管理和治理方法由受影响社区、用户和客户的反馈和体验所塑造 | GOVERN 4.1-4.3 |
| **GOVERN 5**: 组织角色、职责和问责制被记录，并在 AI 系统生命周期内适当实施和执行 | GOVERN 5.1-5.2 |
| **GOVERN 6**: 政策、程序和惯例实施到位，以管理第三方实体提供的 AI 系统或数据，以及相关风险 | GOVERN 6.1-6.2 |

### 2. MAP（映射）

The MAP function:
- Establishes and understands context
- Informs an initial go/no-go decision about whether to design, develop, or deploy an AI system

| 类别 | 子类别 |
|------|--------|
| **MAP 1**: 建立和理解上下文 | MAP 1.1: 记录预期目的、潜在有益用途、上下文特定法律和期望 |
| **MAP 2**: AI 系统的分类范围被识别 | MAP 2.1-2.3 |
| **MAP 3**: AI 系统的影响被识别和分析 | MAP 3.1-3.4 |
| **MAP 4**: AI 系统的风险被识别、分析和优先级排序 | MAP 4.1-4.3 |
| **MAP 5**: AI 系统的利益被识别和分析 | MAP 5.1-5.2 |

### 3. MEASURE（测量）

The MEASURE function:
- Employs quantitative, qualitative, or mixed-methods tools and approaches to assess and analyze AI risks

| 类别 | 子类别 |
|------|--------|
| **MEASURE 1**: 可信 AI 特征被衡量和评估 | MEASURE 1.1-1.4 |
| **MEASURE 2**: AI 系统风险被衡量和分析 | MEASURE 2.1-2.13 |
| | MEASURE 2.7: AI 系统安全和韧性被评估和记录 |
| | MEASURE 2.8: 透明度和问责风险被检查和记录 |
| | MEASURE 2.9: AI 模型被解释、验证和记录 |
| | MEASURE 2.10: AI 系统的隐私风险被检查和记录 |
| | MEASURE 2.11: 公平性和偏见被评估，结果被记录 |
| **MEASURE 3**: AI 系统利益被衡量和分析 | MEASURE 3.1-3.2 |
| **MEASURE 4**: AI 系统监控被实施 | MEASURE 4.1-4.3 |

### 4. MANAGE（管理）

The MANAGE function:
- Entails allocating risk resources to mapped and measured risks on a regular basis and as defined by the GOVERN function
- Risk treatment comprises plans to respond to, recover from, and communicate about incidents or events

| 类别 | 子类别 |
|------|--------|
| **MANAGE 1**: AI 风险被优先排序并响应 | MANAGE 1.1-1.4 |
| **MANAGE 2**: AI 风险被监控和管理 | MANAGE 2.1-2.3 |
| **MANAGE 3**: AI 事件被处理和沟通 | MANAGE 3.1-3.2 |
| **MANAGE 4**: AI 系统退役和终止 | MANAGE 4.1-4.2 |

## 可信 AI 特征 (Trustworthy AI Characteristics)

AI RMF 定义了 AI 系统应具有的七个特征:

1. **Validated and Reliable（经过验证和可靠的）**
2. **Safe（安全的）**
3. **Secure and Resilient（安全和有韧性的）**
4. **Accountable and Transparent（负责任和透明的）**
5. **Explainable and Interpretable（可解释和可理解的）**
6. **Privacy-Enhanced（隐私增强的）**
7. **Fair — with Harmful Biases Managed（公平的——管理有害偏见）**

## 与审计日志/决策记录/AI Agent 行为相关的要求

### 审计日志相关

- **GOVERN 5.2**: 组织的问责制被记录，并在 AI 系统生命周期内适当实施
- **MEASURE 2.7**: AI 系统安全和韧性被评估和**记录**
- **MEASURE 2.8**: 透明度和问责风险被检查和**记录**
- **MEASURE 2.9**: AI 模型被解释、验证和**记录**
- **MEASURE 2.10**: 隐私风险被检查和**记录**
- **MEASURE 2.11**: 公平性和偏见被评估，结果被**记录**
- **MEASURE 4.2**: AI 系统性能监控结果被**记录**

### 决策记录相关

- **MAP 3.1-3.4**: AI 系统影响被识别和分析（需要记录）
- **MAP 4.1-4.3**: 风险被识别、分析和优先级排序（需要记录）
- **MANAGE 1.1-1.4**: AI 风险被优先排序并响应（需要记录决策理由）
- **MANAGE 3.1-3.2**: AI 事件被处理和沟通（需要记录事件处理过程）

### AI Agent 行为相关

- **GOVERN 2.1**: 角色、职责和沟通线路记录清楚
- **GOVERN 6**: 第三方实体提供的 AI 系统的风险管理
- **MANAGE 2**: AI 风险被监控和管理（包括 Agent 行为的持续监控）
- **MANAGE 3**: AI 事件被处理和沟通（Agent 行为异常的报告机制）

## 适用行业

- **所有行业**（自愿性框架，无强制性适用要求）
- 特别推荐用于:
  - 开发和部署 AI 系统的组织
  - 使用 AI 进行决策的组织
  - 金融、医疗、政府、教育等关键领域

## 处罚措施

- **NIST AI RMF 是自愿性框架**，无直接法律处罚
- 但被广泛引用为监管合规的参考标准
- 遵守 NIST AI RMF 可在 Colorado SB 205 等法规下提供"安全港"保护
- 可作为诉讼中"合理注意"的证据

## 与其他框架的关系

- 已被映射到 ISO/IEC 42001
- 已被映射到 EU AI Act
- 与新加坡 Model AI Governance Framework 对齐
- Colorado SB 205 明确引用为认可的 AI 风险管理框架

---

**文档来源**: NIST AI 100-1 官方 PDF, AIRC (airc.nist.gov), NIST AI RMF Playbook  
**最后更新**: 2026-07-27
