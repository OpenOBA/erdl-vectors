#!/usr/bin/env node
// Independent, deliberately narrow reading of ERDL §7.0.2, §7.1 and §7.1a at
// erdl-landing@ed70333 (v2.3). No erdl-formal or @openoba/erdl imports.
import { readFileSync } from 'node:fs';

const source = process.argv[2] || new URL('../resolution-vectors.json', import.meta.url);
const document = JSON.parse(readFileSync(source, 'utf8'));
if (document.spec !== 'erdl-language-spec-v2.3.md' || document.spec_commit !== 'cc53097aa885f2e9cd3bcfe2e1b02753fff30c5e') {
  throw new Error('Unexpected normative specification provenance');
}

const strength = { low: 0, normal: 1, high: 2, critical: 3 };
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const matches = (rule, fact) => {
  if (rule.when === 'true') return true;
  // The fixture contract uses only AND of Simple eq conditions. Refuse any
  // expression outside that boundary rather than silently changing semantics.
  if (rule.when?.logic !== 'AND' || !Array.isArray(rule.when.conditions)) {
    throw new Error(`Unsupported when expression in ${rule.name}`);
  }
  return rule.when.conditions.every(condition => {
    if (condition.operator !== 'eq') throw new Error(`Unsupported operator in ${rule.name}`);
    const actual = get(fact, condition.field);
    return actual !== undefined && actual !== null && typeof actual === typeof condition.value && actual === condition.value;
  });
};
const ordered = rules => rules.map((rule, index) => ({ ...rule, index })).sort((a, b) =>
  a.ring - b.ring || a.priority - b.priority ||
  strength[b.override ?? 'normal'] - strength[a.override ?? 'normal'] || a.index - b.index);

export function resolve({ fact, rules }) {
  // §7.0.2: explicit pass first; catch-all inert once any explicit rule matched (§7.1 item 6).
  const explicit = ordered(rules.filter(rule => rule.when !== 'true'));
  const catchAll = ordered(rules.filter(rule => rule.when === 'true'));
  let totalEvaluated = 0;
  const matched = [];
  const hits = [];
  let anyExplicitMatched = false;
  for (const rule of [...explicit, ...catchAll]) {
    if (rule.when === 'true' && anyExplicitMatched) continue; // §7.1 item 6: catch-all inert
    totalEvaluated++;
    if (!matches(rule, fact)) continue;
    matched.push(rule.name);
    hits.push({ decision: rule.then, override: rule.override ?? 'normal', ring: rule.ring ?? 3, name: rule.name });
    if (rule.when !== 'true') anyExplicitMatched = true;
    if (rule.then === 'EMERGENCY_HALT') break; // 唯一终端短路
  }
  // §7.1a 集合式 fold（置换不变）：R=拦截类，O=override ALLOW，覆盖需 level(o)>level(r) 且 ring(o)≤ring(r)（外环不得覆盖内环）。
  const RESTRICTIVE = new Set(['DENY', 'ROLLBACK', 'QUARANTINE']);
  const restrictive = hits.filter(h => RESTRICTIVE.has(h.decision));
  const overrideAllows = hits.filter(h => h.decision === 'ALLOW' && (h.override === 'critical' || h.override === 'high'));
  const uncovered = restrictive.filter(r =>
    !overrideAllows.some(o => strength[o.override] > strength[r.override] && o.ring <= r.ring)
  );
  let decision = null;
  if (uncovered.length > 0) {
    decision = uncovered.reduce((best, h) => (h.ring < best.ring ? h : best)).decision;
  } else {
    const nonRestrictive = hits.filter(h => !RESTRICTIVE.has(h.decision) && h.decision !== 'NOTIFY');
    if (nonRestrictive.length > 0) {
      const decStrength = { EMERGENCY_HALT: 0, DENY: 1, ROLLBACK: 1, QUARANTINE: 1, REQUEST_HUMAN: 2, WORKFLOW: 2, ESCALATE: 3, DELEGATE: 4, DEFER: 5, CORRECT: 6, GUIDE: 7, ALLOW: 8 };
      decision = nonRestrictive.reduce((best, h) => ((decStrength[h.decision] ?? 8) < (decStrength[best.decision] ?? 8) ? h : best)).decision;
    }
  }
  return { decision, matched_rules: matched, total_matched: matched.length, total_evaluated: totalEvaluated };
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const results = document.vectors.map(vector => ({
    id: vector.id,
    validity: vector.validity ?? 'valid',
    ...resolve(vector.input),
  }));
  process.stdout.write(JSON.stringify({ spec: document.spec, spec_commit: document.spec_commit, results }, null, 2) + '\n');
}
