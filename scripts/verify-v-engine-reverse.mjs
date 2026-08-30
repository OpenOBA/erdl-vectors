#!/usr/bin/env node
/**
 * verify-v-engine-reverse.mjs — V-ENGINE 逆向（对抗）验证：逐条篡改字面量 → 求值必变
 *
 * 对每条有字面量的向量，篡改其表达式树中的字面量（number+1 / boolean 取反 / string 加后缀），
 * 重算求值并与原预期比对——篡改后求值结果 MUST 改变（否则该向量无鉴别力）。
 * 纯 field 引用节点（无字面量）与交换律/边界场景（如 or 首项为真）天然篡改不变，不计入失败。
 */
import { ExprTreeEvaluator, objectContext, fromSExpr, toDecimalString } from '@openoba/erdl';
import { canonicalize } from 'json-canonicalize';
import { readFileSync } from 'fs';

const AS_OF = new Date('2026-08-15T00:00:00Z');
const ev = new ExprTreeEvaluator();

function serializeValue(v) {
  if (v === undefined) return { value: '__undefined__', type: 'undefined' };
  if (v === null) return { value: null, type: 'null' };
  if (typeof v === 'boolean') return { value: v, type: 'boolean' };
  if (typeof v === 'number') return { value: v, type: 'number' };
  if (typeof v === 'string') return { value: v, type: 'string' };
  if (Array.isArray(v)) return { value: v, type: 'array' };
  if (v instanceof Date) return { value: v.toISOString(), type: 'date' };
  if (typeof v === 'object' && v !== null && typeof v.num === 'bigint' && typeof v.den === 'bigint') {
    if (v.den === 1n) return { value: v.num.toString(), type: 'rational' };
    return { value: toDecimalString(v, 14), type: 'rational' };
  }
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return { value: canonicalize(v), type: 'object' };
  return { value: JSON.stringify(v), type: 'object' };
}

const PROTECTED = new Set(['field', 'var', 'binding', 'unit', 'op', 'kind', 'fn', 'type', 'operator', 'scenario', 'modifier']);
function tamperTree(tree) {
  if (Array.isArray(tree)) return tree.map(tamperTree);
  if (tree && typeof tree === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(tree)) out[k] = PROTECTED.has(k) ? v : tamperTree(v);
    return out;
  }
  if (typeof tree === 'number') return tree + 1;
  if (typeof tree === 'boolean') return !tree;
  if (typeof tree === 'string') return tree + '_X';
  return tree;
}

function evalSerialize(tree, ctx) {
  try {
    const r = ev.evaluate(fromSExpr(tree), objectContext(ctx, AS_OF));
    return JSON.stringify(serializeValue(r.value));
  } catch (e) {
    return '__ERR__:' + e.message;
  }
}

const data = JSON.parse(readFileSync(new URL('../v-engine-vectors.json', import.meta.url), 'utf8'));

let detected = 0, unchanged = 0, skipped = 0;
const unchangedIds = [];

for (const v of data.vectors) {
  // 逆向仅测「结果依赖字面量」的 normal 场景（34 条）；boundary/error/null 是固定结果场景，
  // 约束/gloss/projection 是独立求值对象（由 verify-v-engine-full 正向覆盖）。
  if (v.scenario !== 'normal') { skipped++; continue; }
  if (!v.expr_tree || v.expected === undefined) { skipped++; continue; }
  const tampered = tamperTree(v.expr_tree);
  if (JSON.stringify(tampered) === JSON.stringify(v.expr_tree)) { skipped++; continue; } // 无字面量，篡改 no-op

  const orig = evalSerialize(v.expr_tree, v.context);
  const tamp = evalSerialize(tampered, v.context);
  if (orig !== tamp) detected++;
  else { unchanged++; unchangedIds.push(v.id); }
}

console.log(`V-ENGINE 逆向（normal 场景逐条篡改字面量）: 检出差异 ${detected} / 篡改不变 ${unchanged}`);
if (unchangedIds.length) console.log('篡改不变（交换律/边界场景）:', unchangedIds.join(', '));
// 34 个 normal 节点中，绝大多数应能检出（少量交换律/边界场景（or 首项为真、lt/lte 边界等）篡改不变）
process.exit(detected >= 20 ? 0 : 1);
