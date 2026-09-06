# 表达层场景向量 · 金融行业（设计基线 · 草案）

> 状态：草案（未定稿，先记录方向，向量未落地）
> 日期：2026-09-05
> 方法：从「规则即代码」场景反向推——锚定法规/国际标准，找出「跨语言、跨组织最易分歧、分歧最贵」的语义分叉点
> 约束：**不扩 34 节点内核**。现有内核跑不通的金融语义（日期惯例、工作日、ROUND_HALF_UP）一律 PASS，后续再议（Henry 2026-09-05 定）。

## 一、金融场景的命题

> 证明：跨组织、跨语言，同一条金融规则（金额/币种/阈值/日期/空值）执行后，**结果（决策 + 金额 + 证据哈希）一字不差**。

## 二、金融语义分叉点（权威锚点）

锚定 ISDA 2006 §4.16、SIFMA《Standard Securities Calculation Methods》、Firelinkx《Designing Deterministic Financial Calculations》。

### 现有内核已覆盖（可做向量）

| 金融规则语义 | ERDL 现有节点 |
|---|---|
| 金额阈值（>N / ≤N） | gt/gte/lt/lte |
| 币种/账户/类型/名单判断 | eq/ne/in/contains/match |
| 金额计算、费率、比例 | add/sub/mul/div/round（E2 定点 scale=14 + half-even） |
| 多条件组合 | and/or/not |
| 交易日期区间 | between + date |
| 空值/缺失字段安全 | exists + E11 |
| 多笔聚合（求和/计数/最值） | aggregate(count/sum/avg/min/max) |
| 实际天数差（Actual） | days_between（UTC 毫秒差 floor） |

### 现有内核跑不通（PASS，后续再议）

- ❌ 30/360 US、30E/360 ISDA、Actual/365、Actual/360 日期惯例（缺节点）
- ❌ ROUND_HALF_UP 金融计费舍入（现有 E2 是 half-even，`.5` 取舍方向相反）
- ❌ 工作日顺延（Following / Modified Following / Preceding）

## 三、第一批金融向量设计（4 类，先各 1-2 条样例跑通链路）

### 类型 A：金额定点舍入的跨语言一致（金融最痛）
- `.5` 边界（half-even 的 X.X5）、大额定点精度极限、除法舍入（1/3、10/3、0.85% 费率）

### 类型 B：金额阈值 + 币种 + 多条件端到端（反洗钱/风控规则）
> `金额 > 10000 且 币种 ∈ {USD,EUR} 且 国家 ∈ 高风险名单 → DENY`
- 覆盖：阈值边界（9999.99 / 10000 / 10000.01）、币种枚举、名单命中 → 证据哈希

### 类型 C：Actual 天数计息（内核已有 days_between）
> `利息 = 本金 × 利率 × days_between(起息日,结算日) / 365`
- 覆盖：跨闰年、跨月、月末 31 号、日期 UTC 解析

### 类型 D：空值/缺失字段的金融安全语义（E11）
- 缺失币种/金额字段 → 必须 fail-safe（不静默放行）

## 四、下一步

每类先落地 1-2 条最小样例向量 → 跑通「金融规则 → 表达层向量 → 跨语言验证」完整链路 → 验证方法论后再决定是否铺量。
