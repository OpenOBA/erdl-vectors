# ERDL Decision Object v1.5 — Independent Implementations

本注册表仅记录第三方实现者提交的验证结果。  
列入本表不代表 OpenOBA 的背书 — 仅记录"谁在什么日期通过了多少条向量"。

*This registry records only what independent implementors have measured.  
Inclusion implies no endorsement — only "who passed how many vectors on what date."*

---

## 现行向量集

- **标准**：OPENOBA-DOBJ-RFC-002（Decision Object v1.5 扁平哈希链 + 表达式树字段）
- **向量文件**：`decision-object-vectors-v1.5.json`（V-DO-v15 哈希层 78 条）
- **验证程序**：五步验证法 Step 0–6（RFC-002 §7），`scripts/verify-v1.5.js`（零依赖 self-built JCS）
- **答案文件**：`decision-object-answers-v1.5.json`（canonical_hex 物理隔离，.gitignore，提交者不可读）
- **自动记录**：`conformance/CONFORMANCE.md`（CI 自动生成，记录 Check 1 + Check 2 + K01 判别 + R1–R6 对照结论；`npm run conformance`）

## Registry

| Implementor | Method | Vectors | Date | Artifact |
|------------|--------|:-------:|------|---------|
| **OpenOBA (参考实现)** | Node.js, self-built JCS (RFC 8785) | 78/78 哈希层 + 金丝雀 K01 判别（Check 1 MISMATCH + Check 2 MATCH） | 2026-08-31 | [verify-v1.5.js](scripts/verify-v1.5.js) |

<!-- registry:auto-begin -->
<!-- (no third-party runners verified yet) -->
<!-- registry:auto-end -->

> 第三方 Runner 提交见 [submissions/README.md](submissions/README.md)；CI 交叉验证通过后，合并时自动登记于上表。

### v1.3 历史档案（Decision Object v1.3，AV 编号）

v1.3 时代的第三方验证记录（13 AV 向量），归档保留、不复用编号：

| Implementor | Method | Vectors | Date | Artifact |
|------------|--------|:-------:|------|---------|
| **Concordia (Erik Newton)** | Python, spec-only, self-built JCS | 13/13 AV | 2026-07-30 | [archive/v1.3/submissions/](archive/v1.3/submissions/) |
| **OpenOBA (Clean-Room CI)** | Node.js, self-built JCS, SDK uninstalled | 63/63 DO + 12/12 AV | 2026-08-05 | [archive/v1.3/conformance/CONFORMANCE.md](archive/v1.3/conformance/CONFORMANCE.md) |

> 注：Erik Newton（Concordia）是首个、也是迄今**唯一第三方 Runner**，于 2026-07-30 用 Python 纯规范实现（自建 JCS）逐字节验证 v1.3 全部 13 条 AV 向量。v1.5（V-DO-v15 78 条）**尚无第三方验证**，待重新约 Runner。

## Submission Process

见 [submissions/README.md](submissions/README.md)（提交格式 + 步骤）。CI 交叉验证（`verify-submission.cjs`）通过后，合并时自动登记于上表（`scripts/update-registry.cjs`）。

### Principles

- **Measurements, not endorsements**: 注册表记录事实，不认证、不背书、不保证。
- **Spec neutrality**: 实现的价值由其符合规范文本的程度决定，与作者/所属无关。
- **No answers file**: 提交者 MUST 自行实现 JCS canonicalizer；答案文件永不对 Runner 暴露。
- **Clean-room preferred**: 验证前确认无 ERDL SDK 可导入，独立性更强。
- **金丝雀常驻**: K01 捕获"跳过独立重算"的缺陷实现（删整个 audit 而非仅删 audit.hash）。
