#!/usr/bin/env node
// Independent, deliberately narrow reading of ERDL §7.0.2 and §7.1 at
// erdl-landing@7ba1e64. No erdl-formal or @openoba/erdl imports.
import { readFileSync } from 'node:fs';

const source = process.argv[2] || new URL('../resolution-vectors.json', import.meta.url);
const document = JSON.parse(readFileSync(source, 'utf8'));
if (document.spec !== 'erdl-language-spec-v2.1.md' || document.spec_commit !== '7ba1e64') {
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
  // §7.0.2: explicit pass first; enter the catch-all pass only on no match.
  const explicit = ordered(rules.filter(rule => rule.when !== 'true'));
  const catchAll = ordered(rules.filter(rule => rule.when === 'true'));
  let totalEvaluated = 0;
  const matched = [];
  let decision = null;
  for (const pass of [explicit, catchAll]) {
    if (pass === catchAll && matched.length) break;
    for (const rule of pass) {
      totalEvaluated++;
      if (!matches(rule, fact)) continue;
      matched.push(rule.name);
      if (decision === null) decision = rule.then;
      else if (decision === 'DENY' && rule.then === 'ALLOW' &&
               (rule.override === 'high' || rule.override === 'critical')) {
        // §7.1 item 5: this direction alone can cross rings.
        decision = 'ALLOW';
      }
      // A subsequent DENY does not use override to rewrite an ALLOW.
      if (rule.then === 'EMERGENCY_HALT' || rule.then === 'WORKFLOW') break;
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
