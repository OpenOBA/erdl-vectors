/*
 * Copyright 2026 Shenzhen Miaojing Technology Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * v-engine — V-ENGINE vector generator (SPEC v2.0 §44.1)
 *
 * Generates the V-ENGINE 201 vectors:
 *   - node semantics 136 = 34 nodes × 4 scenarios (normal/boundary/error/null)
 *   - evaluation constraints 35 (E1-E12 vectorizable subset)
 *   - Simple compilation 30 (30 operators → tree)
 *
 * Vector format: { id, node_group, node, scenario, expr_tree(S-expr), context, expected{value,type,warnings} }
 * Expected values produced by the @openoba/erdl reference engine (single-implementation source; third-party comparison to follow).
 *
 * @license Apache-2.0
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

/** E5 (§10.2): expr (Expression projection) and field/operator/value (Simple projection) are mutually exclusive */
function checkExprExclusive(cond) {
  const hasExpr = cond && cond.expr !== undefined && cond.expr !== null;
  const hasSimple = cond && (cond.field !== undefined || cond.operator !== undefined || cond.value !== undefined);
  if (hasExpr && hasSimple) {
    return { field: 'conditions', code: 'WHEN_EXPR_EXCLUSIVE', message: 'expr and field/operator/value are mutually exclusive', level: 'error' };
  }
  return null;
}

const AS_OF = new Date('2026-08-15T00:00:00Z');
/** Serialize an evaluation result into cross-implementation-comparable { value, type } */
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
    // Rational (bigint num/den) → fixed-point decimal string (integer without decimal point, non-integer trailing-zero trimmed)
    if (typeof v === 'object' && v !== null && typeof v.num === 'bigint' && typeof v.den === 'bigint') {
        const r = v;
        if (r.den === 1n)
            return { value: r.num.toString(), type: 'rational' };
        return { value: toDecimalString(r, 14), type: 'rational' };
    }
    // plain object: JCS lexicographic (key sort + recursion), cross-implementation byte-identical (§28.2)
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        return { value: canonicalize(v), type: 'object' };
    }
    return { value: JSON.stringify(v), type: 'object' };
}
/** scenario → number suffix (§44.1 four scenarios: normal/boundary/error/null) */
const SCENARIO_INDEX = { normal: '001', boundary: '002', error: '003', null: '004' };
export const NODE_DEFS = [
    // ═══ value (3 nodes) ═══
    {
        group: 'value', node: 'field',
        cases: [
            { scenario: 'normal', tree: { field: 'age' }, ctx: { age: 35 } },
            { scenario: 'boundary', tree: { field: 'user.name' }, ctx: { user: { name: 'John Doe' } } },
            { scenario: 'null', tree: { field: 'missing' }, ctx: {} },
            { scenario: 'error', tree: { field: 'a.b' }, ctx: { a: 1 } },
        ],
    },
    {
        group: 'value', node: 'var',
        cases: [
            { scenario: 'normal', tree: { var: '$' }, ctx: { a: 1 } },
            { scenario: 'boundary', tree: { var: '$.user.name' }, ctx: { user: { name: 'x' } } },
            { scenario: 'null', tree: { var: '$.missing' }, ctx: {} },
            { scenario: 'error', tree: { var: '$.a.b' }, ctx: { a: 1 } },
        ],
    },
    {
        group: 'value', node: 'literal',
        cases: [
            { scenario: 'normal', tree: 42, ctx: {} },
            { scenario: 'boundary', tree: 0, ctx: {} },
            { scenario: 'null', tree: null, ctx: {} },
            { scenario: 'error', tree: 'e\u0301', ctx: {} },
        ],
    },
    // ═══ logic (3 nodes) ═══
    {
        group: 'logic', node: 'and',
        cases: [
            { scenario: 'normal', tree: { and: [true, true] }, ctx: {} },
            { scenario: 'boundary', tree: { and: [true, false] }, ctx: {} },
            { scenario: 'null', tree: { and: [1, true] }, ctx: {} },
            { scenario: 'error', tree: { and: [{ div: [1, 0] }, true] }, ctx: {} },
        ],
    },
    {
        group: 'logic', node: 'or',
        cases: [
            { scenario: 'normal', tree: { or: [false, true] }, ctx: {} },
            { scenario: 'boundary', tree: { or: [false, false] }, ctx: {} },
            { scenario: 'null', tree: { or: [0, false] }, ctx: {} },
            { scenario: 'error', tree: { or: [{ div: [1, 0] }, false] }, ctx: {} },
        ],
    },
    {
        group: 'logic', node: 'not',
        cases: [
            { scenario: 'normal', tree: { not: false }, ctx: {} },
            { scenario: 'boundary', tree: { not: true }, ctx: {} },
            { scenario: 'null', tree: { not: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { not: { div: [1, 0] } }, ctx: {} },
        ],
    },
    // ═══ comparison (6 nodes) ═══
    {
        group: 'comparison', node: 'eq',
        cases: [
            { scenario: 'normal', tree: { eq: [{ field: 'age' }, 35] }, ctx: { age: 35 } },
            { scenario: 'boundary', tree: { eq: [{ field: 'age' }, 34] }, ctx: { age: 35 } },
            { scenario: 'null', tree: { eq: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { eq: [{ add: [1, 'x'] }, 1] }, ctx: {} },
        ],
    },
    {
        group: 'comparison', node: 'ne',
        cases: [
            { scenario: 'normal', tree: { ne: [{ field: 'age' }, 34] }, ctx: { age: 35 } },
            { scenario: 'boundary', tree: { ne: [{ field: 'age' }, 35] }, ctx: { age: 35 } },
            { scenario: 'null', tree: { ne: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { ne: [{ add: [1, 'x'] }, 1] }, ctx: {} },
        ],
    },
    {
        group: 'comparison', node: 'gt',
        cases: [
            { scenario: 'normal', tree: { gt: [{ field: 'age' }, 60] }, ctx: { age: 61 } },
            { scenario: 'boundary', tree: { gt: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'null', tree: { gt: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { gt: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    {
        group: 'comparison', node: 'gte',
        cases: [
            { scenario: 'normal', tree: { gte: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'boundary', tree: { gte: [{ field: 'age' }, 60] }, ctx: { age: 59 } },
            { scenario: 'null', tree: { gte: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { gte: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    {
        group: 'comparison', node: 'lt',
        cases: [
            { scenario: 'normal', tree: { lt: [{ field: 'age' }, 60] }, ctx: { age: 59 } },
            { scenario: 'boundary', tree: { lt: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'null', tree: { lt: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { lt: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    {
        group: 'comparison', node: 'lte',
        cases: [
            { scenario: 'normal', tree: { lte: [{ field: 'age' }, 60] }, ctx: { age: 60 } },
            { scenario: 'boundary', tree: { lte: [{ field: 'age' }, 60] }, ctx: { age: 61 } },
            { scenario: 'null', tree: { lte: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { lte: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
        ],
    },
    // ═══ set (1 node) ═══
    {
        group: 'set', node: 'in',
        cases: [
            { scenario: 'normal', tree: { in: [{ field: 'cat' }, ['rare', 'common']] }, ctx: { cat: 'rare' } },
            { scenario: 'boundary', tree: { in: [{ field: 'cat' }, ['a', 'b']] }, ctx: { cat: 'c' } },
            { scenario: 'null', tree: { in: [{ field: 'missing' }, ['a']] }, ctx: {} },
            { scenario: 'error', tree: { in: [{ field: 'cat' }, 'not-array'] }, ctx: { cat: 'a' } },
        ],
    },
    // ═══ string (4 nodes) ═══
    {
        group: 'string', node: 'contains',
        cases: [
            { scenario: 'normal', tree: { contains: [{ field: 'cmd' }, 'rm'] }, ctx: { cmd: 'rm -rf /' } },
            { scenario: 'boundary', tree: { contains: [{ field: 'cmd' }, 'ls'] }, ctx: { cmd: 'rm -rf /' } },
            { scenario: 'null', tree: { contains: [{ field: 'missing' }, 'x'] }, ctx: {} },
            { scenario: 'error', tree: { contains: [{ field: 'cmd' }, 123] }, ctx: { cmd: 'rm' } },
        ],
    },
    {
        group: 'string', node: 'match',
        cases: [
            { scenario: 'normal', tree: { match: [{ field: 'cmd' }, '^(rm|sudo)$'] }, ctx: { cmd: 'rm' } },
            { scenario: 'boundary', tree: { match: [{ field: 'cmd' }, '^rm$'] }, ctx: { cmd: 'sudo' } },
            { scenario: 'null', tree: { match: [{ field: 'missing' }, 'x'] }, ctx: {} },
            { scenario: 'error', tree: { match: [{ field: 'cmd' }, '(a+)+$'] }, ctx: { cmd: 'aaaa' } },
        ],
    },
    {
        group: 'string', node: 'starts_with',
        cases: [
            { scenario: 'normal', tree: { starts_with: [{ field: 'name' }, 'safe_'] }, ctx: { name: 'safe_read' } },
            { scenario: 'boundary', tree: { starts_with: [{ field: 'name' }, 'safe_'] }, ctx: { name: 'unsafe_read' } },
            { scenario: 'null', tree: { starts_with: [{ field: 'missing' }, 'x'] }, ctx: {} },
            { scenario: 'error', tree: { starts_with: [{ field: 'name' }, 1] }, ctx: { name: 'safe' } },
        ],
    },
    {
        group: 'string', node: 'ends_with',
        cases: [
            { scenario: 'normal', tree: { ends_with: [{ field: 'name' }, '.log'] }, ctx: { name: 'sys.log' } },
            { scenario: 'boundary', tree: { ends_with: [{ field: 'name' }, '.log'] }, ctx: { name: 'sys.txt' } },
            { scenario: 'null', tree: { ends_with: [{ field: 'missing' }, '.x'] }, ctx: {} },
            { scenario: 'error', tree: { ends_with: [{ field: 'name' }, 1] }, ctx: { name: 'x' } },
        ],
    },
    // ═══ existence/dimension (3 nodes) ═══
    {
        group: 'existence', node: 'exists',
        cases: [
            { scenario: 'normal', tree: { exists: { field: 'x' } }, ctx: { x: 1 } },
            { scenario: 'boundary', tree: { exists: { field: 'x' } }, ctx: {} },
            { scenario: 'null', tree: { exists: { field: 'x' } }, ctx: { x: null } },
            { scenario: 'error', tree: { exists: { div: [1, 0] } }, ctx: {} },
        ],
    },
    {
        group: 'existence', node: 'length',
        cases: [
            { scenario: 'normal', tree: { length: { field: 's' } }, ctx: { s: 'abc' } },
            { scenario: 'boundary', tree: { length: { field: 'arr' } }, ctx: { arr: [1, 2, 3, 4] } },
            { scenario: 'null', tree: { length: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { length: { field: 'n' } }, ctx: { n: 42 } },
        ],
    },
    {
        group: 'existence', node: 'between',
        cases: [
            { scenario: 'normal', tree: { between: [{ field: 'age' }, 16, 60] }, ctx: { age: 30 } },
            { scenario: 'boundary', tree: { between: [{ field: 'age' }, 16, 60] }, ctx: { age: 60 } },
            { scenario: 'null', tree: { between: [{ field: 'missing' }, 1, 10] }, ctx: {} },
            { scenario: 'error', tree: { between: [{ field: 'age' }, 16, 60] }, ctx: { age: '30' } },
        ],
    },
    // ═══ quantifier (3 nodes) ═══
    {
        group: 'quantifier', node: 'all',
        cases: [
            { scenario: 'normal', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [1, 2, 3] } },
            { scenario: 'boundary', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
            { scenario: 'null', tree: { all: { binding: 'x', over: { field: 'missing' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: {} },
            { scenario: 'error', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: 'not-array' } },
        ],
    },
    {
        group: 'quantifier', node: 'any',
        cases: [
            { scenario: 'normal', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 2] } } }, ctx: { items: [1, 2, 3] } },
            { scenario: 'boundary', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 2] } } }, ctx: { items: [1, 2] } },
            { scenario: 'null', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
            { scenario: 'error', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: 5 } },
        ],
    },
    {
        group: 'quantifier', node: 'none',
        cases: [
            { scenario: 'normal', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 10] } } }, ctx: { items: [1, 2, 3] } },
            { scenario: 'boundary', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: true } }, ctx: { items: [] } },
            { scenario: 'null', tree: { none: { binding: 'x', over: { field: 'missing' }, predicate: true } }, ctx: {} },
            { scenario: 'error', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: true } }, ctx: { items: 'x' } },
        ],
    },
    // ═══ arithmetic (5 nodes) ═══
    {
        group: 'arithmetic', node: 'add',
        cases: [
            { scenario: 'normal', tree: { add: [1, 2] }, ctx: {} },
            { scenario: 'boundary', tree: { add: [0.1, 0.2] }, ctx: {} },
            { scenario: 'null', tree: { add: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { add: [1, 'x'] }, ctx: {} },
        ],
    },
    {
        group: 'arithmetic', node: 'sub',
        cases: [
            { scenario: 'normal', tree: { sub: [5, 3] }, ctx: {} },
            { scenario: 'boundary', tree: { sub: [0.3, 0.1] }, ctx: {} },
            { scenario: 'null', tree: { sub: [{ field: 'missing' }, 1] }, ctx: {} },
            { scenario: 'error', tree: { sub: [5] }, ctx: {} },
        ],
    },
    {
        group: 'arithmetic', node: 'mul',
        cases: [
            { scenario: 'normal', tree: { mul: [3, 4] }, ctx: {} },
            { scenario: 'boundary', tree: { mul: [0.1, 0.2] }, ctx: {} },
            { scenario: 'null', tree: { mul: [{ field: 'missing' }, 2] }, ctx: {} },
            { scenario: 'error', tree: { mul: [2, 'x'] }, ctx: {} },
        ],
    },
    {
        group: 'arithmetic', node: 'div',
        cases: [
            { scenario: 'normal', tree: { div: [4, 3] }, ctx: {} },
            { scenario: 'boundary', tree: { div: [10, 0] }, ctx: {} },
            { scenario: 'null', tree: { div: [{ field: 'missing' }, 2] }, ctx: {} },
            { scenario: 'error', tree: { div: [10, 2, 5] }, ctx: {} },
        ],
    },
    {
        group: 'arithmetic', node: 'round',
        cases: [
            { scenario: 'normal', tree: { round: [3.5] }, ctx: {} },
            { scenario: 'boundary', tree: { round: [4.5] }, ctx: {} },
            { scenario: 'null', tree: { round: [{ field: 'missing' }] }, ctx: {} },
            { scenario: 'error', tree: { round: ['x'] }, ctx: {} },
        ],
    },
    // ═══ time (5 nodes) ═══
    {
        group: 'time', node: 'days_between',
        cases: [
            { scenario: 'normal', tree: { days_between: ['2026-01-01', '2026-01-11'] }, ctx: {} },
            { scenario: 'boundary', tree: { days_between: ['2026-01-01', '2026-01-01'] }, ctx: {} },
            { scenario: 'null', tree: { days_between: [{ field: 'missing' }, '2026-01-11'] }, ctx: {} },
            { scenario: 'error', tree: { days_between: ['not-a-date', '2026-01-11'] }, ctx: {} },
        ],
    },
    {
        group: 'time', node: 'epoch_ms',
        cases: [
            { scenario: 'normal', tree: { epoch_ms: '2026-01-01' }, ctx: {} },
            { scenario: 'boundary', tree: { epoch_ms: '1970-01-01' }, ctx: {} },
            { scenario: 'null', tree: { epoch_ms: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { epoch_ms: 'not-a-date' }, ctx: {} },
        ],
    },
    {
        group: 'time', node: 'date_add',
        cases: [
            { scenario: 'normal', tree: { date_add: { unit: 'years', base: '2024-01-15', amount: 2 } }, ctx: {} },
            { scenario: 'boundary', tree: { date_add: { unit: 'months', base: '2024-01-31', amount: 1 } }, ctx: {} },
            { scenario: 'null', tree: { date_add: { unit: 'days', base: { field: 'missing' }, amount: 1 } }, ctx: {} },
            { scenario: 'error', tree: { date_add: { unit: 'days', base: 'not-a-date', amount: 1 } }, ctx: {} },
        ],
    },
    {
        group: 'time', node: 'date_part',
        cases: [
            { scenario: 'normal', tree: { date_part: { unit: 'year', arg: '2026-08-15' } }, ctx: {} },
            { scenario: 'boundary', tree: { date_part: { unit: 'day_of_week', arg: '2026-08-15' } }, ctx: {} },
            { scenario: 'null', tree: { date_part: { unit: 'month', arg: { field: 'missing' } } }, ctx: {} },
            { scenario: 'error', tree: { date_part: { unit: 'year', arg: 'not-a-date' } }, ctx: {} },
        ],
    },
    {
        group: 'time', node: 'month_last_day',
        cases: [
            { scenario: 'normal', tree: { month_last_day: '2024-02-10' }, ctx: {} },
            { scenario: 'boundary', tree: { month_last_day: '2026-01-10' }, ctx: {} },
            { scenario: 'null', tree: { month_last_day: { field: 'missing' } }, ctx: {} },
            { scenario: 'error', tree: { month_last_day: 'not-a-date' }, ctx: {} },
        ],
    },
    // ═══ aggregate (1 node, fn-parameterized) ═══
    {
        group: 'aggregate', node: 'aggregate',
        cases: [
            { scenario: 'normal', tree: { count: { field: 'nums' } }, ctx: { nums: [1, 2, 3] } },
            { scenario: 'boundary', tree: { sum: { field: 'nums' } }, ctx: { nums: [0.1, 0.2, 0.3] } },
            { scenario: 'null', tree: { avg: { field: 'nums' } }, ctx: { nums: [] } },
            { scenario: 'error', tree: { min: { field: 'nums' } }, ctx: { nums: [1, 'x', 3] } },
        ],
    },
];
/** Generate V-ENGINE node-semantics vectors (34 nodes × 4 scenarios = 136, per-node numbering §47) */
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
    // E1 pure function (3)
    { constraint: 'E1', scenario: 'same input → same output', tree: { add: [1, 2] }, ctx: {} },
    { constraint: 'E1', scenario: 'complex-expression determinism', tree: { eq: [{ add: [0.1, 0.2] }, 0.3] }, ctx: {} },
    { constraint: 'E1', scenario: 'no side effects (evaluation does not mutate context)', tree: { field: 'x' }, ctx: { x: 1 } },
    // E2 fixed-point decimal (8)
    { constraint: 'E2', scenario: '0.1+0.2=0.3 exact', tree: { add: [0.1, 0.2] }, ctx: {} },
    { constraint: 'E2', scenario: '1/3 scale=14', tree: { div: [1, 3] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 0.5→0', tree: { round: [0.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 1.5→2', tree: { round: [1.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 2.5→2', tree: { round: [2.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'half-even 3.5→4', tree: { round: [3.5] }, ctx: {} },
    { constraint: 'E2', scenario: 'large number 1e21 exact', tree: { add: [1e21, 1] }, ctx: {} },
    { constraint: 'E2', scenario: 'no intermediate rounding (0.1×3)', tree: { mul: [0.1, 3] }, ctx: {} },
    // E3/E12 evaluation-error folding (6)
    { constraint: 'E3', scenario: 'division by zero', tree: { div: [10, 0] }, ctx: {} },
    { constraint: 'E3', scenario: 'gt type mismatch', tree: { gt: [{ field: 'amount' }, 50] }, ctx: { amount: '100' } },
    { constraint: 'E3', scenario: 'invalid date', tree: { days_between: ['not-a-date', '2026-01-11'] }, ctx: {} },
    { constraint: 'E3', scenario: 'sub single operand', tree: { sub: [5] }, ctx: {} },
    { constraint: 'E3', scenario: 'div three operands', tree: { div: [10, 2, 5] }, ctx: {} },
    { constraint: 'E3', scenario: 'in right side not an array', tree: { in: [{ field: 'cat' }, 'x'] }, ctx: { cat: 'a' } },
    // E4 resource limits (6, all deterministically checkable; latency ≤50ms is a performance target, not a deterministic constraint — no vector)
    { constraint: 'E4', scenario: 'node over-limit (65 nodes)', expectThrow: true, tree: { and: Array.from({ length: 65 }, () => true) }, ctx: {} },
    { constraint: 'E4', scenario: 'tree depth over-limit (>6 levels)', expectThrow: true, tree: { not: { not: { not: { not: { not: { not: { not: true } } } } } } }, ctx: {} },
    { constraint: 'E4', scenario: 'arithmetic depth over-limit (>2)', expectThrow: true, tree: { add: [1, { add: [1, { add: [1, 2] }] }] }, ctx: {} },
    { constraint: 'E4', scenario: 'array over-limit (>10000)', expectThrow: true, tree: { in: [{ field: 'x' }, Array.from({ length: 10001 }, (_, i) => i)] }, ctx: { x: 1 } },
    { constraint: 'E4', scenario: 'quantifier nesting', expectThrow: true, tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { all: { binding: 'y', over: { field: 'items' }, predicate: true } } } }, ctx: { items: [1] } },
    { constraint: 'E4', scenario: 'regex nested quantifier ReDoS', tree: { match: [{ field: 'cmd' }, '(a+)+$'] }, ctx: { cmd: 'aaaa' } },
    // E5 when/expr mutual exclusion (3, load-time validation §10.2)
    { constraint: 'E5', scenario: 'expr vs field/operator/value exclusive (violation)', expectE5Exclusive: true, tree: { expr: { eq: [{ field: 'x' }, 1] }, field: 'x', operator: 'eq', value: 1 }, ctx: {} },
    { constraint: 'E5', scenario: 'expr-only valid', expectE5Exclusive: false, tree: { expr: { eq: [{ field: 'x' }, 1] } }, ctx: {} },
    { constraint: 'E5', scenario: 'field/operator/value-only valid', expectE5Exclusive: false, tree: { field: 'x', operator: 'eq', value: 1 }, ctx: {} },
    // E8 quantifier safe-folding (3)
    { constraint: 'E8', scenario: 'all(empty)=false', tree: { all: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
    { constraint: 'E8', scenario: 'any(empty)=false', tree: { any: { binding: 'x', over: { field: 'items' }, predicate: { gt: [{ var: 'x' }, 0] } } }, ctx: { items: [] } },
    { constraint: 'E8', scenario: 'none(empty)=false', tree: { none: { binding: 'x', over: { field: 'items' }, predicate: true } }, ctx: { items: [] } },
    // E9 time-node UTC semantics (4, added 2026-09-05 to lock §7.3(f) no-tz = UTC): no-timezone datetime parses as UTC, explicit Z/offset honored
    { constraint: 'E9', scenario: 'epoch_ms no-timezone datetime = UTC', tree: { epoch_ms: '2026-01-01T12:30:45' }, ctx: {} },
    { constraint: 'E9', scenario: 'epoch_ms Z suffix', tree: { epoch_ms: '2026-01-01T12:30:45Z' }, ctx: {} },
    { constraint: 'E9', scenario: 'epoch_ms +08:00 offset honored', tree: { epoch_ms: '2026-01-01T12:30:45+08:00' }, ctx: {} },
    { constraint: 'E9', scenario: 'days_between no-timezone datetime UTC floor', tree: { days_between: ['2026-01-01T23:59:59', '2026-01-02T00:00:01'] }, ctx: {} },
    // E10 NFC normalization (2, decomposed vs precomposed, verifies evaluation-layer NFC)
    { constraint: 'E10', scenario: 'NFC decomposed field value == precomposed literal', tree: { eq: [{ field: 's' }, 'café'] }, ctx: { s: 'cafe\u0301' } },
    { constraint: 'E10', scenario: 'NFC decomposed field value contains precomposed', tree: { contains: [{ field: 's' }, 'café'] }, ctx: { s: 'cafe\u0301 au lait' } },
    // E11 undefined sentinel (4)
    { constraint: 'E11', scenario: 'missing field → undefined', tree: { field: 'missing' }, ctx: {} },
    { constraint: 'E11', scenario: 'eq missing → false', tree: { eq: [{ field: 'missing' }, 1] }, ctx: {} },
    { constraint: 'E11', scenario: 'exists missing → false', tree: { exists: { field: 'missing' } }, ctx: {} },
    { constraint: 'E11', scenario: 'arith missing → type_mismatch', tree: { add: [{ field: 'missing' }, 1] }, ctx: {} },
];
/** Generate evaluation-constraint vectors (per-constraint numbering §47; E4 supports expectThrow, E5 uses checkExprExclusive) */
export function generateConstraintVectors() {
    const ev = new ExprTreeEvaluator();
    const out = [];
    const idxMap = {};
    for (const c of CONSTRAINTS_DEFS) {
        const idx = (idxMap[c.constraint] = (idxMap[c.constraint] ?? 0) + 1);
        let expected;
        if (c.expectE5Exclusive !== undefined) {
            // E5: expr vs field/operator/value mutual exclusion (load-time validation, not evaluation)
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
//  V-GLOSS / V-GLOSS-INTEGRITY / V-PROJ 22
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
/** V-GLOSS 12: tree → expected gloss string (G1 deterministic rendering, consecutive numbering §46) */
export function generateGlossVectors() {
    const out = [];
    GLOSS_DEFS.forEach((def, i) => {
        const node = fromSExpr(def.tree);
        const glossZh = renderNode(node, 'zh');
        const glossEn = renderNode(node, 'en');
        out.push({
            id: `V-GLOSS-${String(i + 1).padStart(3, '0')}`,
            category: 'V-GLOSS',
            node: def.node,
            expr_tree: def.tree,
            expected: { gloss_zh: glossZh, gloss_en: glossEn },
        });
    });
    return out;
}
/** V-GLOSS-INTEGRITY 4: tree tamper → gloss change (render-validation binding, G2) */
export function generateGlossIntegrityVectors() {
    const cases = [
        { id: 'V-GLOSS-INTEGRITY-001', node: 'eq', scenario: 'tree literal tamper → gloss change', tree: { eq: [{ field: 'age' }, 35] }, tampered: { eq: [{ field: 'age' }, 36] } },
        { id: 'V-GLOSS-INTEGRITY-002', node: 'eq', scenario: 'tree operator tamper eq→ne → gloss change', tree: { eq: [{ field: 'age' }, 35] }, tampered: { ne: [{ field: 'age' }, 35] } },
        { id: 'V-GLOSS-INTEGRITY-003', node: 'and', scenario: 'logic child-node removal → gloss change', tree: { and: [{ eq: [{ field: 'a' }, 1] }, { eq: [{ field: 'b' }, 2] }] }, tampered: { and: [{ eq: [{ field: 'a' }, 1] }] } },
        { id: 'V-GLOSS-INTEGRITY-004', node: 'in', scenario: 'set literal tamper → gloss change', tree: { in: [{ field: 'cat' }, ['a', 'b']] }, tampered: { in: [{ field: 'cat' }, ['a', 'c']] } },
    ];
    return cases.map((c) => {
        const g1 = renderNode(fromSExpr(c.tree), 'zh');
        const g2 = renderNode(fromSExpr(c.tampered), 'zh');
        const g1en = renderNode(fromSExpr(c.tree), 'en');
        const g2en = renderNode(fromSExpr(c.tampered), 'en');
        return {
            id: c.id, category: 'V-GLOSS', node: c.node, scenario: c.scenario,
            expr_tree: c.tree, tampered_tree: c.tampered,
            // store raw material only; divergence recomputed by the verifier (no boolean conclusion stored in the expected value)
            expected: { gloss_zh: g1, gloss_en: g1en, tampered_gloss_zh: g2, tampered_gloss_en: g2en },
        };
    });
}
/** V-PROJ 6: three writing projections (Simple/Expression/decision-table) compile to the same core (E7) */
export function generateProjVectors() {
    const ev = new ExprTreeEvaluator();
    // 3 Simple↔Expression (compile consistency)
    const sexprPairs = [
        { name: 'eq', simple: { operator: 'eq', field: 'age', value: 35, ctx: { age: 35 } }, sexpr: { eq: [{ field: 'age' }, 35] } },
        { name: 'in', simple: { operator: 'in', field: 'cat', value: ['a', 'b'], ctx: { cat: 'a' } }, sexpr: { in: [{ field: 'cat' }, ['a', 'b']] } },
        { name: 'contains', simple: { operator: 'contains', field: 'cmd', value: 'rm', ctx: { cmd: 'rm -rf' } }, sexpr: { contains: [{ field: 'cmd' }, 'rm'] } },
    ];
    // 3 Simple↔decision-table (decision-table row compile == Simple compile, eq semantics)
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
/** Summary: V-ENGINE 201 + V-GLOSS/V-PROJ 22 = 223 */
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
    // direct nodes 13
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
    // not combinations 6
    { operator: 'not_in', field: 'cat', value: ['a', 'b'], ctx: { cat: 'c' } },
    { operator: 'not_contains', field: 'cmd', value: 'rm', ctx: { cmd: 'ls' } },
    { operator: 'not_starts_with', field: 'name', value: 'safe_', ctx: { name: 'unsafe' } },
    { operator: 'not_ends_with', field: 'name', value: '.log', ctx: { name: 'sys.txt' } },
    { operator: 'not_exists', field: 'x', ctx: {} },
    { operator: 'not_between', field: 'age', value: [16, 60], ctx: { age: 70 } },
    // length/count 9
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
/** Generate Simple compile vectors (28 condition operators + 2 modifiers = 30) */
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
    // within/rate 2 modifiers (stateful operators, self-contained state-op sequence state_ops, replayable by third parties)
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
            scenario: 'rate over-limit detection (checkRate over-limit after record×3)',
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
            scenario: 'within window detection (history in window after record×1)',
            state_ops: stateOps,
            expected: { value: withinResult, value_type: 'boolean' },
        });
    }
    return out;
}
/** Replay the state-op sequence (inlined in the generator; the verifier independently implements the same replay) */
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
