/**
 * verify-v-engine.test.js — V-ENGINE 独立验证器回归
 *
 * scripts/verify-v-engine.mjs 是独立参考实现（第二来源，§48.2 双实现生成制），
 * 不 import 参考引擎源码，独立按 SPEC 文本重算「语义敏感」向量（E2/E8/E10 + 算术/时间/聚合节点）。
 */
const { spawnSync } = require('child_process');
const path = require('path');

describe('V-ENGINE 独立验证器（scripts/verify-v-engine.mjs）', () => {
  it('57 条语义敏感向量独立重算一致（exit 0）', () => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'verify-v-engine.mjs')],
      { encoding: 'utf8', timeout: 60000 },
    );
    expect(r.status, 'stderr: ' + (r.stderr || '')).toBe(0);
    expect(r.stdout).toContain('57');
  });
});
