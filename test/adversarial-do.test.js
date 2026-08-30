/**
 * adversarial-do.test.js — 逐条逆向（对抗）验证：篡改每条自洽 DO → hash 必失配
 *
 * 覆盖 78 条 V-DO-v15 向量中的全部「自洽 DO」（verifyDO 通过者）：
 *   - MATCH 正例（D/C01/G 领域/V-COMP 正例）
 *   - 语义 BREACH 单 DO（A02/A07~A10/F01/F03~F05/F08~F11，hash 自洽 + 语义违规）
 *   - base_do（A 哈希类/G 结构类/F02/F06/F07 的 base 侧）
 *   - 链成员（C01 正常 + C03~C08 结构攻击的 hash 自洽成员）
 *
 * 金丝雀 K01（hash 有意「错误」）与 C02 被篡改成员、各 tampered_do（本身已失配）不在此列。
 */
const { verifyDO } = require('../scripts/verify-v1.5.js');
const vectors = require('../decision-object-vectors-v1.5.json').vectors;

/** 篡改一个非 hash 的核心字段（decision_id 常驻且进原像） */
function tamper(obj) {
  const t = JSON.parse(JSON.stringify(obj));
  t.decision_id = (t.decision_id || 'x') + '_TAMPERED';
  return t;
}

describe('逆向：逐条篡改自洽 DO → hash 必失配', () => {
  it('所有 verifyDO 自洽的 DO，篡改 decision_id 后必失配', () => {
    let checked = 0;
    const per = (id, obj) => {
      if (!verifyDO(obj).passed) return; // 仅测自洽 DO
      expect(verifyDO(tamper(obj)).passed, `${id} 篡改后应失配`).toBe(false);
      checked++;
    };
    vectors.forEach((v) => {
      if (v.decision_object) per(v.id, v.decision_object);
      if (v.base_do) per(`${v.id}-base`, v.base_do);
      if (v.chain) v.chain.forEach((d, i) => per(`${v.id}[${i}]`, d));
    });
    // 自洽 DO 应覆盖绝大多数（K01/C02 篡改成员/tampered_do 除外）
    expect(checked).toBeGreaterThan(50);
  });
});
