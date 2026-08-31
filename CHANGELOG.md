# Changelog — ERDL Decision Object Test Vectors

> Copyright © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.) · MIT License

## v1.5.0（现行）

Decision Object v1.5 扁平哈希链跨实现测试向量集。

- **V-DO-v15 审计层 78 条**（`decision-object-vectors-v1.5.json`）：决策类型 13 / 链攻击检测 8 / 锚定攻击检测 10 / 金丝雀 1 / 结论层 14 / 法域合规 32
- **V-ENGINE 表达层 223 条**（`v-engine-vectors.json`）：节点语义 136（34 节点 × 4 场景）/ 求值约束 35 / Simple 编译 30 / gloss 16 / 投影面 6
- **规范性契约**：`RUNNER_CONTRACT.md`（规则 R1–R6）+ `docs/VERIFIER-GUIDE.md`
- **验证程序**：五步验证法 Step 0–6（RFC-002 §7），参考实现 `scripts/verify-v1.5.js`（零依赖 self-built JCS）
- **自动记录**：`scripts/generate-conformance.cjs` → `conformance/CONFORMANCE.md`（CI 自动生成，记录 Check 1/2 + K01 判别 + R1–R6；`npm run conformance`）+ `submissions/README.md`（第三方 runner 提交管道）

## v1.3（历史档案，归档于 archive/v1.3/）

Decision Object v1.3，13 条 AV 向量，经 Erik Newton（Concordia）独立 Runner 逐字节验证。
