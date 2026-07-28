# DESIGN: Vector Set v1.2 — 全量清单与技术陷阱继承

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> 版本: 1.0 · 2026-07-28
> 状态: Released · 2026-07-28
> 对标: 白皮书 Draft 3 §13.2 + SPEC v1.1 §3.4

---

## Part A: 从 v1.0/v1.1 继承的技术陷阱

以下问题在 v1.0/v1.1 的独立审计报告（`erdl-vectors-v1.1/AUDIT-REPORT.md`, 2026-07-27）中被发现。v1.2 生成器必须有对应措施。

### P1 级（必须在 v1.2 中杜绝）

| # | 陷阱 | v1.0/v1.1 现象 | v1.2 对策 |
|---|------|-------------|---------|
| T1 | **生成脚本与向量文件不同步** | `generate-v1.1-vectors.cjs` 只有 DO-024~DO-033，但 JSON 文件实际有 DO-034~DO-037 | 单一脚本 `generate-vectors.cjs` 端到端生成全部 101 条；任何手动编辑 JSON 后必须回补脚本 |
| T2 | **内部状态字段泄漏到向量文件** | AV-006/AV-007 残留 `__placeholder` 字段 | 最终写入前执行 `stripInternalFields()`：移除所有 `__` 前缀字段 |
| T3 | **description 与实际内容不一致** | v1.1 description 声称覆盖 DELEGATE，实际无 | 生成脚本末尾用 `validateVectorSet()` 自检：实际决策类型集合 vs description 声明 |
| T4 | **AV vector_ref 指向不存在的 DO** | AV-008 的 `vector_ref: "DO-010-STALE"` 指向不存在的 ID | AV-008 使用 `vector_ref: "AV-003"` + `source_commit: "c3f22df"` + `note` 字段完整说明来源 |
| T5 | **expected_sha256 答案密钥的结构性风险** | v1.0 用 `expected_sha256` 作为预计算答案；Erik Newton 报告该字段被"答案本 runner"滥用 | v1.2 完全移除 `expected_sha256`。验证器通过七步法从头重算，答案在计算中产生 |

### P2 级（建议在 v1.2 中改进）

| # | 陷阱 | v1.0/v1.1 现象 | v1.2 对策 |
|---|------|-------------|---------|
| T6 | **缺少 package.json** | 4 个脚本依赖 `json-canonicalize` 但项目无 `package.json` | 根目录 `package.json` 显式声明依赖；README 给出 `npm install && npm run generate` 命令 |
| T7 | **$schema URL 不可验证** | `$schema` 指向 `openoba.com` 但无本地 fallback | 同时输出本地 `schema/decision-object-v1.0.schema.json`；`$schema` 保留远程 URL 但在 README 中标注本地路径 |
| T8 | **version 与 spec 的关系令人困惑** | v1.1 文件 `version: "1.1.0"` 但 `spec: "decision-object-v1.0"` | 在 description 和 README 中明确："spec = DO 格式版本（永久 v1.0），version = 向量集版本（v1.2.0），compliance_profile = 合规配置版本" |
| T9 | **删除 vs 设为 null 的 JCS 语义差异** | c3f22df 事故：em-dash 空格修复后 AV-003/004/005 的 audit.hash 变化。根因是 delete-vs-null 在 JCS 下产生不同 canonical bytes | 生成器中明确：物理删除（`delete obj.field`）而非设为 null。代码注释标注"JCS: Omit over Null"原则 |
| T10 | **跨版本兼容表述模糊** | README 说"已移除 expected_sha256"但 v1.0 文件仍保留 | 生成器输出的 `metadata` 中声明清晰的版本边界：`breaking_from: ["v1.0","v1.1"]` |

### 额外设计约束（从审计报告学习）

| # | 约束 | 来源 | 措施 |
|---|------|------|------|
| C1 | **脚本必须是唯一的可复现入口** | P1-1 | `generate-vectors.cjs` 是唯一入口。向量的任何修改必须通过修改该脚本实现 |
| C2 | **向量文件以 git commit 锁定** | 审计建议 | README 中明确："向量文件的权威版本以 git commit hash 锁定。生成脚本是便于理解的参考实现" |
| C3 | **所有字符串字段禁止硬编码换行符** | JCS 确定性要求 | 所有 `scenario`/`note`/`reason` 等字符串字段不得包含 `\r`、`\n`、非打印字符 |
| C4 | **DO 内字段顺序必须符合 JCS 对象键序** | RFC 8785 | 生成脚本中对象按 Unicode 键序排列（或在 JSON.stringify 后不做任何重新排序） |

---

## Part B: 63 条静态决策向量完整清单

### B.1 继承自 v1.0/v1.1 的场景模式（不继承数据，只继承测试意图）

v1.0/v1.1 的测试设计模式是成熟的，v1.2 在新的 63 条 DO 中应该覆盖这些**场景类别**：

| v1.0/v1.1 场景类别 | v1.2 对应 DO | 说明 |
|-------------------|-------------|------|
| security-baseline（DENY + PASS 配对）| DO-001, DO-002 | 规则在匹配/不匹配时返回正确决策 |
| compliance-workflow（REQUEST_HUMAN + PASS）| DO-013, DO-014 | 合规规则的人类审批流程 |
| dangerous-command（DENY + PASS）| DO-003, DO-004 | 危险命令检测 |
| critical-infrastructure（DENY）| DO-005 | 关键系统保护 |
| policy-versioning（PASS）| DO-006 | 规则集版本独立性 |
| empty-policies（PASS）| DO-007 | 空规则集下的默认行为 |
| override-safe-direction（ALLOW）| DO-011 | Ring 3 放行覆盖 Ring 0 拒绝（安全方向）|
| override-unsafe-direction（ALLOW）| DO-012 | —"—（不安全方向，触发警告）|
| ring-0-precedence（DENY）| DO-008 | Ring 0 拒绝优先于 Ring 3 放行 |
| ring-0-halt-shortcircuit（EMERGENCY_HALT）| DO-009 | Ring 0 紧急终止短路所有评估 |
| severity-escalation（DENY × 2）| DO-010 | 严重性升级（medium → high → critical）|
| all-operators（7 DOs）| DO-042~DO-050 | 各运算符系统覆盖 |
| multi-agent-trust（ESCALATE）| DO-017 | 低信誉 Agent 在敏感上下文中升级 |
| auto-correction（CORRECT）| DO-021 | 自动纠偏（纠正参数后放行）|
| unless-exemption（3 DOs）| DO-024~DO-026 | unless 豁免机制 |
| null-safety（2 DOs）| DO-027, DO-028 | 缺失字段 vs 空值 vs null |
| type-safety（PASS）| DO-029 | 字符串 "5" ≠ 数字 5 |
| metadata-decision（ALLOW fallback）| DO-030 | metadata.decision fallback（无规则命中）|
| operator-* 系列（10 DOs）| DO-041~DO-050 | 13 种运算符系统覆盖 |

### B.2 完整 63 条清单

**编号规则**: DO-001 ~ DO-063

#### DO-001 ~ DO-010: 安全基线（Security Baseline）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-001 | DENY | 财务 Agent 执行 sudo 命令 — 环0 Guardian 拦截 | eq, ring=0, security |
| DO-002 | PASS | 同一安全规则对安全的 read_file 操作不触发 | eq, 规则选择性匹配 |
| DO-003 | DENY | 危险命令 rm -rf / — 被拦截 | neq, dangerous-command |
| DO-004 | PASS | 安全的 ls 命令 — 通过 | neq, 安全命令 |
| DO-005 | DENY | 关键基础设施 Agent 被操作 write_file 到 /etc/ | critical, starts_with |
| DO-006 | PASS | 规则集版本变更后，新的 DENY 规则正确生效 | rule_set_version |
| DO-007 | PASS | 空规则集 — 默认 ALLOW（metadata.decision fallback）| empty-policies |
| DO-008 | DENY | Ring 0 DENY vs Ring 3 ALLOW — Ring 0 优先 | ring-0-precedence |
| DO-009 | EMERGENCY_HALT | 关键异常触发立即终止 — 短路所有评估 | ring-0, short-circuit |
| DO-010 | DENY | 严重性升级: medium DENY + 上下文叠加 → severity=high | severity-escalation |

#### DO-011 ~ DO-020: 覆盖与豁免（Override & Exemption）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-011 | ALLOW | Ring 3 ALLOW override Ring 0 DENY（安全方向）| override-safe, instruction field |
| DO-012 | ALLOW | Ring 3 ALLOW override Ring 0 DENY（不安全方向 — 触发 NOTIFY）| override-unsafe, NOTIFY 伴随 |
| DO-013 | REQUEST_HUMAN | PII 上下文访问 — 需要人类审批 | compliance, PHI |
| DO-014 | PASS | PII 上下文但操作为只读 — 无需审批 | compliance, 上下文差异 |
| DO-015 | REQUEST_HUMAN | 非工作时间高危写操作 — 需要主管审批 | time-based, 高风险 |
| DO-016 | REQUEST_HUMAN | 医疗数据访问 — HIPAA 合规触发人类审批 | compliance, PHI-medical |
| DO-017 | ESCALATE | 低信誉 Agent (reputation=25) 在高风险上下文 — 升级 | multi-agent, reputation |
| DO-018 | ESCALATE | 跨域操作 — 升级到域管理员 Agent | multi-agent, cross-domain |
| DO-019 | ESCALATE | 未知工具 tool.name="unknown_tool" — 升级 | unknown-tool |
| DO-020 | ALLOW | 已知安全工具 in allowlist — 直接放行 | in, allowlist |

#### DO-021 ~ DO-030: 纠偏与豁免（Correction & Unless）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-021 | CORRECT | 自动纠偏: 大写路径 → 小写 | correction field, ring 3 |
| DO-022 | CORRECT | 单位转换: "1024KB" → "1MB" | correction, unit-convert |
| DO-023 | CORRECT | 路径规范化: "a/./b/../c" → "a/c" | correction, path-normalize |
| DO-024 | ALLOW | unless 豁免: 文件路径匹配测试文件 → 豁免生效 | unless, matches |
| DO-025 | DENY | unless 条件不满足 → 规则正常生效 | unless, no-match |
| DO-026 | ALLOW | unless 豁免 + 额外条件都满足 | unless, multi-condition |
| DO-027 | PASS | Null-safe: 缺失字段 `!=` 比较 → 返回 false，规则不触发 | null-safety, neq |
| DO-028 | PASS | Null-safe: 缺失字段 `=` 比较 → 返回 false | null-safety, eq |
| DO-029 | PASS | 严格类型: 字符串 "5" vs 数字 5 → `eq` 返回 false | type-safety |
| DO-030 | ALLOW | metadata.decision=ALLOW fallback（无规则命中）| metadata, fallback |

#### DO-031 ~ DO-040: 通知/隔离/回滚（Notify/Quarantine/Rollback）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-031 | NOTIFY | 异常操作检测 — 发送通知但不拦截 | notify, anomaly |
| DO-032 | NOTIFY | 操作审计记录 — 记录所有 exec 调用 | notify, audit-log |
| DO-033 | NOTIFY | 阈值预警: API 调用次数 > 1000/小时 | notify, threshold |
| DO-034 | NOTIFY | 伴随 DENY 的通知 — 拦截+通知双输出 | notify, accompany-deny |
| DO-035 | QUARANTINE | 可疑文件隔离: 检测到 .exe 从 web 下载 | quarantine, ring 1 |
| DO-036 | QUARANTINE | 异常操作模式 — 隔离 Agent 操作权限 | quarantine, anomaly |
| DO-037 | QUARANTINE | 速率限制触发: 同一操作 10 次/秒 → 隔离 | quarantine, rate-limit |
| DO-038 | ROLLBACK | 快照回滚: 操作失败 → 回滚到快照点 | rollback, snapshot |
| DO-039 | ROLLBACK | 部分失败回滚: 批量操作中 1/3 失败 → 回滚 | rollback, partial |
| DO-040 | ROLLBACK | 交易回退: 金额超出阈值 → 回退整个事务 | rollback, transaction |

#### DO-041 ~ DO-050: 运算符全覆盖（Operator Coverage）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-041 | ALLOW | `in`: tool.name in ["read","search","list"] | in |
| DO-042 | ALLOW | `not_in`: tool.name not_in ["exec","write","delete"] | not_in |
| DO-043 | ALLOW | `contains`: file_content contains "SAFE_MARKER" | contains |
| DO-044 | DENY | `matches`: 恶意正则可疑输入（ReDoS防护测试）| matches, ReDoS |
| DO-045 | REQUEST_HUMAN | `gt`: risk_score > 80 → 需要审批 | gt |
| DO-046 | ALLOW | `lte`: risk_score ≤ 50 → 放行 | lte |
| DO-047 | ALLOW | `starts_with`: tool.name starts_with "safe_" | starts_with |
| DO-048 | ALLOW | `ends_with`: file_name ends_with ".log" | ends_with |
| DO-049 | DENY | `exists`: context.high_risk_flag exists and is true | exists, truthy |
| DO-050 | PASS | `exists`: context.high_risk_flag 不存在 → 不触发 | exists, missing |

#### DO-051 ~ DO-060: 工作流编排（WORKFLOW Series）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-051 | WORKFLOW | 多步骤工作流启动: deploy-app → build → test → deploy | workflow, multi-step |
| DO-052 | WORKFLOW | 条件分支工作流: if staging → deploy-staging else → deploy-prod | workflow, branch |
| DO-053 | WORKFLOW | 审批节点工作流: 敏感操作需要三级审批 | workflow, approval |
| DO-054 | WORKFLOW | 工作流结束 — 最后一个步骤完成 | workflow, completion |
| DO-055 | WORKFLOW_WAITING | 等待人类审批 — status: pending | waiting, human-approval |
| DO-056 | WORKFLOW_WAITING | 等待时间窗口 — 操作仅在 9:00-18:00 允许 | waiting, time-window |
| DO-057 | WORKFLOW_WAITING | 等待前置任务 — dependency not yet complete | waiting, dependency |
| DO-058 | WORKFLOW_PROGRESS | 步骤推进: Step 1/5 完成 → Step 2/5 | progress, step |
| DO-059 | WORKFLOW_PROGRESS | 阶段完成: phase=build 完成 → phase=test | progress, phase |
| DO-060 | WORKFLOW_PROGRESS | 最终步骤推进 — 触发生成最终 DO | progress, final |

#### DO-061 ~ DO-063: 边缘穷尽（Edge Cases）

| ID | 决策 | 场景 | 关键测试点 |
|----|------|------|---------|
| DO-061 | DENY | 对象深层比较: context.tool.args == {cmd:"rm",opts:"-rf"} | object-deep-eq |
| DO-062 | PASS | 空扩展规范化: extensions=[] 时平面哈希仍正确计算 | empty-extensions |
| DO-063 | DENY | 整数安全范围: execution_count > Number.MAX_SAFE_INTEGER → 拒绝 | integer-safe-range |

---

## Part C: 审计哈希向量 12 条

| AV | 源 DO | 决策 | 测试意图 |
|----|-------|------|---------|
| AV-001 | DO-001 | DENY | 安全拦截 — Ring 0 单规则命中 |
| AV-002 | DO-013 | REQUEST_HUMAN | 合规审批 — PII 上下文 |
| AV-003 | DO-011 | ALLOW | Override 安全方向 — 多规则 matched_rules |
| AV-004 | DO-009 | EMERGENCY_HALT | 环0 紧急终止 — 短路评估 |
| AV-005 | DO-017 | ESCALATE | 低信誉 Agent 升级 |
| AV-006 | DO-024 | ALLOW | Unless 豁免触发 |
| AV-007 | DO-027 | PASS | Null-safe 字段访问 |
| AV-008 | DO-011 | (回归) | **陈旧回归向量** — canonical_bytes 同 AV-003，audit.hash 保留 v1.1 旧值 |
| AV-009 | DO-021 | CORRECT | 自动纠偏 |
| AV-010 | DO-031 | NOTIFY | 异常通知记录 |
| AV-011 | DO-038 | ROLLBACK | 快照回滚 |
| AV-012 | DO-051 | WORKFLOW | 工作流启动 |

### AV-008 构造方法

```javascript
// AV-008 不通过正常平面哈希流程生成
// 步骤:
// 1. 从 AV-003 深拷贝
// 2. canonical_bytes 保持不变（与 AV-003 逐字节相同）
// 3. audit.hash 硬编码为以下值——该值在 v1.1 审计报告中发现
//    来自 commit c3f22df 的旧版 AV-003（使用 JSON.stringify 而非 JCS +
//    无分层哈希架构）
// 4. vector_ref 设为 "AV-003" (不是 "DO-010-STALE")
// 5. 添加 source_commit: "c3f22df" 字段

av008.audit.hash = 'sha256:342b4e9652101d0b75ef39bed7f5a7e6de4d890618ec6eeafe3a9a3490ddb64d';
av008.vector_ref = 'AV-003';
av008.source_commit = 'c3f22df';
av008.note = 'STALE REGRESSION VECTOR: canonical_hex identical to AV-003, audit.hash intentionally stale (v1.1 legacy value). Any validator that recomputes from first principles will detect MISMATCH; cached/shorthand validators will falsely PASS.';
```

## Part D: 动态向量 26 条

### Temporal (TD-001 ~ TD-010)

| ID | 测试目标 |
|----|---------|
| TD-001 | within 1s: 操作在 1 秒内重复触发限制 |
| TD-002 | within 1min: 1 分钟内超过阈值 |
| TD-003 | within 1h: 1 小时内操作次数限制 |
| TD-004 | within 1d: 每日配额限制 |
| TD-005 | within 30d: 月度配额限制 |
| TD-006 | 边界: 恰好 at 窗口边界 |
| TD-007 | 边界: 跨时区时间窗口 (UTC+8 vs UTC) |
| TD-008 | 边界: 闰秒处理 |
| TD-009 | 并发: 同一毫秒内多个判断 |
| TD-010 | 并发: 高并发下 within 窗口计数准确性 |

### Seeded (SD-001 ~ SD-008)

| ID | 测试目标 |
|----|---------|
| SD-001 | 同一种子 seed=42 → 相同 override 结果 |
| SD-002 | 同一种子 seed=42 再次 → 结果一致 |
| SD-003 | 不同种子 seed=99 → 不同结果 |
| SD-004 | 种子分布均匀性: 1000 次种子=7, 统计分布 |
| SD-005 | 空种子 seed=null → 使用当前时间戳 |
| SD-006 | 负数种子 seed=-1 → 取绝对值 |
| SD-007 | 大种子 seed=2^53 → 安全整数边界 |
| SD-008 | 字符串种子 seed="abc" → hash → 整数 |

### Stateful (ST-001 ~ ST-008)

| ID | 测试目标 |
|----|---------|
| ST-001 | combine.state: 同 key 多次 combine → 正确累积 |
| ST-002 | combine.state: 同 key 溢出保护 → 拒绝超限值 |
| ST-003 | combine.state: 多 key 独立累积 |
| ST-004 | combine.state: 不同 key 不互相干扰 |
| ST-005 | combine.state: key 的 reset 操作 |
| ST-006 | combine.state: key 的 expire 操作（时间过期）|
| ST-007 | combine.state: 空初始状态 |
| ST-008 | combine.state: 跨规则共享状态 |

---

## Part E: 预留向量

| ID | 类型 | 决策 | 预留原因 | 目标版本 |
|----|------|------|---------|:---:|
| DO-064 | 决策向量 | DELEGATE | rulsynor 引擎代码路径未实现 | v1.3 |
| AV-013 | 审计哈希向量 | — | depends on DO-064 | v1.3 |

这两个预留向量在输出 JSON 中以 `reserved_vectors` 字段声明，不生成具体内容。

---

## Part F: 验证清单

生成脚本 `generate-vectors.cjs` 执行完毕后，必须通过以下自检：

- [ ] 63 条 `vectors[]` 全部生成，无空缺 ID
- [ ] 26 条 `dynamic_vectors` 全部生成
- [ ] 12 条 `audit_vectors` 全部生成
- [ ] AV-001~AV-007、AV-009~AV-012 的 `audit.hash` 五步法重算 = MATCH
- [ ] AV-008 的 `canonical_bytes` = AV-003 的 `canonical_bytes`
- [ ] AV-008 的 `audit.hash` ≠ AV-003 的 `audit.hash`
- [ ] 无 `__` 前缀字段泄漏到输出 JSON
- [ ] 所有 `vector_ref` 指向真实存在的 DO ID
- [ ] 实际决策类型集合 = metadata.decision_types_covered
- [ ] 所有字符串字段无 `\r`、`\n` 字符
- [ ] `activated_fields` 不含 `human_oversight`（CORE #13）
- [ ] `profile_hash` 参与 JCS → `audit.hash` 变化（非死代码）
- [ ] `rule_set_version.id` = SHA-256(JCS(policies))

---

> *101 条向量。每条都必须是经得起独立验证的事实，不是宣称的数字。*
