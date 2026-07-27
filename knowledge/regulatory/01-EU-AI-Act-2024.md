# EU AI Act — Regulation (EU) 2024/1689

## 基本信息

- **官方名称**: Regulation (EU) 2024/1689 of the European Parliament and of the Council laying down harmonised rules on artificial intelligence (Artificial Intelligence Act)
- **发布时间**: 2024年6月13日（官方公报发布），2024年8月1日生效
- **立法机构**: 欧盟议会与欧盟理事会
- **官方文本**: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202401689

## 核心条款摘要（重点 Article 12, 13, 14）

### Article 12 — Record-keeping（记录保存）

Article 12 establishes mandatory record-keeping requirements for high-risk AI systems:

- **自动记录**: 高风险 AI 系统必须设计为具备自动记录事件（日志）的能力，贯穿其整个运营生命周期
- **日志内容最低要求**:
  - 每次使用的持续时间
  - 输入数据所对照的参考数据库
  - 导致特定输出的输入数据
  - 参与结果验证的自然人身份
- **目的**: 支持上市后监控（Article 72）和事故调查（Article 73）
- **保留期限**: 需保留至履行法规义务所需的期限

### Article 13 — Transparency and provision of information to deployers（透明度与信息提供）

Article 13 requires high-risk AI systems to be "designed and developed in such a way as to ensure that their operation is sufficiently transparent to enable deployers to interpret a system's output and use it appropriately."

核心要求包括：
- **量化精度指标**: 不是"高精度"，而是具体数字和测量方法
- **已知限制**: 记录失败模式、边缘案例和性能退化条件
- **系统能力与限制信息**: 包括准确性、鲁棒性和网络安全水平
- **日志收集机制**: 描述允许部署者正确收集、存储和解释日志的机制

### Article 14 — Human oversight（人工监督）

Article 14 requires high-risk AI systems to be designed to allow effective human oversight:

- 系统必须能够被自然人有效监督
- 监督人员需理解系统的能力和限制
- 能够干预以防止算法歧视
- 具备停止或覆盖系统决策的能力

## 与审计日志/决策记录/AI Agent 行为相关的要求

### 审计日志要求

| 条款 | 要求 | 合规截止日 |
|------|------|------------|
| Art. 12 | 自动事件记录（日志）贯穿运营生命周期 | 2026年8月2日 |
| Art. 13(1)(f) | 描述日志收集、存储和解释机制 | 2026年8月2日 |
| Art. 19 | 自动生成日志的技术要求 | 2026年8月2日 |
| Art. 72 | 上市后监控依赖运营日志 | 2026年8月2日 |

### 决策记录要求

- **可解释性**: 部署者必须能够解释任何特定输出的产生过程
- **响应级治理**: 每次 AI 交互都应产生治理记录
- **确定性测量**: 合规评分工具本身必须可审计

### AI Agent 行为相关

- **人工监督**: 高风险系统必须允许有效的人工干预
- **透明度**: 系统操作必须足够透明，使部署者能适当使用输出
- **责任链**: 从提供商到部署者的责任传递需要完整的文档链

## 适用行业

- **所有在欧盟市场投放或投入服务的高风险 AI 系统**
- 重点行业（Annex III 高风险类别）:
  - 生物识别识别和分类
  - 关键基础设施管理
  - 教育和职业培训
  - 就业、工人管理和自雇机会
  - 基本服务和福利获取
  - 执法
  - 移民、庇护和边境管理
  - 司法和民主进程

## 处罚措施

| 违规类型 | 罚款上限 |
|----------|----------|
| 禁止 AI 实践违规 | 3500万欧元或全球年营业额 7%（取较高者） |
| 高风险系统义务违规 | 1500万欧元或全球年营业额 3% |
| 提供错误信息 | 750万欧元或全球年营业额 1% |

## 合规时间线（2026 Digital Omnibus 修订后）

**⚠️ 重要更新（2026-07-26）**：2026 Digital Omnibus on AI (Omnibus Regulation) 推迟了高风险 AI 系统的合规截止日期。

| 日期 | 里程碑 |
|------|--------|
| 2024年8月1日 | 法规生效 |
| 2025年2月2日 | 禁止 AI 实践（Article 5）适用 ✅ 已生效 |
| 2025年8月2日 | GPAI 模型规则（Title VIII）适用 ✅ 已生效 |
| **2027年12月2日** | **高风险 AI 系统 Annex III（独立）义务适用** ← 原为 2026-08-02，推迟 16 个月 |
| 2028年8月2日 | Annex I（嵌入式，如医疗器械）义务适用 |

来源：regulation-ai.eu（2026-06-21 更新），EU 2026 Digital Omnibus on AI。

## 关键引用

> "Article 12 requires that high-risk AI systems be designed and built with capabilities that enable automatic recording of events — logs — throughout their operational lifetime."
> — Regulation (EU) 2024/1689

> "High-risk AI systems must be designed and developed in such a way as to ensure that their operation is sufficiently transparent to enable deployers to interpret a system's output and use it appropriately."
> — Article 13(1)

---

**文档来源**: EU Official Journal, AI Act Service Desk (EC), Regulation-AI.eu  
**最后更新**: 2026-07-27
