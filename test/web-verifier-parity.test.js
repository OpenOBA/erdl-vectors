/**
 * web-verifier-parity.test.js — online verifier (web/verify.html) vs Node verifier consistency regression gate
 *
 * Background (2026-08-31 lesson): web/verify.html inlines an independent JCS + breach-detection implementation,
 * which once diverged from scripts/verify-v1.5.js in three places:
 *   ① breach priority P1/P2 inverted (compliance_field_missing placed before jurisdiction_mismatch)
 *   ② P5 tree_snapshot_divergence used m.id instead of m.rule_id (never matched)
 *   ③ missing criticalWithoutSignature (P2b risk_level=critical → signature mandatory)
 *
 * This test extracts the browser-side collectDOBreaches (full breach list) and compares per vector with the Node side, preventing future drift.
 */
const fs = require('fs');
const path = require('path');
const { collectDOBreaches: nodeCollect } = require('../scripts/verify-v1.5.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'verify.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

/** balanced-brace function body extraction (supports single-line/multi-line) */
function extractFunc(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('web/verify.html function not found: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

const KNOWN = new Function(
  'return ' + script.match(/const KNOWN_JURISDICTIONS = (\[[^\]]*\])/)[1],
)();

const web = new Function(
  'KNOWN_JURISDICTIONS',
  'const hasLoneSurrogate = ' + extractFunc(script, 'hasLoneSurrogate') + ';\n' +
  'const jcsCanonicalize = ' + extractFunc(script, 'jcsCanonicalize') + ';\n' +
  'const getField = ' + extractFunc(script, 'getField') + ';\n' +
  'const collectDOBreaches = ' + extractFunc(script, 'collectDOBreaches') + ';\n' +
  'return { jcsCanonicalize, getField, collectDOBreaches };',
)(KNOWN);

const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'decision-object-vectors-v1.5.json'), 'utf8'),
).vectors;

describe('online verifier (web/verify.html) vs Node verifier consistency', () => {
  it('collectDOBreaches per-vector consistent for all DO vectors (priority + field mapping + critical→signature)', () => {
    const dos = vectors.filter((v) => v.decision_object);
    expect(dos.length).toBeGreaterThan(0);
    dos.forEach((v) => {
      const exp = v.expected || {};
      const node = nodeCollect(v.decision_object, exp);
      const webR = web.collectDOBreaches(v.decision_object, exp);
      expect(webR, `${v.id} online verifier diverges from Node verifier`).toEqual(node);
    });
  });
});
