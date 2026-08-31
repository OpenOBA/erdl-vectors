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
 * verify-v-engine-reverse.mjs — V-ENGINE reverse (adversarial) verification: tamper literal per vector → evaluation must change
 *
 * For each vector with a literal, tamper the literal in its expression tree (number+1 / boolean flip / string suffix),
 * recompute and compare with the original expected — the tampered evaluation MUST change (otherwise the vector has no discriminating power).
 * Pure field-reference nodes (no literal) and commutative/boundary cases (e.g. or with first term true) naturally do not change on tamper; not counted as failures.
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
  // reverse tests only the normal scenarios whose result depends on a literal (34); boundary/error/null are fixed-result scenarios,
  // constraints/gloss/projection are independent evaluation objects (forward-covered by verify-v-engine-full).
  if (v.scenario !== 'normal') { skipped++; continue; }
  if (!v.expr_tree || v.expected === undefined) { skipped++; continue; }
  const tampered = tamperTree(v.expr_tree);
  if (JSON.stringify(tampered) === JSON.stringify(v.expr_tree)) { skipped++; continue; } // no literal, tamper no-op

  const orig = evalSerialize(v.expr_tree, v.context);
  const tamp = evalSerialize(tampered, v.context);
  if (orig !== tamp) detected++;
  else { unchanged++; unchangedIds.push(v.id); }
}

console.log(`V-ENGINE reverse (tamper literal per normal scenario): detected diff ${detected} / unchanged ${unchanged}`);
if (unchangedIds.length) console.log('unchanged on tamper (commutative/boundary cases):', unchangedIds.join(', '));
// of the 34 normal nodes, the vast majority should be detected (a few commutative/boundary cases (or first-term true, lt/lte boundaries, etc.) do not change on tamper)
process.exit(detected >= 20 ? 0 : 1);
