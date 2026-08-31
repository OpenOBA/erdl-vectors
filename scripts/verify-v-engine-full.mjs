#!/usr/bin/env node
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
 * verify-v-engine-full.mjs — V-ENGINE full 223-vector verifier
 *
 * Depends on @openoba/erdl (ERDL reference engine) to evaluate v-engine-vectors.json per vector and compare with expected.
 * This is the "reference verifier" (verifying engine-produced vectors with the engine), complementing scripts/verify-v-engine.mjs's
 * "independent second source" (57 semantic-sensitive, no engine import):
 *   - this file: full 223 coverage (34 nodes × 4 scenarios + E1-E12 constraints + Simple + gloss + projection)
 *   - verify-v-engine.mjs: 57 semantic-sensitive vectors independently recomputed (neutrality proof §48.2)
 */
import {
  ExprTreeEvaluator, objectContext, fromSExpr, toSExpr, compileSimpleCondition,
  renderNode, GuardStateManager, VirtualClock, toDecimalString,
} from '@openoba/erdl';
import { canonicalize } from 'json-canonicalize';
import { readFileSync } from 'fs';

const AS_OF = new Date('2026-08-15T00:00:00Z');
const ev = new ExprTreeEvaluator();

/** Strictly isomorphic with the generator v-engine.ts serializeValue: value → {value, type} */
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

/** E5 (§10.2): expr (Expression projection) and field/operator/value (Simple projection) are mutually exclusive */
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
      const g1en = renderNode(fromSExpr(v.expr_tree), 'en');
      const g2en = renderNode(fromSExpr(v.tampered_tree), 'en');
      return g1 === v.expected.gloss_zh && g2 === v.expected.tampered_gloss_zh && g1 !== g2
        && g1en === v.expected.gloss_en && g2en === v.expected.tampered_gloss_en && g1en !== g2en;
    }
    return renderNode(fromSExpr(v.expr_tree), 'zh') === v.expected.gloss_zh
      && renderNode(fromSExpr(v.expr_tree), 'en') === v.expected.gloss_en;
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
  // node-semantics vectors
  const r = ev.evaluate(fromSExpr(v.expr_tree), objectContext(v.context, AS_OF));
  const sv = serializeValue(r.value);
  return sv.value === v.expected.value && sv.type === v.expected.value_type &&
    warnKinds(r) === JSON.stringify(v.expected.warnings) && r.errored === v.expected.errored;
}

// ── main flow ──
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

console.log('V-ENGINE full verification (@openoba/erdl reference engine)');
for (const [k, s] of Object.entries(breakdown)) {
  const mark = s.pass === s.total ? '✓' : '✗';
  console.log(`  ${mark} ${k.padEnd(24)} ${s.pass}/${s.total}`);
}
console.log(`  total: ${pass}/${pass + fail} passed`);
if (fail) {
  console.log('  failures:', failed.join(', '));
  process.exit(1);
}
console.log('  ✅ V-ENGINE 223 vectors full verification passed');
process.exit(0);
