#!/usr/bin/env node
/*
 * Copyright 2026 Shenzhen Miaojing Technology Co., Ltd.
 * Licensed under the Apache License, Version 2.0.
 */

/**
 * verify-v-resolve-submission.mjs — cross-verify a third-party V-RESOLVE runner submission.
 *
 * A conforming §7.1 resolution runner re-derives the resolution fold (ring order 0→3, override
 * DENY→ALLOW only, catch-all inertness) from the spec alone, evaluates all 13 V-RESOLVE vectors,
 * and submits `{ results: [ { id, decision, ... } ] }` (the shape emitted by the independent
 * runner's own `run-v-resolve.mjs`).
 *
 * This verifier compares each vector's `decision` against the answer oracle
 * (v-resolve-answers.json, gitignored). `matched_rules` / `total_evaluated` are not compared here.
 *
 * Usage:
 *   node scripts/verify-v-resolve-submission.mjs --submission submissions/<runner>-output.json
 */
import { readFileSync } from 'node:fs';

function main() {
  const args = process.argv.slice(2);
  const subIdx = args.indexOf('--submission');
  if (subIdx === -1 || !args[subIdx + 1]) {
    console.error('Usage: node scripts/verify-v-resolve-submission.mjs --submission <path>');
    process.exit(2);
  }
  const submissionPath = args[subIdx + 1];
  const submission = JSON.parse(readFileSync(submissionPath, 'utf8'));
  const answers = JSON.parse(readFileSync(new URL('../v-resolve-answers.json', import.meta.url), 'utf8'));

  const results = submission.results;
  const byId = new Map();
  if (Array.isArray(results)) for (const r of results) byId.set(r.id, r);
  else if (results && typeof results === 'object') for (const [id, r] of Object.entries(results)) byId.set(id, r);

  const answerIds = Object.keys(answers);
  const mismatches = [];
  let pass = 0;
  let fail = 0;
  for (const id of answerIds) {
    const expected = answers[id].decision;
    const actual = byId.get(id)?.decision;
    if (actual === undefined) {
      fail++;
      mismatches.push(`${id}: MISSING`);
      continue;
    }
    if (actual === expected) pass++;
    else {
      fail++;
      mismatches.push(`${id}: decision=${actual} ≠ ${expected}`);
    }
  }

  console.log(`V-RESOLVE submission cross-verification: ${pass}/${answerIds.length} passed`);
  if (fail > 0) {
    console.log(`mismatches (${fail}):`);
    for (const m of mismatches.slice(0, 30)) console.log(`  - ${m}`);
    process.exit(1);
  }
  console.log('✅ all vectors decision-equal');
  process.exit(0);
}

main();
