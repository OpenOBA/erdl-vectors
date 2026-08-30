/**
 * v-engine — V-ENGINE 向量生成器（SPEC v2.0 §44.1）
 *
 * 生成 V-ENGINE 201 条向量：
 *   - 节点语义 136 = 34 节点 × 4 场景（正常/边界/异常/空值）
 *   - 求值约束 35（E1-E12 可向量化子集）
 *   - Simple 编译 30（30 运算符 → 树）
 *
 * 向量格式：{ id, node_group, node, scenario, expr_tree(S-expr), context, expected{value,type,warnings} }
 * 预期值由 @openoba/erdl 参考引擎产出（单实现来源，第三方比对后续补）。
 *
 * @license MIT
 */
import { ExprTreeEvaluator, objectContext } from '@openoba/erdl';
import { fromSExpr, toSExpr } from '@openoba/erdl';
import { toDecimalString } from '@openoba/erdl';
import { compileSimpleCondition } from '@openoba/erdl';
import { compileDecisionTable } from '@openoba/erdl';
import { GuardStateManager } from '@openoba/erdl';
import { VirtualClock } from '@openoba/erdl';
import { renderNode } from '@openoba/erdl';
import { canonicalize } from 'json-canonicalize';

/** E5（§10.2）：expr（Expression 投影面）与 field/operator/value（Simple 投影面）互斥 */
function checkExprExclusive(cond) {
  const hasExpr = cond && cond.expr !== undefined && cond.expr !== null;
  const hasSimple = cond && (cond.field !== undefined || cond.operator !== undefined || cond.value !== undefined);
  if (hasExpr && hasSimple) {
    return { field: 'conditions', code: 'WHEN_EXPR_EXCLUSIVE', message: 'expr 与 field/operator/value 互斥', level: 'error' };
  }
  return null;
}

const AS_OF = new Date('2026-08-15T00:00:00Z');
/** 序列化求值结果为跨实现可比较的 { value, type } */
export function serializeValue(v) {
    if (v === undefined)
        return { value: '__undefined__', type: 'undefined' };
    if (v === null)
        return { value: null, type: 'null' };
    if (typeof v === 'boolean')
        return { value: v, type: 'boolean' };
    if (typeof v === 'number')
        return { value: v, type: 'number' };
    if (typeof v === 'string')
        return { value: v, type: 'string' };
    if (Array.isArray(v))
        return { value: v, type: 'array' };
    if (v instanceof Date)
        return { value: v.toISOString(), type: 'date' };
    // Rational（bigint num/den）→ 定点小数字符串（整数不带小数点，非整数去尾零）
    if (typeof v === 'object' && v !== null && typeof v.num === 'bigint' && typeof v.den === 'bigint') {
        const r = v;
        if (r.den === 1n)
            return { value: r.num.toString(), type: 'rational' };
        return { value: toDecimalString(r, 14), type: 'rational' };
    }
    // 普通对象：JCS 字典序（键排序 + 递归），跨实现逐字节一致（§28.2）
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return { value: canonicalize(v), type: 'object' };
    }
    return { value: JSON.stringify(v), type: 'object' };
}
/** 场景 → 编号后缀（§44.1 四场景：正常/边界/异常/空值） */
const SCENARIO_INDEX = { normal: '001', boundary: '002', error: '003', null: '004' };
export const NODE_DEFS = [
    // ═══ 取值（3 节点）═══
    {
        group: '取值', node: 'field',
        cases: [
            { scenario: 'normal', tree: { field: 'age' }, ctx: { age: 35 } },
            { scenario: 'boundary', tree: { field: 'user.name' }, ctx: { user: { name: '张三' } } },
            { scenario: 'null', tree: { field: 'missing' }, ctx: {} },
            { scenario: 'error', tree: { field: 'a.b' }, ctx: { a: 1 } },
        ],
    },
    {
        group: '取值', node: 'var',
        cases: [
            { scenario: 'normal', tree: { var: '$' }, ctx: { a: 1 } },
            { scenario: 'boundary', tree: { var: '$.user.name' }, ctx: { user: { name: 'x' } } },
            { scenario: 'null', tree: { var: '$.missing' }, ctx: {} },
            { scenario: 'error', tree: { var: '$.a.b' }, ctx: { a: 1 } },
        ],
    },
    {
        group: '取值', node: 'literal',
        cases: [
            { scenario: 'normal', tree: 42, ctx: {} },
            { scenario: 'boundary', tree: 0, ctx: {} },
            { scenario: 'null', tree: null, ctx: {} },
            { scenario: 'error', tree: 'e\u0301', ctx: {} },
        ],
    },
    // ═══ 逻辑（3 节点）═══
    {
        group: '逻辑', node: 'and',
        cases: [
            { scenario: 'normal', tree: { and: [true, true] }, ctx: {} },
            { scenario: 'boundary', tree: { and: [true, false] }, ctx: {} },
            { scenario: 'null', tree: { and: [1, true] }, ctx: {} },
            { scenario: 'error', tree: { and: [{ div: [1, 0] }, true] }, ctx: {} },
        ],
    },
    {
        group: '逻辑', node: 'or',
        cases: [
            { scenario: 'normal', tree: { or: [false, true] }, ctx: {} },
            { scenario: 'boundary', tree: { or: [false, false] }, ctx: {} },
            { scenario: 'null', tree: { or: [0, false] }, ctx: {} },
            { scenario: 'error', tree: { or: [{ div: [1, 0] }, false] }, ctx: {} },
        ],
    },
    {
        group: '逻辑', node: 'not',
        cases: [
            { scenario: 'normal', tree: { not: false }, ctx: {} },
            { scenario: 'boundary', tree: { not: true }, ctx: {} },
            { scenario: 'null', tree: { not: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { not: { div: [1, 0] } }, ctx: {} },
        ],
    },
    // ═══ 比较（6 节点）═══
    {
        group: '比较', node: 'eq',
        cases: [
            { scenario: 'normal', tree: { eq: [{ field: 'age' }, 35] }, ctx: { age: 35 } },
            { scenario: 'boundary', tree: { eq: [{ field: 'age' }, 34] }, ctx: { age: 35 } },
            { scenario: 'null', tree: { eq: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { eq: [{ add: [1, 'x'] }, 1] }, ctx: {} },
        ],
    },
    {
        group: '比较', node: 'ne',
        cases: [
            { scenario: 'normal', tree: { ne: [{ field: 'age' }, 34] }, ctx: { age: 35 } },
            { scenario: 'boundary', tree: { ne: [{ field: 'age' }, 35] }, ctx: { age: 35 } },
            { scenario: 'null', tree: { ne: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { ne: [{ add: [1, 'x'] }, 1] }, ctx: {} },
        ],
    },
    {
        group: '比较', node: 'gt',
        cases: [
            { scenario: 'normal', tree: { gt: [{ field: 'age' }, 60] }, ctx: { age: 61 } },
            { scenario: 'boundary', tree: { gt: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'null', tree: { gt: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { gt: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    {
        group: '比较', node: 'gte',
        cases: [
            { scenario: 'normal', tree: { gte: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'boundary', tree: { gte: [{ field: 'age' }, 60] }, ctx: { age: 59 } },
            { scenario: 'null', tree: { gte: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { gte: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    {
        group: '比较', node: 'lt',
        cases: [
            { scenario: 'normal', tree: { lt: [{ field: 'age' }, 60] }, ctx: { age: 59 } },
            { scenario: 'boundary', tree: { lt: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'null', tree: { lt: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { lt: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    {
        group: '比较', node: 'lte',
        cases: [
            { scenario: 'normal', tree: { lte: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'boundary', tree: { lte: [{ field: 'age' }, 60] }, ctx: { age: 61 } },
            { scenario: 'null', tree: { lte: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { lte: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    // ═══ 集合（1 节点）═══
    {
        group: '集合', node: 'in',
        cases: [
            { scenario: 'normal', tree: { in: [{ field: 'cat' }, ['罕见重疾', '普通重疾']] }, ctx: { cat: '罕见重疾' } },
            { scenario: 'boundary', tree: { in: [{ field: 'cat' }, ['a', 'b']] }, ctx: { cat: 'c' } },
            { scenario: 'null', tree: { in: [{ field: 'missing' }, ['a']] }, ctx: {} },
            { scenario: 'error', tree: { in: [{ field: 'cat' }, 'not-array'] }, ctx: { cat: 'a' } },
        ],
    },
    // ═══ 字符串（4 节点）═══
    {
        group: '字符串', node: 'contains',
        cases: [
            { scenario: 'normal', tree: { contains: [{ field: 'cmd' }, 'rm'] }, ctx: { cmd: 'rm -rf /' } },
            { scenario: 'boundary', tree: { contains: [{ field: 'cmd' }, 'ls'] }, ctx: { cmd: 'rm -rf /' } },
            { scenario: 'null', tree: { contains: [{ field: 'missing' }, 'x'] }, ctx: {} },
            { scenario: 'error', tree: { contains: [{ field: 'cmd' }, 123] }, ctx: { cmd: 'rm' } },
        ],
    },
    {
        group: '字符串', node: 'match',
        cases: [
            { scenario: 'normal', tree: { match: [{ field: 'cmd' }, '^(rm|sudo)$'] }, ctx: { cmd: 'rm' } },
            { scenario: 'boundary', tree: { match: [{ field: 'cmd' }, '^rm$'] }, ctx: { cmd: 'sudo' } },
            { scenario: 'null', tree: { match: [{ field: 'missing' }, 'x'] }, ctx: {} },
            { scenario: 'error', tree: { match: [{ field: 'cmd' }, '(a+)+$'] }, ctx: { cmd: 'aaaa' } },
        ],
    },
    {
        group: '字符串', node: 'starts_with',
        cases: [
            { scenario: 'normal', tree: { starts_with: [{ field: 'name' }, 'safe_'] }, ctx: { name: 'safe_read' } },
            { scenario: 'boundary', tree: { starts_with: [{ field: 'name' }, 'safe_'] }, ctx: { name: 'unsafe_read' } },
            { scenario: 'null', tree: { starts_with: [{ field: 'missing' }, 'x'] }, ctx: {} },
            { scenario: 'error', tree: { starts_with: [{ field: 'name' }, 1] }, ctx: { name: 'safe' } },
        ],
    },
    {
        group: '字符串', node: 'ends_with',
        cases: [
            { scenario: 'normal', tree: { ends_with: [{ field: 'name' }, '.log'] }, ctx: { name: 'sys.log' } },
            { scenario: 'boundary', tree: { ends_with: [{ field: 'name' }, '.log'] }, ctx: { name: 'sys.txt' } },
            { scenario: 'null', tree: { ends_with: [{ field: 'missing' }, '.x'] }, ctx: {} },
            { scenario: 'error', tree: { ends_with: [{ field: 'name' }, 1] }, ctx: { name: 'x' } },
        ],
    },
    // ═══ 存在/量纲（3 节点）═══
    {
        group: '存在量纲', node: 'exists',
        cases: [
            { scenario: 'normal', tree: { exists: { field: 'x' } }, ctx: { x: 1 } },
            { scenario: 'boundary', tree: { exists: { field: 'x' } }, ctx: {} },
            { scenario: 'null', tree: { exists: { field: 'x' } }, ctx: { x: null } },
            { scenario: 'error', tree: { exists: { div: [1, 0] } }, ctx: {} },
        ],
    },
    {
        group: '存在量纲', node: 'length',
        cases: [
            { scenario: 'normal', tree: { length: { field: 's' } }, ctx: { s: 'abc' } },
            { scenario: 'boundary', tree: { length: { field: 'arr' } }, ctx: { arr: [1, 2, 3, 4] } },
            { scenario: 'null', tree: { length: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { length: { field: 'n' } }, ctx: { n: 42 } },
        ],
    },
    {
        group: '存在量纲', node: 'between',
        cases: [
            { scenario: 'normal', tree: { between: [{ field: 'age' }, 16, 60] }, ctx: { age: 30 } },
            { scenario: 'boundary', tree: { between: [{ field: 'age' }, 16, 60] }, ctx: { age: 60 } },
            { scenario: 'null', tree: { between: [{ field: 'missing' }, 1, 10] }, ctx: {} },
            { scenario: 'error', tree: { between: [{ field: 'age' }, 16, 60] }, ctx: { age: '30' } },
        ],
    },
    // ═══ 量词（3 节点）═══
    {
        group: '量词', node: 'all',
        cases: [
            { scenario: 'normal', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [1, 2, 3] } },
            { scenario: 'boundary', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
            { scenario: 'null', tree: { all: { binding: 'x', over: { field: 'missing' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: {} },
            { scenario: 'error', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: 'not-array' } },
        ],
    },
    {
        group: '量词', node: 'any',
        cases: [
            { scenario: 'normal', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 2] } } }, ctx: { items: [1, 2, 3] } },
            { scenario: 'boundary', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 2] } } }, ctx: { items: [1, 2] } },
            { scenario: 'null', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
            { scenario: 'error', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: 5 } },
        ],
    },
    {
        group: '量词', node: 'none',
        cases: [
            { scenario: 'normal', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 10] } } }, ctx: { items: [1, 2, 3] } },
            { scenario: 'boundary', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: true } }, ctx: { items: [] } },
            { scenario: 'null', tree: { none: { binding: 'x', over: { field: 'missing' }, predicate: true } }, ctx: {} },
            { scenario: 'error', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: true } }, ctx: { items: 'x' } },
        ],
    },
    // ═══ 算术（5 节点）═══
    {
        group: '算术', node: 'add',
        cases: [
            { scenario: 'normal', tree: { add: [1, 2] }, ctx: {} },
            { scenario: 'boundary', tree: { add: [0.1, 0.2] }, ctx: {} },
            { scenario: 'null', tree: { add: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { add: [1, 'x'] }, ctx: {} },
        ],
    },
    {
        group: '算术', node: 'sub',
        cases: [
            { scenario: 'normal', tree: { sub: [5, 3] }, ctx: {} },
            { scenario: 'boundary', tree: { sub: [0.3, 0.1] }, ctx: {} },
            { scenario: 'null', tree: { sub: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { sub: [5] }, ctx: {} },
        ],
    },
    {
        group: '算术', node: 'mul',
        cases: [
            { scenario: 'normal', tree: { mul: [3, 4] }, ctx: {} },
            { scenario: 'boundary', tree: { mul: [0.1, 0.2] }, ctx: {} },
            { scenario: 'null', tree: { mul: [{ field: 'missing' }, 2] }, ctx: {} },
            { scenario: 'error', tree: { mul: [2, 'x'] }, ctx: {} },
        ],
    },
    {
        group: '算术', node: 'div',
        cases: [
            { scenario: 'normal', tree: { div: [4, 3] }, ctx: {} },
            { scenario: 'boundary', tree: { div: [10, 0] }, ctx: {} },
            { scenario: 'null', tree: { div: [{ field: 'missing' }, 2] }, ctx: {} },
            { scenario: 'error', tree: { div: [10, 2, 5] }, ctx: {} },
        ],
    },
    {
        group: '算术', node: 'round',
        cases: [
            { scenario: 'normal', tree: { round: [3.5] }, ctx: {} },
            { scenario: 'boundary', tree: { round: [4.5] }, ctx: {} },
            { scenario: 'null', tree: { round: [{ field: 'missing' }] }, ctx: {} },
            { scenario: 'error', tree: { round: ['x'] }, ctx: {} },
        ],
    },
    // ═══ 时间（5 节点）═══
    {
        group: '时间', node: 'days_between',
        cases: [
            { scenario: 'normal', tree: { days_between: ['2026-01-01', '2026-01-11'] }, ctx: {} },
            { scenario: 'boundary', tree: { days_between: ['2026-01-01', '2026-01-01'] }, ctx: {} },
            { scenario: 'null', tree: { days_between: [{ field: 'missing' }, '2026-01-11'] }, ctx: {} },
            { scenario: 'error', tree: { days_between: ['not-a-date', '2026-01-11'] }, ctx: {} },
        ],
    },
    {
        group: '时间', node: 'epoch_ms',
        cases: [
            { scenario: 'normal', tree: { epoch_ms: '2026-01-01' }, ctx: {} },
            { scenario: 'boundary', tree: { epoch_ms: '1970-01-01' }, ctx: {} },
            { scenario: 'null', tree: { epoch_ms: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { epoch_ms: 'not-a-date' }, ctx: {} },
        ],
    },
    {
        group: '时间', node: 'date_add',
        cases: [
            { scenario: 'normal', tree: { date_add: { unit: 'years', base: '2024-01-15', amount: 2 } }, ctx: {} },
            { scenario: 'boundary', tree: { date_add: { unit: 'months', base: '2024-01-31', amount: 1 } }, ctx: {} },
            { scenario: 'null', tree: { date_add: { unit: 'days', base: { field: 'missing' }, amount: 1 } }, ctx: {} },
            { scenario: 'error', tree: { date_add: { unit: 'days', base: 'not-a-date', amount: 1 } }, ctx: {} },
        ],
    },
    {
        group: '时间', node: 'date_part',
        cases: [
            { scenario: 'normal', tree: { date_part: { unit: 'year', arg: '2026-08-15' } }, ctx: {} },
            { scenario: 'boundary', tree: { date_part: { unit: 'day_of_week', arg: '2026-08-15' } }, ctx: {} },
            { scenario: 'null', tree: { date_part: { unit: 'month', arg: { field: 'missing' } } }, ctx: {} },
            { scenario: 'error', tree: { date_part: { unit: 'year', arg: 'not-a-date' } }, ctx: {} },
        ],
    },
    {
        group: '时间', node: 'month_last_day',
        cases: [
            { scenario: 'normal', tree: { month_last_day: '2024-02-10' }, ctx: {} },
            { scenario: 'boundary', tree: { month_last_day: '2026-01-10' }, ctx: {} },
            { scenario: 'null', tree: { month_last_day: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { month_last_day: 'not-a-date' }, ctx: {} },
        ],
    },
    // ═══ 聚合（1 节点，fn 参数化）═══
    {
        group: '聚合', node: 'aggregate',
        cases: [
            { scenario: 'normal', tree: { count: { field: 'nums' } }, ctx: { nums: [1, 2, 3] } },
            { scenario: 'boundary', tree: { sum: { field: 'nums' } }, ctx: { nums: [0.1, 0.2, 0.3] } },
            { scenario: 'null', tree: { avg: { field: 'nums' } }, ctx: { nums: [] } },
            { scenario: 'error', tree: { min: { field: 'nums' } }, ctx: { nums: [1, 'x', 3] } },
        ],
    },
];
/** 生成 V-ENGINE 节点语义向量（34 节点 × 4 场景 = 136 条，节点内编号 §47） */
export function generateNodeVectors() {
    const ev = new ExprTreeEvaluator();
    const out = [];
    for (const def of NODE_DEFS) {
        for (const c of def.cases) {
            const node = fromSExpr(c.tree);
            const result = ev.evaluate(node, objectContext(c.ctx, AS_OF));
            const sv = serializeValue(result.value);
            out.push({
                id: `V-ENGINE-${def.node}-${SCENARIO_INDEX[c.scenario]}`,
                category: 'V-ENGINE',
                node_group: def.group,
                node: def.node,
                scenario: c.scenario,
                expr_tree: c.tree,
                context: c.ctx,
                expected: { value: sv.value, value_type: sv.type, warnings: result.warnings.map((w) => w.kind), errored: result.errored },
            });
        }
    }
    return out;
}
const CONSTRAINTS_DEFS = [
    // E1 纯函数（3）
    { constraint: 'E1', scenario: '同输入恒同输出', tree: { add: [1, 2] }, ctx: {} },
    { constraint: 'E1', scenario: '复杂表达式确定性', tree: { eq: [{ add: [0.1, 0.2] }, 0.3] }, ctx: {} },
    { constraint: 'E1', scenario: '无副作用（求值不改 context）', tree: { field: 'x' }, ctx: { x: 1 } },
    // E2 定点小数（8）
    { constraint: 'E2', scenario: '0.1+0.2=0.3 精确', tree: { add: [0.1, 0.2] }, ctx: {} },
    { constraint: 'E2', scenario: '1/3 scale=14', tree: { div: [1, 3] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 0.5→0', tree: { round: [0.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 1.5→2', tree: { round: [1.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 2.5→2', tree: { round: [2.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 3.5→4', tree: { round: [3.5] }, ctx: {} },
    { constraint: 'E2', scenario: '大数 1e21 精确', tree: { add: [1e21, 1] }, ctx: {} },
    { constraint: 'E2', scenario: '中间不舍入（0.1×3）', tree: { mul: [0.1, 3] }, ctx: {} },
    // E3/E12 求值错误折叠（6）
    { constraint: 'E3', scenario: '除零', tree: { div: [10, 0] }, ctx: {} },
    { constraint: 'E3', scenario: 'gt 类型不匹配', tree: { gt: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
    { constraint: 'E3', scenario: '非法日期', tree: { days_between: ['not-a-date', '2026-01-11'] }, ctx: {} },
    { constraint: 'E3', scenario: 'sub 单操作数', tree: { sub: [5] }, ctx: {} },
    { constraint: 'E3', scenario: 'div 三操作数', tree: { div: [10, 2, 5] }, ctx: {} },
    { constraint: 'E3', scenario: 'in 右侧非数组', tree: { in: [{ field: 'cat' }, 'x'] }, ctx: { cat: 'a' } },
    // E4 资源上限（6，全部可确定性检查；时延≤50ms 为性能目标非确定性约束，不设向量）
    { constraint: 'E4', scenario: '节点超限（65 节点）', expectThrow: true, tree: { and: Array.from({ length: 65 }, () => true) }, ctx: {} },
    { constraint: 'E4', scenario: '树深超限（>6 层）', expectThrow: true, tree: { not: { not: { not: { not: { not: { not: { not: true } } } } } } }, ctx: {} },
    { constraint: 'E4', scenario: '算术深度超限（>2）', expectThrow: true, tree: { add: [1, { add: [1, { add: [1, 2] }] }] }, ctx: {} },
    { constraint: 'E4', scenario: '数组超限（>10000）', expectThrow: true, tree: { in: [{ field: 'x' }, Array.from({ length: 10001 }, (_, i) => i)] }, ctx: { x: 1 } },
    { constraint: 'E4', scenario: '量词嵌套', expectThrow: true, tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { all: { binding: 'y', over: { field: 'items' }, predicate: true } } } }, ctx: { items: [1] } },
    { constraint: 'E4', scenario: '正则嵌套量词 ReDoS', tree: { match: [{ field: 'cmd' }, '(a+)+$'] }, ctx: { cmd: 'aaaa' } },
    // E5 when/expr 互斥（3，加载时校验 §10.2）
    { constraint: 'E5', scenario: 'expr 与 field/operator/value 互斥（违规）', expectE5Exclusive: true, tree: { expr: { eq: [{ field: 'x' }, 1] }, field: 'x', operator: 'eq', value: 1 }, ctx: {} },
    { constraint: 'E5', scenario: '仅 expr 合法', expectE5Exclusive: false, tree: { expr: { eq: [{ field: 'x' }, 1] } }, ctx: {} },
    { constraint: 'E5', scenario: '仅 field/operator/value 合法', expectE5Exclusive: false, tree: { field: 'x', operator: 'eq', value: 1 }, ctx: {} },
    // E8 量词安全折叠（3）
    { constraint: 'E8', scenario: 'all(空)=false', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
    { constraint: 'E8', scenario: 'any(空)=false', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
    { constraint: 'E8', scenario: 'none(空)=false', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: true } }, ctx: { items: [] } },
    // E10 NFC 规范化（2，分解 vs 预组合，验证求值层 NFC）
    { constraint: 'E10', scenario: 'NFC 分解字段值 == 预组合字面量', tree: { eq: [{ field: 's' }, 'café'] }, ctx: { s: 'cafe\u0301' } },
    { constraint: 'E10', scenario: 'NFC 分解字段值 contains 预组合', tree: { contains: [{ field: 's' }, 'café'] }, ctx: { s: 'cafe\u0301 au lait' } },
    // E11 undefined 哨兵（4）
    { constraint: 'E11', scenario: '字段缺失→undefined', tree: { field: 'missing' }, ctx: {} },
    { constraint: 'E11', scenario: 'eq 缺失→false', tree: { eq: [{ field: 'missing' }, 1] }, ctx: {} },
    { constraint: 'E11', scenario: 'exists 缺失→false', tree: { exists: { field: 'missing' } }, ctx: {} },
    { constraint: 'E11', scenario: 'arith 缺失→type_mismatch', tree: { add: [{ field: 'missing' }, 1] }, ctx: {} },
];
/** 生成求值约束向量（约束内编号 §47；E4 支持 expectThrow，E5 用 checkExprExclusive） */
export function generateConstraintVectors() {
    const ev = new ExprTreeEvaluator();
    const out = [];
    const idxMap = {};
    for (const c of CONSTRAINTS_DEFS) {
        const idx = (idxMap[c.constraint] = (idxMap[c.constraint] ?? 0) + 1);
        let expected;
        if (c.expectE5Exclusive !== undefined) {
            // E5：expr 与 field/operator/value 互斥（加载时校验，非求值）
            const violation = checkExprExclusive(c.tree);
            expected = { value: violation !== null, value_type: 'boolean', warnings: [], errored: false };
        }
        else if (c.expectThrow) {
            let threw = false;
            try {
                const node = fromSExpr(c.tree);
                ev.evaluate(node, objectContext(c.ctx, AS_OF));
            }
            catch {
                threw = true;
            }
            expected = { value: null, value_type: 'null', warnings: [], errored: false, threw };
        }
        else {
            const node = fromSExpr(c.tree);
            const result = ev.evaluate(node, objectContext(c.ctx, AS_OF));
            const sv = serializeValue(result.value);
            expected = { value: sv.value, value_type: sv.type, warnings: result.warnings.map((w) => w.kind), errored: result.errored };
        }
        out.push({
            id: `V-ENGINE-${c.constraint}-${String(idx).padStart(3, '0')}`,
            category: 'V-ENGINE',
            subcategory: 'constraint',
            constraint: c.constraint,
            scenario: c.scenario,
            expr_tree: c.tree,
            context: c.ctx,
            expected,
        });
    }
    return out;
}
// ═══════════════════════════════════════════════════
//  V-GLOSS / V-GLOSS-INTEGRITY / V-PROJ 22 条
// ═══════════════════════════════════════════════════
const GLOSS_DEFS = [
    { node: 'eq', tree: { eq: [{ field: 'age' }, 35] } },
    { node: 'and', tree: { and: [{ eq: [{ field: 'a' }, 1] }, { eq: [{ field: 'b' }, 2] }] } },
    { node: 'or', tree: { or: [{ eq: [{ field: 'a' }, 1] }, { eq: [{ field: 'b' }, 2] }] } },
    { node: 'not', tree: { not: { eq: [{ field: 'age' }, 35] } } },
    { node: 'in', tree: { in: [{ field: 'cat' }, ['a', 'b']] } },
    { node: 'contains', tree: { contains: [{ field: 'cmd' }, 'rm'] } },
    { node: 'exists', tree: { exists: { field: 'is_active' } } },
    { node: 'between', tree: { between: [{ field: 'age' }, 16, 60] } },
    { node: 'quantifier', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } } },
    { node: 'arith', tree: { add: [{ field: 'a' }, { field: 'b' }] } },
    { node: 'date_add', tree: { date_add: { unit: 'years', base: { field: 'date' }, amount: 2 } } },
    { node: 'aggregate', tree: { sum: { field: 'nums' } } },
];
/** V-GLOSS 12 条：树 → 期望 gloss 字符串（G1 确定性渲染，连续编号 §46） */
export function generateGlossVectors() {
    const out = [];
    GLOSS_DEFS.forEach((def, i) => {
        const node = fromSExpr(def.tree);
        const glossZh = renderNode(node, 'zh');
        out.push({
            id: `V-GLOSS-${String(i + 1).padStart(3, '0')}`,
            category: 'V-GLOSS',
            node: def.node,
            expr_tree: def.tree,
            expected: { gloss_zh: glossZh },
        });
    });
    return out;
}
/** V-GLOSS-INTEGRITY 4 条：树篡改 → gloss 变化（渲染校验绑定，G2） */
export function generateGlossIntegrityVectors() {
    const cases = [
        { id: 'V-GLOSS-INTEGRITY-001', node: 'eq', scenario: '树字面量篡改 → gloss 变化', tree: { eq: [{ field: 'age' }, 35] }, tampered: { eq: [{ field: 'age' }, 36] } },
        { id: 'V-GLOSS-INTEGRITY-002', node: 'eq', scenario: '树算子篡改 eq→ne → gloss 变化', tree: { eq: [{ field: 'age' }, 35] }, tampered: { ne: [{ field: 'age' }, 35] } },
        { id: 'V-GLOSS-INTEGRITY-003', node: 'and', scenario: '逻辑子节点删减 → gloss 变化', tree: { and: [{ eq: [{ field: 'a' }, 1] }, { eq: [{ field: 'b' }, 2] }] }, tampered: { and: [{ eq: [{ field: 'a' }, 1] }] } },
        { id: 'V-GLOSS-INTEGRITY-004', node: 'in', scenario: '集合字面量篡改 → gloss 变化', tree: { in: [{ field: 'cat' }, ['a', 'b']] }, tampered: { in: [{ field: 'cat' }, ['a', 'c']] } },
    ];
    return cases.map((c) => {
        const g1 = renderNode(fromSExpr(c.tree), 'zh');
        const g2 = renderNode(fromSExpr(c.tampered), 'zh');
        return {
            id: c.id, category: 'V-GLOSS', node: c.node, scenario: c.scenario,
            expr_tree: c.tree, tampered_tree: c.tampered,
            // 只存原始材料，diverged 由验证器重算（不把布尔结论存入预期值）
            expected: { gloss_zh: g1, tampered_gloss_zh: g2 },
        };
    });
}
/** V-PROJ 6 条：三书写投影面（Simple/Expression/决策表）编译到同一内核（E7） */
export function generateProjVectors() {
    const ev = new ExprTreeEvaluator();
    // 3 条 Simple↔Expression（编译一致性）
    const sexprPairs = [
        { name: 'eq', simple: { operator: 'eq', field: 'age', value: 35, ctx: { age: 35 } }, sexpr: { eq: [{ field: 'age' }, 35] } },
        { name: 'in', simple: { operator: 'in', field: 'cat', value: ['a', 'b'], ctx: { cat: 'a' } }, sexpr: { in: [{ field: 'cat' }, ['a', 'b']] } },
        { name: 'contains', simple: { operator: 'contains', field: 'cmd', value: 'rm', ctx: { cmd: 'rm -rf' } }, sexpr: { contains: [{ field: 'cmd' }, 'rm'] } },
    ];
    // 3 条 Simple↔决策表（决策表行编译 == Simple 编译，eq 语义）
    const dtablePairs = [
        { name: 'eq', simple: { operator: 'eq', field: 'age', value: 35, ctx: { age: 35 } }, dtable: { columns: ['age'], rows: [{ conditions: { age: 35 }, decision: 'ALLOW' }] } },
        { name: 'eq2', simple: { operator: 'eq', field: 'status', value: 'active', ctx: { status: 'active' } }, dtable: { columns: ['status'], rows: [{ conditions: { status: 'active' }, decision: 'ALLOW' }] } },
        { name: 'eq3', simple: { operator: 'eq', field: 'level', value: 3, ctx: { level: 3 } }, dtable: { columns: ['level'], rows: [{ conditions: { level: 3 }, decision: 'ALLOW' }] } },
    ];
    const out = [];
    sexprPairs.forEach((p, i) => {
        const simpleNode = compileSimpleCondition({ field: p.simple.field, operator: p.simple.operator, value: p.simple.value });
        const simpleResult = ev.evaluate(simpleNode, objectContext(p.simple.ctx, AS_OF));
        const sexprNode = fromSExpr(p.sexpr);
        const sexprResult = ev.evaluate(sexprNode, objectContext(p.simple.ctx, AS_OF));
        const ssv = serializeValue(simpleResult.value);
        const esv = serializeValue(sexprResult.value);
        out.push({
            id: `V-PROJ-${String(i + 1).padStart(3, '0')}`,
            category: 'V-PROJ',
            projection: `${p.name}(simple↔expression)`,
            simple_operator: p.simple.operator,
            simple_compiled_tree: toSExpr(simpleNode),
            expression_tree: p.sexpr,
            context: p.simple.ctx,
            expected: { simple_value: ssv.value, simple_type: ssv.type, expression_value: esv.value, expression_type: esv.type },
        });
    });
    dtablePairs.forEach((p, j) => {
        const simpleNode = compileSimpleCondition({ field: p.simple.field, operator: p.simple.operator, value: p.simple.value });
        const simpleResult = ev.evaluate(simpleNode, objectContext(p.simple.ctx, AS_OF));
        const compiled = compileDecisionTable(p.dtable);
        const dtableNode = compiled[0].expr;
        const dtableResult = ev.evaluate(dtableNode, objectContext(p.simple.ctx, AS_OF));
        const ssv = serializeValue(simpleResult.value);
        const dsv = serializeValue(dtableResult.value);
        out.push({
            id: `V-PROJ-${String(3 + j + 1).padStart(3, '0')}`,
            category: 'V-PROJ',
            projection: `${p.name}(simple↔decision-table)`,
            simple_operator: p.simple.operator,
            simple_compiled_tree: toSExpr(simpleNode),
            decision_table: p.dtable,
            decision_table_compiled_tree: toSExpr(dtableNode),
            context: p.simple.ctx,
            expected: { simple_value: ssv.value, simple_type: ssv.type, decision_value: dsv.value, decision_type: dsv.type },
        });
    });
    return out;
}
/** 汇总：V-ENGINE 201 + V-GLOSS/V-PROJ 22 = 223 条 */
export function generateAllVectors() {
    return [
        ...generateNodeVectors(),
        ...generateConstraintVectors(),
        ...generateSimpleVectors(),
        ...generateGlossVectors(),
        ...generateGlossIntegrityVectors(),
        ...generateProjVectors(),
    ];
}
const SIMPLE_DEFS = [
    // 直接节点 13
    { operator: 'eq', field: 'age', value: 35, ctx: { age: 35 } },
    { operator: 'ne', field: 'age', value: 34, ctx: { age: 35 } },
    { operator: 'gt', field: 'age', value: 60, ctx: { age: 61 } },
    { operator: 'gte', field: 'age', value: 60, ctx: { age: 60 } },
    { operator: 'lt', field: 'age', value: 60, ctx: { age: 59 } },
    { operator: 'lte', field: 'age', value: 60, ctx: { age: 60 } },
    { operator: 'in', field: 'cat', value: ['a', 'b'], ctx: { cat: 'a' } },
    { operator: 'contains', field: 'cmd', value: 'rm', ctx: { cmd: 'rm -rf' } },
    { operator: 'match', field: 'cmd', value: '^rm$', ctx: { cmd: 'rm' } },
    { operator: 'starts_with', field: 'name', value: 'safe_', ctx: { name: 'safe_read' } },
    { operator: 'ends_with', field: 'name', value: '.log', ctx: { name: 'sys.log' } },
    { operator: 'exists', field: 'x', ctx: { x: 1 } },
    { operator: 'between', field: 'age', value: [16, 60], ctx: { age: 30 } },
    // not 组合 6
    { operator: 'not_in', field: 'cat', value: ['a', 'b'], ctx: { cat: 'c' } },
    { operator: 'not_contains', field: 'cmd', value: 'rm', ctx: { cmd: 'ls' } },
    { operator: 'not_starts_with', field: 'name', value: 'safe_', ctx: { name: 'unsafe' } },
    { operator: 'not_ends_with', field: 'name', value: '.log', ctx: { name: 'sys.txt' } },
    { operator: 'not_exists', field: 'x', ctx: {} },
    { operator: 'not_between', field: 'age', value: [16, 60], ctx: { age: 70 } },
    // 长度/计数 9
    { operator: 'length_gt', field: 's', value: 2, ctx: { s: 'abc' } },
    { operator: 'length_gte', field: 's', value: 3, ctx: { s: 'abc' } },
    { operator: 'length_lt', field: 's', value: 5, ctx: { s: 'abc' } },
    { operator: 'length_lte', field: 's', value: 3, ctx: { s: 'abc' } },
    { operator: 'length_eq', field: 's', value: 3, ctx: { s: 'abc' } },
    { operator: 'count_gt', field: 'items', value: 1, ctx: { items: [1, 2] } },
    { operator: 'count_gte', field: 'items', value: 2, ctx: { items: [1, 2] } },
    { operator: 'count_lt', field: 'items', value: 5, ctx: { items: [1, 2] } },
    { operator: 'count_lte', field: 'items', value: 2, ctx: { items: [1, 2] } },
];
/** 生成 Simple 编译向量（28 条件运算符 + 2 修饰符 = 30 条） */
export function generateSimpleVectors() {
    const ev = new ExprTreeEvaluator();
    const out = [];
    for (const def of SIMPLE_DEFS) {
        const node = compileSimpleCondition({ field: def.field, operator: def.operator, value: def.value });
        const result = ev.evaluate(node, objectContext(def.ctx, AS_OF));
        const sv = serializeValue(result.value);
        out.push({
            id: `V-ENGINE-SIMPLE-${def.operator}-001`,
            category: 'V-ENGINE',
            subcategory: 'simple-compile',
            operator: def.operator,
            field: def.field,
            value: def.value,
            compiled_tree: toSExpr(node),
            context: def.ctx,
            expected: { value: sv.value, value_type: sv.type, warnings: result.warnings.map((w) => w.kind), errored: result.errored },
        });
    }
    // within/rate 2 修饰符（有状态算子，自包含状态操作序列 state_ops，第三方可重放）
    {
        const clock = new VirtualClock(0);
        const gsm = new GuardStateManager(clock);
        const stateOps = [
            { op: 'recordRate', key: 'rate-k', windowMs: 60000 },
            { op: 'recordRate', key: 'rate-k', windowMs: 60000 },
            { op: 'recordRate', key: 'rate-k', windowMs: 60000 },
            { op: 'checkRate', key: 'rate-k', maxCount: 3, windowMs: 60000 },
        ];
        const rateResult = replayStateOps(gsm, stateOps);
        out.push({
            id: `V-ENGINE-SIMPLE-rate-001`,
            category: 'V-ENGINE', subcategory: 'simple-modifier', modifier: 'rate',
            scenario: 'rate 超限检测（record×3 后 checkRate 超限）',
            state_ops: stateOps,
            expected: { value: rateResult, value_type: 'boolean' },
        });
    }
    {
        const clock = new VirtualClock(0);
        const gsm = new GuardStateManager(clock);
        const stateOps = [
            { op: 'recordWithin', key: 'within-k' },
            { op: 'checkWithin', key: 'within-k', windowMs: 60000 },
        ];
        const withinResult = replayStateOps(gsm, stateOps);
        out.push({
            id: `V-ENGINE-SIMPLE-within-001`,
            category: 'V-ENGINE', subcategory: 'simple-modifier', modifier: 'within',
            scenario: 'within 窗口检测（record×1 后窗口内有历史）',
            state_ops: stateOps,
            expected: { value: withinResult, value_type: 'boolean' },
        });
    }
    return out;
}
/** 重放状态操作序列（生成器内联；验证器独立实现同样的重放） */
function replayStateOps(gsm, ops) {
    let result = null;
    for (const o of ops) {
        switch (o.op) {
            case 'recordRate':
                gsm.recordRate(o.key, o.windowMs);
                break;
            case 'checkRate':
                result = gsm.checkRate(o.key, o.maxCount, o.windowMs);
                break;
            case 'recordWithin':
                gsm.recordWithin(o.key);
                break;
            case 'checkWithin':
                result = gsm.checkWithin(o.key, o.windowMs);
                break;
        }
    }
    return result;
}
