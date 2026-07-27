# generate-vectors.cjs Review — 7 发现

### P0: 统计不一致

| 类型 | 期望 | 实际 | 说明 |
|------|:---:|:---:|------|
| ALLOW | 12 | 11 | DO-012 category=ALLOW 但 decision_type=DENY → 被计为 DENY，不是 ALLOW |
| DENY | 10 | 12 | 多了 DO-034 (NOTIFY+DENY) 和 DO-012 (override-unsafe 实际是 DENY) |
| NOTIFY | 4 | 3 | DO-034 category=NOTIFY 但 decision_type=DENY → 被计为 DENY |

**结论**：这是设计预期——DO-012 测试 ALLOW 类别的 override unsafe direction（结果是 DENY），DO-034 测试 NOTIFY 伴随 DENY。统计用 decision_type 而非 category，两者各有用途。

### P0: 重复 Rule ID

`rule-exists-deny` 在 DO-049 和 DO-050 中重复使用：
- DO-049: "exists operator — truthy value triggers DENY"
- DO-050: "exists operator — field missing → false → PASS"

**修复**：DO-050 改名为 `rule-exists-missing` 或 `rule-exists-pass`

### P0: unless 未参与 policy hash 计算

`unless` 是 rule 定义的字段，但 `buildDO` 中 policy hash 计算用 `const { hash, ...rest } = p` 然后 JCS(rest)。`unless` 会在 rest 中……等等，看看 paramsToStrip：

```js
const policiesWithHash = policies.map(p => {
    const { hash, ...rest } = p;
    return { ...p, hash: 'sha256:' + sha256(jcs(rest)) };
});
```

这会把 `hash` 从 rest 中剥离，但 `unless` 保留在 rest 中。所以 JCS(rest) 实际上包含 unless。Review 误报——因为 `unless` 不在 hash 计算的字符串切片中显示。

### P1: 未使用变量 sessionId

第 144 行 `const sessionId = uuidv7();` 从未使用。

### P1: lte 运算符无覆盖

设计文档说 lte 覆盖在 DO-046（同 lt），但代码中 DO-046 的 when 条件是 `{ lt: 50 }` 没有 `lte: 50`。需要补充一个 lte 测试或归入同一条。

### P2: UUID 非确定性

`crypto.randomBytes(6)` 导致每次运行产生不同的 decision_id / execution_trace_id → 不同的 canonical_bytes。虽然不影响审计向量验证（verify.js 用 DO 内嵌的 canonical_bytes 而非重新生成），但重新运行 `generate-vectors.cjs` 会得到不同的 JSON 文件。

### 修复方案
