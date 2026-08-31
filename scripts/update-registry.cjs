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
 * update-registry.cjs — regenerate the IMPLEMENTATIONS.md Registry table from submissions/*.json.
 *
 * The registry is auto-derived from the machine-readable submissions (the byte-level evidence),
 * mirroring how conformance/CONFORMANCE.md is auto-generated from the verification run.
 * "Measurements, not endorsements": every row is a submission that PASSED cross-verification.
 *
 * A submission that fails cross-verification is SKIPPED (never recorded). The CI runs this on
 * push to main (post-merge) and auto-commits the result.
 *
 * Usage: node scripts/update-registry.cjs
 *
 * @author Tang Qixin
 * @since 2026-08-31
 * @license MIT
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildReferenceMap, crossVerify } = require('./verify-submission.cjs');

const VECTORS = path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');
const SUBMISSIONS_DIR = path.join(__dirname, '..', 'submissions');
const IMPL = path.join(__dirname, '..', 'IMPLEMENTATIONS.md');

const BEGIN = '<!-- registry:auto-begin -->';
const END = '<!-- registry:auto-end -->';

function main() {
  const vectors = JSON.parse(fs.readFileSync(VECTORS, 'utf8'));
  const refMap = buildReferenceMap(vectors.vectors);

  const rows = [];
  const skipped = [];
  for (const f of fs.readdirSync(SUBMISSIONS_DIR).sort()) {
    if (!f.endsWith('.json')) continue;
    const sub = JSON.parse(fs.readFileSync(path.join(SUBMISSIONS_DIR, f), 'utf8'));
    const result = crossVerify(sub, refMap);
    if (result.failed !== 0) {
      skipped.push(f + ' (' + result.errors.join('; ') + ')');
      continue;
    }
    const runner = sub.runner || f.replace(/\.json$/, '');
    const method = sub.method || '—';
    const artifact = sub.artifact || f;
    rows.push(
      `| **${runner}** | ${method} | ${result.match}/${result.total} canonical bytes | ${sub.date || '—'} | ${artifact} |`,
    );
  }

  let content = fs.readFileSync(IMPL, 'utf8');
  const start = content.indexOf(BEGIN);
  const end = content.indexOf(END);
  if (start === -1 || end === -1) {
    console.error('ERROR: IMPLEMENTATIONS.md is missing registry markers (' + BEGIN + ' / ' + END + ')');
    process.exit(1);
  }

  const body = rows.length
    ? '\n' + rows.join('\n') + '\n'
    : '\n<!-- (no third-party runners verified yet) -->\n';
  const newContent = content.slice(0, start + BEGIN.length) + body + content.slice(end);

  fs.writeFileSync(IMPL, newContent, 'utf8');
  console.log('Registry regenerated: ' + rows.length + ' verified runner(s)'
    + (skipped.length ? ' · skipped ' + skipped.length + ' (unverified)' : ''));
  for (const s of skipped) console.log('  skipped: ' + s);
}

if (require.main === module) main();

module.exports = {};
