#!/usr/bin/env node
/**
 * verify-v-engine-full.mjs — V-ENGINE 全量 223 条向量验证器
 *
 * 依赖 @openoba/erdl（ERDL 参考引擎）逐条求值 v-engine-vectors.json 并与 expected 对比。
 * 这是「参考验证器」（用引擎验引擎产出的向量），与 scripts/verify-v-engine.mjs 的
 * 「独立第二来源」（57 条语义敏感、不 import 引擎）互为补充：
 *   - 本文件：全量 223 条覆盖（34 节点 × 4 场景 + E1-E12 约束 + Simple + gloss + projection）
 *   - verify-v-engine.mjs：57 条语义敏感向量独立重算（中立性证明 §48.2）
 */
import {
  ExprTreeEvaluator, objectContext, fromSExpr, toSExpr, compileSimpleCondition,
  renderNode, GuardStateManager, VirtualClock, toDecimalString,
} from '@openoba/erdl';
import { canonicalize } from 'json-canonicalize';
import { readFileSync } from 'fs';

const AS_OF = new Date('2026-08-15T00:00:00Z');
const ev = new ExprTreeEvaluator();

/** 与生成器 v-engine.ts 的 serializeValue 严格同构：值 → {value, type} */
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
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return { value: canonicalize(v), type: 'object' };
  }
  return { value: JSON.stringify(v), type: 'object' };
}

/** E5（§10.2）：expr（Expression 投影面）与 field/operator/value（Simple 投影面）互斥 */
function checkExprExclusive(cond) {
  const hasExpr = cond && cond.expr !== undefined && cond.expr !== null;
  const hasSimple = cond && (cond.field !== undefined || cond.operator !== undefined || cond.value !== undefined);
  return (hasExpr && hasSimple) ? { code: 'WHEN_EXPR_EXCLUSIVE' } : null;
}

const warnKinds = (r) => JSON.stringify((r.warnings || []).map((w) => w.kind));

function verify(v) {
  if (v.category === 'V-GLOSS') {
    if (v.tampered_tree) {
      const g1 = renderNode(fromSExpr(v.expr_tree), 'zh');
      const g2 = renderNode(fromSExpr(v.tampered_tree), 'zh');
      return g1 === v.expected.gloss_zh && g2 === v.expected.tampered_gloss_zh && g1 !== g2;
    }
    return renderNode(fromSExpr(v.expr_tree), 'zh') === v.expected.gloss_zh;
  }
  if (v.category === 'V-PROJ') {
    if (v.decision_table) {
      const simpleR = ev.evaluate(fromSExpr(v.simple_compiled_tree), objectContext(v.context, AS_OF));
      const dtableR = ev.evaluate(fromSExpr(v.decision_table_compiled_tree), objectContext(v.context, AS_OF));
      const ssv = serializeValue(simpleR.value);
      const dsv = serializeValue(dtableR.value);
      return ssv.value === dsv.value && ssv.type === dsv.type &&
        ssv.value === v.expected.simple_value && dsv.value === v.expected.decision_value;
    }
    const simpleR = ev.evaluate(fromSExpr(v.simple_compiled_tree), objectContext(v.context, AS_OF));
    const sexprR = ev.evaluate(fromSExpr(v.expression_tree), objectContext(v.context, AS_OF));
    const ssv = serializeValue(simpleR.value);
    const esv = serializeValue(sexprR.value);
    return ssv.value === esv.value && ssv.type === esv.type &&
      ssv.value === v.expected.simple_value && ssv.type === v.expected.simple_type &&
      esv.value === v.expected.expression_value && esv.type === v.expected.expression_type;
  }
  if (v.subcategory === 'constraint') {
    if (v.constraint === 'E5') {
      const violation = checkExprExclusive(v.expr_tree);
      return (violation !== null) === v.expected.value;
    }
    if (v.expected.threw) {
      try { ev.evaluate(fromSExpr(v.expr_tree), objectContext(v.context, AS_OF)); return false; }
      catch { return true; }
    }
    const r = ev.evaluate(fromSExpr(v.expr_tree), objectContext(v.context, AS_OF));
    const sv = serializeValue(r.value);
    return sv.value === v.expected.value && sv.type === v.expected.value_type &&
      warnKinds(r) === JSON.stringify(v.expected.warnings) && r.errored === v.expected.errored;
  }
  if (v.subcategory === 'simple-compile') {
    if (typeof v.field !== 'string') return false;
    const node = compileSimpleCondition({ field: v.field, operator: v.operator, value: v.value });
    if (JSON.stringify(toSExpr(node)) !== JSON.stringify(v.compiled_tree)) return false;
    const r = ev.evaluate(node, objectContext(v.context, AS_OF));
    const sv = serializeValue(r.value);
    return sv.value === v.expected.value && sv.type === v.expected.value_type &&
      warnKinds(r) === JSON.stringify(v.expected.warnings) && r.errored === v.expected.errored;
  }
  if (v.subcategory === 'simple-modifier') {
    const gsm = new GuardStateManager(new VirtualClock(0));
    let result = null;
    for (const o of (v.state_ops || [])) {
      if (o.op === 'recordRate' && typeof o.windowMs === 'number') gsm.recordRate(o.key, o.windowMs);
      else if (o.op === 'checkRate' && typeof o.windowMs === 'number' && typeof o.maxCount === 'number') result = gsm.checkRate(o.key, o.maxCount, o.windowMs);
      else if (o.op === 'recordWithin') gsm.recordWithin(o.key);
      else if (o.op === 'checkWithin' && typeof o.windowMs === 'number') result = gsm.checkWithin(o.key, o.windowMs);
    }
    return result === v.expected.value;
  }
  // 节点语义向量
  const r = ev.evaluate(fromSExpr(v.expr_tree), objectContext(v.context, AS_OF));
  const sv = serializeValue(r.value);
  return sv.value === v.expected.value && sv.type === v.expected.value_type &&
    warnKinds(r) === JSON.stringify(v.expected.warnings) && r.errored === v.expected.errored;
}

// ── 主流程 ──
const data = JSON.parse(readFileSync(new URL('../v-engine-vectors.json', import.meta.url), 'utf8'));

let pass = 0, fail = 0;
const failed = [];
const breakdown = {};
for (const v of data.vectors) {
  const key = v.category + (v.subcategory ? '/' + v.subcategory : '');
  breakdown[key] = breakdown[key] || { total: 0, pass: 0 };
  breakdown[key].total++;
  if (verify(v)) { pass++; breakdown[key].pass++; }
  else { fail++; failed.push(v.id); }
}

console.log('V-ENGINE 全量验证（@openoba/erdl 参考引擎）');
for (const [k, s] of Object.entries(breakdown)) {
  const mark = s.pass === s.total ? '✓' : '✗';
  console.log(`  ${mark} ${k.padEnd(24)} ${s.pass}/${s.total}`);
}
console.log(`  总计: ${pass}/${pass + fail} 通过`);
if (fail) {
  console.log('  失败:', failed.join(', '));
  process.exit(1);
}
console.log('  ✅ V-ENGINE 223 条向量全量验证通过');
process.exit(0);
