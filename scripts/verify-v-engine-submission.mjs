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
 * verify-v-engine-submission.mjs — cross-verify a third-party expression-layer runner submission (ER3 envelope).
 *
 * A conforming expression-layer runner (EXPRESSION-RUNNER-CONTRACT.md ER1–ER9) implements the 34-node kernel + Simple
 * 30 + decision-table + gloss from the spec + contract alone, evaluates all v-engine-vectors.json vectors, and submits
 * an ER3 envelope (submissions/<runner>-output.json) whose `results` map each vector id to
 * `{ value, value_type, errored, warnings }`.
 *
 * This verifier compares the submission against the answer oracle (v-engine-answers.json, gitignored) per ER4:
 *   value value-identical (per value_type) + value_type equal + errored equal.
 * Warnings are NOT compared (ER4 compares value + errored only).
 *
 * Usage:
 *   node scripts/verify-v-engine-submission.mjs --submission submissions/<runner>-output.json
 */

import { readFileSync } from 'node:fs';

function main() {
  const args = process.argv.slice(2);
  const subIdx = args.indexOf('--submission');
  if (subIdx === -1 || !args[subIdx + 1]) {
    console.error('Usage: node scripts/verify-v-engine-submission.mjs --submission <path>');
    process.exit(2);
  }
  const submissionPath = args[subIdx + 1];
  const submission = JSON.parse(readFileSync(submissionPath, 'utf8'));
  const answers = JSON.parse(readFileSync(new URL('../v-engine-answers.json', import.meta.url), 'utf8'));

  if (submission.layer && submission.layer !== 'expression') {
    console.error(`FAIL: submission layer is "${submission.layer}", expected "expression"`);
    process.exit(1);
  }

  const results = submission.results || {};
  const answerIds = Object.keys(answers);
  const mismatches = [];
  let pass = 0;
  let fail = 0;

  for (const id of answerIds) {
    const expected = answers[id];
    const actual = results[id];
    if (actual === undefined) {
      fail++;
      mismatches.push(`${id}: MISSING`);
      continue;
    }
    const valueMatch = JSON.stringify(actual.value) === JSON.stringify(expected.value);
    const typeMatch = actual.value_type === expected.value_type;
    const erroredMatch = !!actual.errored === !!expected.errored;
    if (valueMatch && typeMatch && erroredMatch) {
      pass++;
    } else {
      fail++;
      mismatches.push(
        `${id}: value=${JSON.stringify(actual.value)}≠${JSON.stringify(expected.value)} ` +
          `type=${actual.value_type}≠${expected.value_type} errored=${actual.errored}≠${expected.errored}`,
      );
    }
  }

  console.log(`expression-layer submission cross-verification: ${pass}/${answerIds.length} passed`);
  if (fail > 0) {
    console.log(`mismatches (${fail}):`);
    for (const m of mismatches.slice(0, 30)) console.log(`  - ${m}`);
    if (mismatches.length > 30) console.log(`  ... and ${mismatches.length - 30} more`);
    process.exit(1);
  }
  console.log('✅ all vectors value-identical (value + value_type + errored)');
  process.exit(0);
}

main();
