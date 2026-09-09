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
 * update-expression-registry.cjs — regenerate the IMPLEMENTATIONS.md expression-layer registry from submissions/*.json.
 *
 * Reads each expression-layer submission (ER3 envelope: `results` map of vector id → {value, value_type, errored}),
 * cross-verifies it against the answer oracle (v-engine-answers.json, gitignored) per ER4 (value + value_type + errored),
 * and records the passing runners. A failing submission is SKIPPED (never recorded).
 *
 * Usage: node scripts/update-expression-registry.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ANSWERS = path.join(__dirname, '..', 'v-engine-answers.json');
const SUBMISSIONS_DIR = path.join(__dirname, '..', 'submissions');
const IMPL_FILES = [
  path.join(__dirname, '..', 'IMPLEMENTATIONS.md'),
  path.join(__dirname, '..', 'IMPLEMENTATIONS.en.md'),
];

const BEGIN = '<!-- expression-registry:auto-begin -->';
const END = '<!-- expression-registry:auto-end -->';

function main() {
  const answers = JSON.parse(fs.readFileSync(ANSWERS, 'utf8'));
  const answerIds = Object.keys(answers);
  const rows = [];
  const skipped = [];

  for (const f of fs.readdirSync(SUBMISSIONS_DIR).sort()) {
    if (!f.endsWith('.json')) continue;
    const sub = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, f), 'utf8'));
    // Only expression-layer ER3 envelopes belong in this registry.
    if (sub.layer && sub.layer !== 'expression') continue;
    if (!sub.results || typeof sub.results !== 'object') {
      skipped.push(f + ' (no ER3 results map)');
      continue;
    }
    const results = sub.results;
    let pass = 0;
    let fail = 0;
    for (const id of answerIds) {
      const expected = answers[id];
      const actual = results[id];
      if (actual === undefined) {
        fail++;
        continue;
      }
      const valueMatch = JSON.stringify(actual.value) === JSON.stringify(expected.value);
      const typeMatch = actual.value_type === expected.value_type;
      const erroredMatch = !!actual.errored === !!expected.errored;
      if (valueMatch && typeMatch && erroredMatch) pass++;
      else fail++;
    }
    if (fail !== 0) {
      skipped.push(f + ' (' + pass + '/' + answerIds.length + ', ' + fail + ' mismatch)');
      continue;
    }
    const runner = sub.runner || f.replace(/\.json$/, '');
    const method = sub.method || '—';
    const lang = method.split(/[\s,;]/)[0] || method;
    const artifact = sub.artifact || f;
    const artifactLabel = (() => {
      const m = String(artifact).match(/github\.com\/([^/]+)\/([^/]+)/);
      return m ? m[2] : artifact;
    })();
    rows.push(
      `| **${runner}** | ${lang}, spec-and-contract-only | ${pass}/${answerIds.length} | ${sub.date || '—'} | [${artifactLabel}](${artifact}) |`,
    );
  }

  for (const file of IMPL_FILES) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const start = content.indexOf(BEGIN);
    const end = content.indexOf(END);
    if (start === -1 || end === -1) {
      console.error('ERROR: ' + path.basename(file) + ' is missing expression-registry markers (' + BEGIN + ' / ' + END + ')');
      process.exit(1);
    }
    const header = '| Implementor | Method | Result | Date | Artifact |';
    const separator = '|------------|--------|:-------:|------|---------|';
    const referenceRow = '| **OpenOBA (reference)** | Node.js, @openoba/erdl | 240/240 | 2026-09-09 | [v-engine.mjs](scripts/v-engine.mjs) |';
    const body = '\n' + [header, separator, referenceRow].concat(rows).join('\n');
    const newContent = content.slice(0, start + BEGIN.length) + body + content.slice(end);
    fs.writeFileSync(file, newContent, 'utf8');
  }
  console.log(
    'Expression-layer registry regenerated: ' + rows.length + ' verified runner(s)'
    + (skipped.length ? ' · skipped ' + skipped.length + ' (unverified)' : ''),
  );
  for (const s of skipped) console.log('  skipped: ' + s);
}

if (require.main === module) main();

module.exports = {};
