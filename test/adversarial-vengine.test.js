/**
 * adversarial-vengine.test.js — V-ENGINE 逆向（对抗）回归
 *
 * scripts/verify-v-engine-reverse.mjs 对 normal 场景（34 节点）逐条篡改字面量，
 * 求值结果 MUST 改变（少量交换律/边界场景篡改不变，阈值 >=20）。
 */
const { spawnSync } = require('child_process');
const path = require('path');

describe('V-ENGINE 逆向（scripts/verify-v-engine-reverse.mjs）', () => {
  it('normal 场景逐条篡改字面量 → 检出差异（>=20）', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'verify-v-engine-reverse.mjs')],
      { encoding: 'utf8', timeout: 120000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('检出差异');
  });
});
