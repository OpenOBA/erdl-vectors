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
 * @license Apache-2.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { buildReferenceMap, crossVerify } = require('./verify-submission.cjs');

const VECTORS = path.join(__dirname, '..', 'decision-object-vectors-v1.5.json');
const SUBMISSIONS_DIR = path.join(__dirname, '..', 'submissions');
const IMPL_FILES = [
  path.join(__dirname, '..', 'IMPLEMENTATIONS.md'),
  path.join(__dirname, '..', 'IMPLEMENTATIONS.en.md'),
];

const BEGIN = '<!-- registry:auto-begin -->';
const END = '<!-- registry:auto-end -->';

// The Registry table must be a single contiguous GFM table. Block-level elements
// (HTML comments, blank lines) are NOT allowed between rows — they split the table
// and the trailing rows render as plain pipe text. So the auto markers wrap the
// WHOLE table (header + separator + reference row + third-party rows), never a row
// boundary.
const HEADER = '| Implementor | Method | Result | Date | Artifact |';
const SEPARATOR = '|------------|--------|:-------:|------|---------|';
const REFERENCE_ROW = {
  zh: '| **OpenOBA (参考实现)** | Node.js, self-built JCS (RFC 8785) | 78/78 哈希层 + 金丝雀 K01 判别（Check 1 MISMATCH + Check 2 MATCH） | 2026-08-31 | [verify-v1.5.js](scripts/verify-v1.5.js) |',
  en: '| **OpenOBA (reference implementation)** | Node.js, self-built JCS (RFC 8785) | 78/78 hash layer + canary K01 discrimination (Check 1 MISMATCH + Check 2 MATCH) | 2026-08-31 | [verify-v1.5.js](scripts/verify-v1.5.js) |',
};

function main() {
  const vectors = JSON.parse(fs.readFileSync(VECTORS, 'utf8'));
  const refMap = buildReferenceMap(vectors.vectors);

  const rows = [];
  const fullRecords = [];
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
    // Table keeps a short summary: "<language>, self-built JCS (RFC 8785)".
    // The full method string (scope + measured vector fingerprint) is preserved
    // in the collapsible details block below.
    const lang = method.split(/[\s,;]/)[0] || method;
    const methodShort = `${lang}, self-built JCS (RFC 8785)`;
    const artifact = sub.artifact || f;
    // Short link label for a GitHub URL; otherwise the raw value.
    const artifactLabel = (() => {
      const m = String(artifact).match(/github\.com\/([^/]+)\/([^/]+)/);
      return m ? m[2] : artifact;
    })();
    rows.push(
      `| **${runner}** | ${methodShort} | ${result.match}/${result.total} canonical bytes | ${sub.date || '—'} | [${artifactLabel}](${artifact}) |`,
    );
    fullRecords.push(`- **${runner}** — ${method}`);
  }

  const details = fullRecords.length
    ? '\n\n<details>\n<summary>Full submission records · 完整提交证据（scope 与向量指纹）</summary>\n\n'
      + fullRecords.join('\n') + '\n\n</details>\n'
    : '';

  for (const file of IMPL_FILES) {
    const content = fs.readFileSync(file, 'utf8');
    const start = content.indexOf(BEGIN);
    const end = content.indexOf(END);
    if (start === -1 || end === -1) {
      console.error('ERROR: ' + path.basename(file) + ' is missing registry markers (' + BEGIN + ' / ' + END + ')');
      process.exit(1);
    }
    // Locale-aware reference row; header/separator are identical (English column names).
    const refRow = /\.en\.md$/.test(file) ? REFERENCE_ROW.en : REFERENCE_ROW.zh;
    const tableRows = [HEADER, SEPARATOR, refRow].concat(rows);
    const body = '\n' + tableRows.join('\n') + details;
    const newContent = content.slice(0, start + BEGIN.length) + body + content.slice(end);
    fs.writeFileSync(file, newContent, 'utf8');
  }
  console.log('Registry regenerated: ' + rows.length + ' verified runner(s)'
    + (skipped.length ? ' · skipped ' + skipped.length + ' (unverified)' : ''));
  for (const s of skipped) console.log('  skipped: ' + s);
}

if (require.main === module) main();

module.exports = {};
