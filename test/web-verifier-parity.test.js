/**
 * web-verifier-parity.test.js — 在线验证器（web/verify.html）与 Node 验证器的一致性回归守门
 *
 * 背景（2026-08-31 教训）：web/verify.html 内联了一份独立的 JCS + breach 检测实现，
 * 曾与 scripts/verify-v1.5.js 产生三处分歧：
 *   ① breach 优先级 P1/P2 颠倒（compliance_field_missing 排在 jurisdiction_mismatch 前）
 *   ② P5 tree_snapshot_divergence 用 m.id 而非 m.rule_id（永不命中）
 *   ③ 缺 criticalWithoutSignature（P2b risk_level=critical → signature 强制）
 *
 * 本测试提取浏览器端 collectDOBreaches（完整 breach 列表），逐条比对 Node 端，防止再次漂移。
 */
const fs = require('fs');
const path = require('path');
const { collectDOBreaches: nodeCollect } = require('../scripts/verify-v1.5.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'web', 'verify.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

/** 平衡花括号提取函数体（兼容单行/多行） */
function extractFunc(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('web/verify.html 未找到函数 ' + name);
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

describe('在线验证器（web/verify.html）与 Node 验证器一致性', () => {
  it('collectDOBreaches 对全部 DO 向量逐条一致（优先级 + 字段映射 + critical→signature）', () => {
    const dos = vectors.filter((v) => v.decision_object);
    expect(dos.length).toBeGreaterThan(0);
    dos.forEach((v) => {
      const exp = v.expected || {};
      const node = nodeCollect(v.decision_object, exp);
      const webR = web.collectDOBreaches(v.decision_object, exp);
      expect(webR, `${v.id} 在线验证器与 Node 验证器分歧`).toEqual(node);
    });
  });
});
