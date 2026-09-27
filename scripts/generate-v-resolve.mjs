#!/usr/bin/env node
/*
 * Copyright 2026 Shenzhen Miaojing Technology Co., Ltd.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * generate-v-resolve.mjs — V-RESOLVE answer oracle generator (depends on @openoba/erdl reference engine).
 *
 * Runs each of the 13 neutral V-RESOLVE vectors (resolution-vectors.json) through the reference
 * Evaluator (§7.0.2/§7.1 resolution fold) and writes the semantic oracle to v-resolve-answers.json
 * (gitignored, oracle isolation — mirroring the audit layer's answers-file separation).
 *
 * The committed resolution-vectors.json carries NO expected outcome; the oracle lives only here.
 * Writes via "temp file + rename atomic replace" to avoid concurrent readers seeing truncation.
 */
import { Evaluator } from '@openoba/erdl';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const evaluator = new Evaluator();

/** nested fact { tool: { name } } → flat context { 'tool.name' } */
function flattenFact(fact, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(fact)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flattenFact(v, key));
    else out[key] = v;
  }
  return out;
}

/** V-RESOLVE rule shape → RuleDefinition */
function toRule(r) {
  const isTrue = r.when === 'true';
  return {
    id: r.name,
    name: r.name,
    description: r.name,
    category: 'custom',
    enabled: true,
    conditions: isTrue ? [] : (r.when.conditions || []).map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
    conditionLogic: isTrue ? 'AND' : (r.when.logic || 'AND'),
    action: { decision: r.then, ring: r.ring },
    priority: r.priority,
    override: r.override,
  };
}

const doc = JSON.parse(readFileSync(new URL('../resolution-vectors.json', import.meta.url), 'utf8'));
const answers = {};
for (const v of doc.vectors) {
  const rules = v.input.rules.map(toRule);
  const ctx = flattenFact(v.input.fact);
  const result = evaluator.evaluate(rules, ctx);
  answers[v.id] = {
    decision: result.decision,
    matched_rules: result.matchedRules.map((r) => r.ruleId),
    total_matched: result.totalMatched,
    total_evaluated: result.totalEvaluated,
  };
}

const target = fileURLToPath(new URL('../v-resolve-answers.json', import.meta.url));
const tmp = `${target}.${process.pid}.tmp`;
writeFileSync(tmp, JSON.stringify(answers, null, 2) + '\n', 'utf8');
renameSync(tmp, target);
console.log(`V-RESOLVE answers written to ${target} (${Object.keys(answers).length} vectors)`);
