# DESIGN: Vector Set v1.3 �?全量清单与技术陷阱继�?
> Copyright © 2026 唐启�?(Tang Qixin). All rights reserved.

> 版本: 1.1 · 2026-07-29
> 状�? Released
> 对标: 白皮�?Draft 4 §13.2 + SPEC v1.1 §3.4

---

## Part A: �?v1.0/v1.1 继承的技术陷�?
以下问题�?v1.0/v1.1 的独立审计报告（`erdl-vectors-v1.1/AUDIT-REPORT.md`, 2026-07-27）中被发现。v1.2 生成器必须有对应措施�?
### P1 级（必须�?v1.2 中杜绝）

| # | 陷阱 | v1.0/v1.1 现象 | v1.2 对策 |
|---|------|-------------|---------|
| T1 | **生成脚本与向量文件不同步** | `generate-v1.1-vectors.cjs` 只有 DO-024~DO-033，但 JSON 文件实际�?DO-034~DO-037 | 单一脚本 `generate-vectors.cjs` 端到端生成全�?101 条；任何手动编辑 JSON 后必须回补脚�?|
| T2 | **内部状态字段泄漏到向量文件** | AV-006/AV-007 残留 `__placeholder` 字段 | 最终写入前执行 `stripInternalFields()`：移除所�?`__` 前缀字段 |
| T3 | **description 与实际内容不一�?* | v1.1 description 声称覆盖 DELEGATE，实际无 | 生成脚本末尾�?`validateVectorSet()` 自检：实际决策类型集�?vs description 声明 |
| T4 | **AV vector_ref 指向不存在的 DO** | AV-008 �?`vector_ref: "DO-010-STALE"` 指向不存在的 ID | AV-008 使用 `vector_ref: "AV-003"` + `source_commit: "c3f22df"` + `note` 字段完整说明来源 |
| T5 | **expected_sha256 答案密钥的结构性风�?* | v1.0 �?`expected_sha256` 作为预计算答案；Erik Newton 报告该字段被"答案�?runner"滥用 | v1.2 完全移除 `expected_sha256`。验证器通过七步法从头重算，答案在计算中产生 |

### P2 级（建议�?v1.2 中改进）

| # | 陷阱 | v1.0/v1.1 现象 | v1.2 对策 |
|---|------|-------------|---------|
| T6 | **缺少 package.json** | 4 个脚本依�?`json-canonicalize` 但项目无 `package.json` | 根目�?`package.json` 显式声明依赖；README 给出 `npm install && npm run generate` 命令 |
| T7 | **$schema URL 不可验证** | `$schema` 指向 `openoba.com` 但无本地 fallback | 同时输出本地 `schema/decision-object-v1.0.schema.json`；`$schema` 保留远程 URL 但在 README 中标注本地路�?|
| T8 | **version �?spec 的关系令人困�?* | v1.1 文件 `version: "1.1.0"` �?`spec: "decision-object-v1.0"` | �?description �?README 中明确："spec = DO 格式版本（永�?v1.0），version = 向量集版本（v1.2.0），compliance_profile = 合规配置版本" |
| T9 | **删除 vs 设为 null �?JCS 语义差异** | c3f22df 事故：em-dash 空格修复�?AV-003/004/005 �?audit.hash 变化。根因是 delete-vs-null �?JCS 下产生不�?canonical bytes | 生成器中明确：物理删除（`delete obj.field`）而非设为 null。代码注释标�?JCS: Omit over Null"原则 |
| T10 | **跨版本兼容表述模�?* | README �?已移�?expected_sha256"�?v1.0 文件仍保�?| 生成器输出的 `metadata` 中声明清晰的版本边界：`breaking_from: ["v1.0","v1.1"]` |

### 额外设计约束（从审计报告学习�?
| # | 约束 | 来源 | 措施 |
|---|------|------|------|
| C1 | **脚本必须是唯一的可复现入口** | P1-1 | `generate-vectors.cjs` 是唯一入口。向量的任何修改必须通过修改该脚本实�?|
| C2 | **向量文件�?git commit 锁定** | 审计建议 | README 中明确："向量文件的权威版本以 git commit hash 锁定。生成脚本是便于理解的参考实�? |
| C3 | **所有字符串字段禁止硬编码换行符** | JCS 确定性要�?| 所�?`scenario`/`note`/`reason` 等字符串字段不得包含 `\r`、`\n`、非打印字符 |
| C4 | **DO 内字段顺序必须符�?JCS 对象键序** | RFC 8785 | 生成脚本中对象按 Unicode 键序排列（或�?JSON.stringify 后不做任何重新排序） |

---

## Part B: 63 条静态决策向量完整清�?
### B.1 继承�?v1.0/v1.1 的场景模式（不继承数据，只继承测试意图）

v1.0/v1.1 的测试设计模式是成熟的，v1.2 在新�?63 �?DO 中应该覆盖这�?*场景类别**�?
| v1.0/v1.1 场景类别 | v1.2 对应 DO | 说明 |
|-------------------|-------------|------|
| security-baseline（DENY + PASS 配对）| DO-001, DO-002 | 规则在匹�?不匹配时返回正确决策 |
| compliance-workflow（REQUEST_HUMAN + PASS）| DO-013, DO-014 | 合规规则的人类审批流�?|
| dangerous-command（DENY + PASS）| DO-003, DO-004 | 危险命令检�?|
| critical-infrastructure（DENY）| DO-005 | 关键系统保护 |
| policy-versioning（PASS）| DO-006 | 规则集版本独立�?|
| empty-policies（PASS）| DO-007 | 空规则集下的默认行为 |
| override-safe-direction（ALLOW）| DO-011 | Ring 3 放行覆盖 Ring 0 拒绝（安全方向）|
| override-unsafe-direction（ALLOW）| DO-012 | �?—（不安全方向，触发警告）|
| ring-0-precedence（DENY）| DO-008 | Ring 0 拒绝优先�?Ring 3 放行 |
| ring-0-halt-shortcircuit（EMERGENCY_HALT）| DO-009 | Ring 0 紧急终止短路所有评�?|
| severity-escalation（DENY × 2）| DO-010 | 严重性升级（medium �?high �?critical）|
| all-operators�? DOs）| DO-042~DO-050 | 各运算符系统覆盖 |
| multi-agent-trust（ESCALATE）| DO-017 | 低信�?Agent 在敏感上下文中升�?|
| auto-correction（CORRECT）| DO-021 | 自动纠偏（纠正参数后放行）|
| unless-exemption�? DOs）| DO-024~DO-026 | unless 豁免机制 |
| null-safety�? DOs）| DO-027, DO-028 | 缺失字段 vs 空�?vs null |
| type-safety（PASS）| DO-029 | 字符�?"5" �?数字 5 |
| metadata-decision（ALLOW fallback）| DO-030 | metadata.decision fallback（无规则命中）|
| operator-* 系列�?0 DOs）| DO-041~DO-050 | 13 种运算符系统覆盖 |

### B.2 完整 63 条清�?
**编号规则**: DO-001 ~ DO-063

#### DO-001 ~ DO-010: 安全基线（Security Baseline�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-001 | DENY | 财务 Agent 执行 sudo 命令 �?�? Guardian 拦截 | eq, ring=0, security |
| DO-002 | PASS | 同一安全规则对安全的 read_file 操作不触�?| eq, 规则选择性匹�?|
| DO-003 | DENY | 危险命令 rm -rf / �?被拦�?| neq, dangerous-command |
| DO-004 | PASS | 安全�?ls 命令 �?通过 | neq, 安全命令 |
| DO-005 | DENY | 关键基础设施 Agent 被操�?write_file �?/etc/ | critical, starts_with |
| DO-006 | PASS | 规则集版本变更后，新�?DENY 规则正确生效 | rule_set_version |
| DO-007 | PASS | 空规则集 �?默认 ALLOW（metadata.decision fallback）| empty-policies |
| DO-008 | DENY | Ring 0 DENY vs Ring 3 ALLOW �?Ring 0 优先 | ring-0-precedence |
| DO-009 | EMERGENCY_HALT | 关键异常触发立即终止 �?短路所有评�?| ring-0, short-circuit |
| DO-010 | DENY | 严重性升�? medium DENY + 上下文叠�?�?severity=high | severity-escalation |

#### DO-011 ~ DO-020: 覆盖与豁免（Override & Exemption�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-011 | ALLOW | Ring 3 ALLOW override Ring 0 DENY（安全方向）| override-safe, instruction field |
| DO-012 | ALLOW | Ring 3 ALLOW override Ring 0 DENY（不安全方向 �?触发 NOTIFY）| override-unsafe, NOTIFY 伴随 |
| DO-013 | REQUEST_HUMAN | PII 上下文访�?�?需要人类审�?| compliance, PHI |
| DO-014 | PASS | PII 上下文但操作为只�?�?无需审批 | compliance, 上下文差�?|
| DO-015 | REQUEST_HUMAN | 非工作时间高危写操作 �?需要主管审�?| time-based, 高风�?|
| DO-016 | REQUEST_HUMAN | 医疗数据访问 �?HIPAA 合规触发人类审批 | compliance, PHI-medical |
| DO-017 | ESCALATE | 低信�?Agent (reputation=25) 在高风险上下�?�?升级 | multi-agent, reputation |
| DO-018 | ESCALATE | 跨域操作 �?升级到域管理�?Agent | multi-agent, cross-domain |
| DO-019 | ESCALATE | 未知工具 tool.name="unknown_tool" �?升级 | unknown-tool |
| DO-020 | ALLOW | 已知安全工具 in allowlist �?直接放行 | in, allowlist |

#### DO-021 ~ DO-030: 纠偏与豁免（Correction & Unless�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-021 | CORRECT | 自动纠偏: 大写路径 �?小写 | correction field, ring 3 |
| DO-022 | CORRECT | 单位转换: "1024KB" �?"1MB" | correction, unit-convert |
| DO-023 | CORRECT | 路径规范�? "a/./b/../c" �?"a/c" | correction, path-normalize |
| DO-024 | ALLOW | unless 豁免: 文件路径匹配测试文件 �?豁免生效 | unless, matches |
| DO-025 | DENY | unless 条件不满�?�?规则正常生效 | unless, no-match |
| DO-026 | ALLOW | unless 豁免 + 额外条件都满�?| unless, multi-condition |
| DO-027 | PASS | Null-safe: 缺失字段 `!=` 比较 �?返回 false，规则不触发 | null-safety, neq |
| DO-028 | PASS | Null-safe: 缺失字段 `=` 比较 �?返回 false | null-safety, eq |
| DO-029 | PASS | 严格类型: 字符�?"5" vs 数字 5 �?`eq` 返回 false | type-safety |
| DO-030 | ALLOW | metadata.decision=ALLOW fallback（无规则命中）| metadata, fallback |

#### DO-031 ~ DO-040: 通知/隔离/回滚（Notify/Quarantine/Rollback�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-031 | NOTIFY | 异常操作检�?�?发送通知但不拦截 | notify, anomaly |
| DO-032 | NOTIFY | 操作审计记录 �?记录所�?exec 调用 | notify, audit-log |
| DO-033 | NOTIFY | 阈值预�? API 调用次数 > 1000/小时 | notify, threshold |
| DO-034 | NOTIFY | 伴随 DENY 的通知 �?拦截+通知双输�?| notify, accompany-deny |
| DO-035 | QUARANTINE | 可疑文件隔离: 检测到 .exe �?web 下载 | quarantine, ring 1 |
| DO-036 | QUARANTINE | 异常操作模式 �?隔离 Agent 操作权限 | quarantine, anomaly |
| DO-037 | QUARANTINE | 速率限制触发: 同一操作 10 �?�?�?隔离 | quarantine, rate-limit |
| DO-038 | ROLLBACK | 快照回滚: 操作失败 �?回滚到快照点 | rollback, snapshot |
| DO-039 | ROLLBACK | 部分失败回滚: 批量操作�?1/3 失败 �?回滚 | rollback, partial |
| DO-040 | ROLLBACK | 交易回退: 金额超出阈�?�?回退整个事务 | rollback, transaction |

#### DO-041 ~ DO-050: 运算符全覆盖（Operator Coverage�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-041 | ALLOW | `in`: tool.name in ["read","search","list"] | in |
| DO-042 | ALLOW | `not_in`: tool.name not_in ["exec","write","delete"] | not_in |
| DO-043 | ALLOW | `contains`: file_content contains "SAFE_MARKER" | contains |
| DO-044 | DENY | `matches`: 恶意正则可疑输入（ReDoS防护测试）| matches, ReDoS |
| DO-045 | REQUEST_HUMAN | `gt`: risk_score > 80 �?需要审�?| gt |
| DO-046 | ALLOW | `lte`: risk_score �?50 �?放行 | lte |
| DO-047 | ALLOW | `starts_with`: tool.name starts_with "safe_" | starts_with |
| DO-048 | ALLOW | `ends_with`: file_name ends_with ".log" | ends_with |
| DO-049 | DENY | `exists`: context.high_risk_flag exists and is true | exists, truthy |
| DO-050 | PASS | `exists`: context.high_risk_flag 不存�?�?不触�?| exists, missing |

#### DO-051 ~ DO-060: 工作流编排（WORKFLOW Series�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-051 | WORKFLOW | 多步骤工作流启动: deploy-app �?build �?test �?deploy | workflow, multi-step |
| DO-052 | WORKFLOW | 条件分支工作�? if staging �?deploy-staging else �?deploy-prod | workflow, branch |
| DO-053 | WORKFLOW | 审批节点工作�? 敏感操作需要三级审�?| workflow, approval |
| DO-054 | WORKFLOW | 工作流结�?�?最后一个步骤完�?| workflow, completion |
| DO-055 | WORKFLOW_WAITING | 等待人类审批 �?status: pending | waiting, human-approval |
| DO-056 | WORKFLOW_WAITING | 等待时间窗口 �?操作仅在 9:00-18:00 允许 | waiting, time-window |
| DO-057 | WORKFLOW_WAITING | 等待前置任务 �?dependency not yet complete | waiting, dependency |
| DO-058 | WORKFLOW_PROGRESS | 步骤推进: Step 1/5 完成 �?Step 2/5 | progress, step |
| DO-059 | WORKFLOW_PROGRESS | 阶段完成: phase=build 完成 �?phase=test | progress, phase |
| DO-060 | WORKFLOW_PROGRESS | 最终步骤推�?�?触发生成最�?DO | progress, final |

#### DO-061 ~ DO-063: 边缘穷尽（Edge Cases�?
| ID | 决策 | 场景 | 关键测试�?|
|----|------|------|---------|
| DO-061 | DENY | 对象深层比较: context.tool.args == {cmd:"rm",opts:"-rf"} | object-deep-eq |
| DO-062 | PASS | 空扩展规范化: extensions=[] 时平面哈希仍正确计算 | empty-extensions |
| DO-063 | DENY | 整数安全范围: execution_count > Number.MAX_SAFE_INTEGER �?拒绝 | integer-safe-range |

---

## Part C: 审计哈希向量 12 �?
| AV | �?DO | 决策 | 测试意图 |
|----|-------|------|---------|
| AV-001 | DO-001 | DENY | 安全拦截 �?Ring 0 单规则命�?|
| AV-002 | DO-013 | REQUEST_HUMAN | 合规审批 �?PII 上下�?|
| AV-003 | DO-011 | ALLOW | Override 安全方向 �?多规�?matched_rules |
| AV-004 | DO-009 | EMERGENCY_HALT | �? 紧急终�?�?短路评估 |
| AV-005 | DO-017 | ESCALATE | 低信�?Agent 升级 |
| AV-006 | DO-024 | ALLOW | Unless 豁免触发 |
| AV-007 | DO-027 | PASS | Null-safe 字段访问 |
| AV-008 | DO-011 | (回归) | **陈旧回归向量** �?canonical_bytes �?AV-003，audit.hash 保留 v1.1 旧�?|
| AV-009 | DO-021 | CORRECT | 自动纠偏 |
| AV-010 | DO-031 | NOTIFY | 异常通知记录 |
| AV-011 | DO-038 | ROLLBACK | 快照回滚 |
| AV-012 | DO-051 | WORKFLOW | 工作流启�?|

### AV-008 构造方�?
```javascript
// AV-008 不通过正常平面哈希流程生成
// 步骤:
// 1. �?AV-003 深拷�?// 2. canonical_bytes 保持不变（与 AV-003 逐字节相同）
// 3. audit.hash 硬编码为以下值——该值在 v1.1 审计报告中发�?//    来自 commit c3f22df 的旧�?AV-003（使�?JSON.stringify 而非 JCS +
//    无分层哈希架构）
// 4. vector_ref 设为 "AV-003" (不是 "DO-010-STALE")
// 5. 添加 source_commit: "c3f22df" 字段

av008.audit.hash = 'sha256:342b4e9652101d0b75ef39bed7f5a7e6de4d890618ec6eeafe3a9a3490ddb64d';
av008.vector_ref = 'AV-003';
av008.source_commit = 'c3f22df';
av008.note = 'STALE REGRESSION VECTOR: canonical_hex identical to AV-003, audit.hash intentionally stale (v1.1 legacy value). Any validator that recomputes from first principles will detect MISMATCH; cached/shorthand validators will falsely PASS.';
```

## Part D: 动态向�?26 �?
### Temporal (TD-001 ~ TD-010)

| ID | 测试目标 |
|----|---------|
| TD-001 | within 1s: 操作�?1 秒内重复触发限制 |
| TD-002 | within 1min: 1 分钟内超过阈�?|
| TD-003 | within 1h: 1 小时内操作次数限�?|
| TD-004 | within 1d: 每日配额限制 |
| TD-005 | within 30d: 月度配额限制 |
| TD-006 | 边界: 恰好 at 窗口边界 |
| TD-007 | 边界: 跨时区时间窗�?(UTC+8 vs UTC) |
| TD-008 | 边界: 闰秒处理 |
| TD-009 | 并发: 同一毫秒内多个判�?|
| TD-010 | 并发: 高并发下 within 窗口计数准确�?|

### Seeded (SD-001 ~ SD-008)

| ID | 测试目标 |
|----|---------|
| SD-001 | 同一种子 seed=42 �?相同 override 结果 |
| SD-002 | 同一种子 seed=42 再次 �?结果一�?|
| SD-003 | 不同种子 seed=99 �?不同结果 |
| SD-004 | 种子分布均匀�? 1000 次种�?7, 统计分布 |
| SD-005 | 空种�?seed=null �?使用当前时间�?|
| SD-006 | 负数种子 seed=-1 �?取绝对�?|
| SD-007 | 大种�?seed=2^53 �?安全整数边界 |
| SD-008 | 字符串种�?seed="abc" �?hash �?整数 |

### Stateful (ST-001 ~ ST-008)

| ID | 测试目标 |
|----|---------|
| ST-001 | combine.state: �?key 多次 combine �?正确累积 |
| ST-002 | combine.state: �?key 溢出保护 �?拒绝超限�?|
| ST-003 | combine.state: �?key 独立累积 |
| ST-004 | combine.state: 不同 key 不互相干�?|
| ST-005 | combine.state: key �?reset 操作 |
| ST-006 | combine.state: key �?expire 操作（时间过期）|
| ST-007 | combine.state: 空初始状�?|
| ST-008 | combine.state: 跨规则共享状�?|

---

## Part E: 预留向量

| ID | 类型 | 决策 | 预留原因 | 目标版本 |
|----|------|------|---------|:---:|
| DO-064 | 决策向量 | DELEGATE | rulsynor 引擎代码路径未实�?| v1.3 |
| AV-013 | 审计哈希向量 | �?| depends on DO-064 | v1.3 |

这两个预留向量在输出 JSON 中以 `reserved_vectors` 字段声明，不生成具体内容�?
---

## Part F: 验证清单

生成脚本 `generate-vectors.cjs` 执行完毕后，必须通过以下自检�?
- [ ] 63 �?`vectors[]` 全部生成，无空缺 ID
- [ ] 26 �?`dynamic_vectors` 全部生成
- [ ] 12 �?`audit_vectors` 全部生成
- [ ] AV-001~AV-007、AV-009~AV-012 �?`audit.hash` 五步法重�?= MATCH
- [ ] AV-008 �?`canonical_bytes` = AV-003 �?`canonical_bytes`
- [ ] AV-008 �?`audit.hash` �?AV-003 �?`audit.hash`
- [ ] �?`__` 前缀字段泄漏到输�?JSON
- [ ] 所�?`vector_ref` 指向真实存在�?DO ID
- [ ] 实际决策类型集合 = metadata.decision_types_covered
- [ ] 所有字符串字段�?`\r`、`\n` 字符
- [ ] `activated_fields` 不含 `human_oversight`（CORE #13�?- [ ] `profile_hash` 参与 JCS �?`audit.hash` 变化（非死代码）
- [ ] `rule_set_version.id` = SHA-256(JCS(policies))

---

> *101 条向量。每条都必须是经得起独立验证的事实，不是宣称的数字�?
