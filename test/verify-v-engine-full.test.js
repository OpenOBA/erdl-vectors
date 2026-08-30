/**
 * verify-v-engine-full.test.js — V-ENGINE 全量 223 条向量验证回归
 *
 * scripts/verify-v-engine-full.mjs 用 @openoba/erdl 参考引擎逐条求值
 * v-engine-vectors.json（34 节点 × 4 场景 + E1-E12 约束 + Simple + gloss + projection）。
 */
const { spawnSync } = require('child_process');
const path = require('path');

describe('V-ENGINE 全量验证器（scripts/verify-v-engine-full.mjs）', () => {
  it('223 条向量全量重算一致（exit 0）', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'verify-v-engine-full.mjs')],
      { encoding: 'utf8', timeout: 120000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('223/223');
  });
});
