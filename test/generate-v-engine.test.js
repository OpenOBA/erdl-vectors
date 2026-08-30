/**
 * generate-v-engine.test.js — V-ENGINE 生成器回归（生成 → 逐条重算验证）
 *
 * scripts/generate-v-engine.mjs 迁入后，用 @openoba/erdl 参考引擎生成 223 条向量，
 * 与已提交的 v-engine-vectors.json 逐字节一致（新鲜度门禁）。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('V-ENGINE 生成器（scripts/generate-v-engine.mjs）', () => {
  it('生成 223 条且与已提交产物逐字节一致', () => {
    const committed = fs.readFileSync(path.join(__dirname, '..', 'v-engine-vectors.json'), 'utf8');
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'generate-v-engine.mjs')],
      { encoding: 'utf8', timeout: 120000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('223');
    // 生成器原子写回后，产物必须与提交版一致（确定性生成）
    const regenerated = fs.readFileSync(path.join(__dirname, '..', 'v-engine-vectors.json'), 'utf8');
    expect(regenerated).toBe(committed);
  });
});
