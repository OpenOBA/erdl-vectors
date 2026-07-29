# A2A Discussion #2031 — ERDL Decision Object 全量对话记录

> 来源：A2A Protocol Discussion
> 时间跨度：2026-07-01 至 2026-07-29
> 参与者：唐浩然 (Tang Haoran · OpenOBA)、Erik Newton (Concordia)、Christopher Hopley (chopmob-cloud / AlgoVoi)

---

## 第一阶段：提案与架构验证（7 月初）

### 唐浩然发起：Agent Card 行为规则扩展提案

在 A2A Agent Card 上提出 `erdl` 扩展——让 Agent B 在接受任务委托前，了解 Agent A 的操作规则约束。

```json
{
  "extensions": {
    "erdl": {
      "protocol": "erdl/v1",
      "rules_file": "agent.erdl.yaml",
      "guardian": "did:erdl:guardian-main",
      "trust_score": 850
    }
  }
}
```

### Chris Hopley 的关键纠正（合规 vs 信誉）

> 一个分数不提供合规。850 这样的数字是信誉——对 Agent 的概括性评价。信誉回答"这个 Agent 总体上可信吗"。合规回答一个不同且更难的问题："**这次特定操作是否被允许？在哪个规则版本下？我能事后证明它吗？**"

Chris 明确区分：
- **信誉**（per-agent）：一个分数，不可被验证方重算，只能信任发布者
- **合规**（per-decision）：一个内容寻址记录，绑定（规则版本、输入、裁决、时间戳），任何第三方可离线重算

**结果**：`trust_score` 被降级为建议性元数据，不作为治理输入。

Chris 介绍了他构建的合规 substrate——无 PII 的合规 receipt，JCS (RFC 8785) + SHA-256，任何人都可从记录本身重算，无需发行方联系。同时提到 `draft-hopley-x402-compliance-receipt` I-D 和 `draft-hopley-x402-retention-chain-07` I-D。

---

## 第二阶段：字节级对齐（7 月中旬）

### compliance receipt 与 ERDL 的映射

Chris 详细说明了 6 字段 receipt 格式：

| 字段 | 说明 |
|------|------|
| `canon_version` | 规范化规则版本（如 `jcs-rfc8785-v1`） |
| `screen_result` | 分类裁决，闭合枚举 `{ALLOW, REFER, DENY}` |
| `jurisdiction_flags` | 有序辖区代码数组（JCS 不规范化数组顺序） |
| `payer_ref` | 付款方的 `sha256:` 内容地址，非 PII |
| `screen_provider_did` | 筛查提供方的 DID |
| `screen_timestamp_ms` | 整数毫秒时间戳 |

**核心约束**：在内容寻址 receipt 中没有"可选字段"——哈希覆盖整个规范化对象，每个字段都是负载承载的。`screen_result` 是闭合枚举，裁决不能被模糊成绩效或等级。

Chris 的建议：保留 ERDL 完整的 16 值 verdict 作为负载承载字段，`screen_result` 作为仅在对接合规 gate 时发出的独立投影。

**唐浩然采纳并确认映射**：
- `BLOCK / ESCALATE / EMERGENCY_HALT → DENY`
- `REQUEST_HUMAN → REFER`
- `ALLOW / AUDIT → ALLOW`

投影映射将与 `canon_version` 同版本锁定——不允许隐式、不允许运行时配置。

### Erik Newton 首次出现——第二独立实现的证明

> 从记录本身重算的属性是 ERDL 证据链的正确门槛。在基于单一向量集硬化之前：锚定在单一作者身上的合规配置只与该作者一样中立。"可重算"随后悄然变成"针对他们可重算"。使其成为真实的是**第二个独立编写的发射器**，从同一记录生成逐字节一致的规范化输出。

Erik 贡献了 Concordia 的 `CascadeDecisionRecord`——一个拒绝或延迟操作也会发出可验证 receipt 的实现。提供公开互操作 fixtures。

### 三方共识达成——三个独立实现，一个开放规范，没有单一所有者

Erik 提出中立性公式，三方一致同意。

唐浩然承诺起草 Decision Object v1.0 规范，MIT 许可，公开规范而非"ERDL 的格式"。

### Chris 的署名修正

Chris 指出 Abhishek Tiwari 和 Christopher Hopley 被拆成两个条目——实为同一人。唐浩然修正。

---

## 第三阶段：v1.0 跨实现验证（7 月中旬）

### Erik Newton 的首次验证

> 确认：Concordia 的 RFC 8785 JCS 规范化器加 SHA-256 逐字节复现全部 5 条 audit_vectors（AV-001 至 AV-005）。三条检查全部匹配：我的 canonical bytes 等于你的 canonical_bytes，我的摘要等于 expected_sha256，重算值精确回填 audit.hash。

三个向量携带非 ASCII 字符，两个实现都输出匹配的原始 UTF-8——这是中立性测试在证据上通过，而非在断言上通过。

### Chris Hopley 的第三次独立验证

> 用我们公开的 RFC 8785 JCS 规范化器和 SHA-256，按照你的一步配方（剥离 audit.hash，规范化，哈希），全部五条逐字节复现。Decision Object 的哈希表面在当前的 substrate 上是干净的。

**关键发现**：ERDL 和 Keystone 使用相同的 JCS+SHA-256 规程，所以 ERDL 决策记录是内容寻址的，无需适配器即可自然地坐在 substrate 上。`audit.previous_hash` 链式结构与 Keystone 的链式链接结构完全相同。

---

## 第四阶段：Chris 的精细发现——em-dash 事故（7 月 23-25 日）

### c3f22df 事故：白皮书与向量不一致

Chris 报告 AV-003/004/005 不通过：

> 不是规范化争端——是 7 月 23 日的 em-dash 规范化引入了一个细小的内部不一致。三个向量中存储的 `decision_object.reason` 携带 em-dash 没有后续空格，而 `canonical_bytes`/`expected_sha256` 是从带空格的形式计算的。

**一行复现**：在 em-dash 后重新插入空格，全部三条立即复现 `expected_sha256`。

**Chris 的建议**：直接从 `decision_object` 字节重新生成 `canonical_bytes`/`expected_sha256`——用结构性方法关闭，而非重新编辑字符串。

唐浩然采纳并修复。

### 更深一层：self-referential digest 不匹配

修复 c3f22df 后，唐浩然发现深层问题——`decision_object.audit.hash` 嵌在存储对象中仍携带修前值。在 `5cff368` 中修复：`decision_object.audit.hash`、`canonical_bytes`、`expected_sha256` 三字段对齐。

### Chris 指出五步 vs 六步的分歧

> claimed-hash 比较不是叠加在规范上的额外规程——它已经是规范公开发布的方法。Decision Object 实现者验证方法是**六步**，第 6 步是"将计算的哈希重新插入 audit.hash 并与 decision_object.audit.hash 比较"。

在这个帖子中流通的简写是五步"剥离、规范化、SHA-256、比较"，缺少第 6 步。五步简写正是让 AV-003/004/005 在 c3f22df 看起来干净的原因。

**Chris 的建议**：
1. 将第 6 步从散文升级为规范性 MUST
2. 显式声明 preimage 是通过**删除键**而非**留空**来构建的——删除和设为空字符串在 JCS 下产生不同的规范化字节序列

### Erik Newton 确认

> c3f22df：第 1 到 5 步通过 7/7；完整的六步方法通过 4/7，恰好在 AV-003/004/005 失败。
> 5cff368：两种方法下 7/7 通过。

**两个独立实现产生完全相同的分裂**——确认失败模式是确定性的、跨实现可复现的。

---

## 第五阶段：答案密钥删除与架构反思（7 月 25-26 日）

### 唐浩然提出方案：删除答案，而非增加陷阱

核心理念：
1. 从审计向量中剥离 `expected_sha256` 和 `canonical_bytes`
2. 向量集只携带生产工件携带的东西：`decision_object`，带其自引用 `audit.hash`
3. 验证器只有一条路径：剥离 → JCS → SHA-256 → 与 claimed value 比较
4. 没有答案密钥可以依靠——不是因为被抓住了，而是因为绕过检查所需的信息根本不存在

### Erik 的修改建议

> `expected_sha256` 和 `canonical_bytes` 不是同一类字段。`expected_sha256` 是答案密钥——删除它做到了你说的。`canonical_bytes` 是**诊断工具**——它是 7 月 24 日我能够告诉你 AV-003/004/005 携带陈旧摘要而非我的规范化器有缺陷的唯一原因。

建议：删除 `expected_sha256`，保留 `canonical_bytes`，增加一条故意陈旧的向量。

唐浩然采纳。最终方案：删除答案密钥，保留诊断锚点，增加 AV-008 陈旧回归金丝雀。

### Chris 的退出

> 这看起来在你们那边已经解决了，我不会在已定的帖子上增加噪音。

Chris 发送了关于失败模式和复现的简短书面报告，供规范的理由部分使用。

---

## 第六阶段：v1.3 发布与最终验证（7 月 28-29 日）

### Erik Newton 的 v1.3 验证与三个发现

> AV-001 至 AV-012，用 Concordia 的独立 RFC 8785 规范化器验证：11 条逐字节完美匹配每个工件自身的 claimed audit.hash，AV-008 作为陈旧金丝雀正确失败。我们的 canonical bytes 在所有 12 条上与发布的 canonical_hex 匹配。这是一个干净的结果。

**E1**：白皮书 §13.3 与 verify.js 不一致——白皮书说删 `audit.hash`，代码删了整个 `audit`。

**E2**：删整个 `audit` 对象将 `previous_hash` 和 `commitment` 排除在摘要之外——链位置篡改不可检测。

**E3**：`canonical_hex` 在每条哈希向量上发布——没有 JCS 实现的 runner 仍然通过 11/12，AV-008 金丝雀无法检测这种捷径。建议将答案移入独立文件。

### 唐浩然回复——全部三项已修复（7 月 29 日）

- **E1**：§13.3 统一为 `DELETE audit.hash`，Runner's Guide 和 verify.js 同步
- **E2**：恢复 v1.1 设计，AV-008→AV-013 链完整性金丝雀，5 种验证模式全通过
- **E3**：canonical_hex 从静态向量中移除，独立 `decision-object-answers-v1.3.json` 文件，§13.6 MUST NOT 声明

---

## 第七阶段：知会 Chris（7 月 29 日）

唐浩然向 Chris 同步 v1.3 进展，逐项报告其发现（C1-C4、S1-S3）的落实情况，表达感谢。

---

## 关键人物贡献摘要

### Erik Newton (Concordia)
- 确立"三个独立实现，一个开放规范，没有单一所有者"标准化路径
- 首个独立 Runner 实现者（Python，RFC 8785 原生）
- **两次验证**：v1.1 7/7 + v1.3 11/12 + AV-008 金丝雀
- **三项关键发现**（E1/E2/E3）直接推动 v1.3 架构修复
- 提出"中立性是被测出来的，不是宣称出来的"——成为项目座右铭

### Christopher Hopley (chopmob-cloud / AlgoVoi)
- 在合规 vs 信誉的关键区分上给出决定性的早期纠正
- **洁净室 JCS 检查器**——从没有人走过的角度验证规范文字的内部一致性
- 报告 em-dash 事故（AV-003/004/005 不一致），提供精确的一行复现
- 发现五步 vs 六步简写分歧，建议将第 6 步升级为 MUST
- 报告 C1-C4（四个技术发现）和 S1-S3（三个安全发现）
- 构建合规 substrate：JCS+SHA-256 content-addressed receipt，keystone chain，retention chain
- **明确拒绝背书，保留独立立场**

### 唐浩然 (OpenOBA)
- 策划并主持整个 v1.0→v1.3 演进
- 将各方发现全部转化为代码和规范修复
- 维护三方技术对话，协调中立性立场
- 发布 RFC 001（OPENOBA-DOBJ-RFC-001）
