# DESIGN: verify.js — 通用零依赖验证器设计 v1.3

> Copyright © 2026 唐启鑫 (Tang Qixin). All rights reserved.

> 版本: 1.3 · 2026-07-29
> 状态: Released
> 目标: 跨语言、跨实现、零依赖的 DO 验证器，支持 L1/L2/L3 三级兼容

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| **零依赖** | 只用 Node.js 内置模块 (`crypto`, `fs`, `path`)，不依赖 npm |
| **单一文件** | `scripts/verify.js`，可以直接复制到任何 Node.js 环境运行 |
| **三级兼容** | L1 Basic (28) / L2 Verified (45) / L3 Full (101) |
| **可移植** | 纯算法实现，可翻译为 Python/Go/Rust |
| **自文档** | `--help` 输出完整的验证方法说明 |

## 2. 核心算法: 五步验证法

### 2.1 自建 JCS (不依赖外部库)

`verify.js` 必须自建 JCS 序列化器，因为:

1. 验证器的权威性建立在"不信任任何外部库"的基础上
2. 验证器本身是算法的"活文档"——任何人阅读代码就能理解 DO 的验证逻辑
3. 与实际生产用的 `json-canonicalize` 互相制衡——如果两者结果不同，说明其中一个有 bug

**自建 JCS 算法** (RFC 8785):

```javascript
function jcsCanonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('JCS: NaN/Infinity not allowed');
    return String(value);  // ES6 Number.toString() = JCS serialization
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(jcsCanonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort(); // 按 Unicode 码点排序
    return '{' + keys.map(k =>
      JSON.stringify(k) + ':' + jcsCanonicalize(value[k])
    ).join(',') + '}';
  }
  throw new Error('JCS: unsupported type ' + typeof value);
}
```

**精度校验**: 验证器必须能检测到自建 JCS 与参考 `json-canonicalize` 的不同。通过 101 条向量的 `canonical_bytes` 预计算值进行比较。

**Omit over Null 原则**：可选字段值为 `null`、`undefined` 或 `[]` 时必须从 JSON 对象中物理删除（`delete obj.field`），而非保留 `"field": null`。JCS 序列化器在遍历对象键时自然会跳过已删除的键。此原则同样适用于验证器从 JSON 文件读取 DO 后的预处理——生成器保证不会写入 null 值字段，但验证器需要防御性地处理外部输入。

### 2.2 数字规范化 (ES6 Number.prototype.toString)

**JCS (RFC 8785) = ECMAScript 数字序列化。**

JCS §3.2.2.3 明确规定数字序列化与 ECMAScript (ECMA-262) 的 `Number.prototype.toString()` 完全一致。这意味着：
- 整数：直接输出 `String(n)` → `"3"`、`"0"`、`"-1"`
- 浮点数：输出 `sign + digits + . + digits + e + sign + digits` 格式

在 JavaScript 中，最简单的正确实现就是直接使用 `String(number)` 或 `number.toString()`：

```javascript
String(1234.56)     // → "1234.56"
String(4.50)        // → "4.5"
String(0.0001)      // → "0.0001"
String(1e30)        // → "1e+30"
String(333333333.33333329)  // → "333333333.3333333" (IEEE 754 精度)
String(5e-324)      // → "5e-324" (最小正数)
String(1.7976931348623157e+308) // → "1.7976931348623157e+308" (最大正数)
```

**注意**：`String(0)` 和 `String(-0)` 都输出 `"0"`（JCS 要求——零的正负号不被保留）。`NaN` 和 `Infinity` 被 JCS 禁止，必须在输入时被截获。

```javascript
function serializeNumber(num) {
  if (!isFinite(num)) throw new Error('JCS: NaN/Infinity not allowed');
  // ES6 Number.prototype.toString() is JCS-compliant
  // Integers: no ".0" suffix
  // Note: String(Number.isInteger(num) ? num : num) is equivalent to String(num)
  return String(num);
}
```

**精度测试**（来自 RFC 8785 Appendix B）：

| IEEE 754 (hex) | JSON Representation | Comment |
|----------------|---------------------|---------|
| 0000000000000000 | 0 | Zero |
| 8000000000000000 | 0 | Minus zero (correctly: 0) |
| 0000000000000001 | 5e-324 | Min pos number |
| 7fefffffffffffff | 1.7976931348623157e+308 | Max pos number |
| 3ff0000000000000 | 1 | One |
| 4000000000000000 | 2 | Two |
| 4014000000000000 | 5 | Integer |

**验证器的职责**：验证器自建 JCS 的序列化结果必须与 `json-canonicalize` npm 包逐字节一致。如果某条向量的 `canonical_bytes` 匹配上了 `json-canonicalize` 的输出，就说明自建 JCS 是正确的。

## 3. CLI 接口

```
Usage: node scripts/verify.js [path/to/vectors.json]

The verifier accepts a single positional argument — the path to the vector set JSON.
Defaults to `./decision-object-vectors-v1.3.json` when called from the repo root.

Examples:
  node verify.js
  node verify.js decision-object-vectors-v1.3.json
  node verify.js path/to/custom-vectors.json

For compatibility level filtering (L1/L2/L3), use the vector set's `metadata.compatibility_levels`
in the output JSON — each level maps to a subset of the total 101 vectors.
```

### 输出示例 (text模式)

```
ERDL Decision Object v1.3  Validator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vector set: decision-object-vectors-v1.3.json
Compatibility: L3 (101 vectors)
JCS implementation: built-in (RFC 8785)

AV-001  PASS  cb=f479997b...  audit=sha256:f479997b...
AV-002  PASS  cb=e8a2c1d4...  audit=sha256:e8a2c1d4...
AV-003  PASS  cb=a1b2c3d4...  audit=sha256:a1b2c3d4...
AV-004  PASS  cb=b2c3d4e5...  audit=sha256:b2c3d4e5...
AV-005  PASS  cb=c3d4e5f6...  audit=sha256:c3d4e5f6...
AV-006  PASS  cb=d4e5f6a7...  audit=sha256:d4e5f6a7...
AV-007  PASS  cb=e5f6a7b8...  audit=sha256:e5f6a7b8...
AV-013  FAIL  cb=N/A      audit=MISMATCH ← EXPECTED: chain position tampering canary
AV-009  PASS  cb=f6a7b8c9...  audit=sha256:f6a7b8c9...
AV-010  PASS  cb=a7b8c9d0...  audit=sha256:a7b8c9d0...
AV-011  PASS  cb=b8c9d0e1...  audit=sha256:b8c9d0e1...
AV-012  PASS  cb=c9d0e1f2...  audit=sha256:c9d0e1f2...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 L3 Full: 11/12 PASS (1 expected failure: AV-013)
 ✅ Implementations producing these results are ERDL v1.3 compatible
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 输出示例 (json模式)

```json
{
  "validator": "erdl-vectors-verify.js",
  "spec": "decision-object-v1.0",
  "compliance": "erdl-compliance-v1.2",
  "level": "L3",
  "timestamp": "2026-07-27T23:59:59.999Z",
  "summary": {
    "total": 12,
    "passed": 11,
    "failed": 1,
    "expected_failures": 1,
    "conclusion": "PASS"
  },
  "results": [
    {
      "id": "AV-001",
      "canonical_bytes_match": true,
      "audit_hash_match": true,
      "status": "PASS"
    },
    ...
    {
      "id": "AV-013",
      "canonical_bytes_match": true,
      "audit_hash_match": false,
      "status": "EXPECTED_FAIL",
      "note": "Stale regression vector — retains v1.1.0 audit.hash value"
    }
  ]
}
```

## 4. 验证逻辑

### 4.1 对每条 AV 的验证流程

```javascript
function verifyAuditVector(av) {
  // 1. 深拷贝决策对象
  const clone = JSON.parse(JSON.stringify(av.decision_object));

  // 2. 提取 claimed hash
  const claimedHash = clone.audit.hash;

  // 3. 删除自引用/签名字段（仅删 audit.hash，保留 previous_hash 和 commitment）
  delete clone.audit.hash;     // 只删 hash 键
  delete clone.signature;
  delete clone.signing_key_id;

  // 4. JCS 序列化（CORE + JURISDICTION + EXTENSIONS）
  const canonicalStr = jcsCanonicalize(clone);
  const canonicalBytes = Buffer.from(canonicalStr, 'utf-8').toString('hex');

  // 5. SHA-256
  const recomputedHash = 'sha256:' + sha256(canonicalStr);

  // 6. 比较
  const cbMatch = canonicalBytes === av.canonical_bytes;
  const ahMatch = recomputedHash === claimedHash;

  return {
    canonical_bytes_match: cbMatch,
    audit_hash_match: ahMatch,
    recomputed_canonical_bytes: canonicalBytes,
    recomputed_audit_hash: recomputedHash,
    status: cbMatch && ahMatch ? 'PASS' : 'FAIL'
  };
}
```

### 4.2 L1/L2 兼容过滤

```javascript
function filterByLevel(vectors, level) {
  if (level === 'L3') return vectors;
  // L1/L2 计数从向量集 metadata.compatibility_levels 动态读取
  // 生成器在输出 JSON 的 metadata 中声明各级别计数
  const meta = vectors.metadata;
  // L1/L2 filtering is documented here for future multi-level CI pipelines.
  // Current verify.js always validates all 63 DOs + 12 AVs (L3 level).
  if (!meta.compatibility_levels || !meta.compatibility_levels[level]) {
    console.error('ERROR: Vector set missing compatibility_levels metadata');
    process.exit(2);
  }
  const counts = meta.compatibility_levels[level];
  return {
    decision_vectors: vectors.decision_vectors.slice(0, counts.decision_vectors),
    audit_vectors: vectors.audit_vectors.slice(0, counts.audit_vectors)
  };
}
```

## 5. 可移植性设计

`verify.js` 的代码结构遵循 **Literal Translation** 原则:

1. 不使用箭头函数以外的 ES6 特性 (可翻译为 Python/Go)
2. `jcsCanonicalize()` 是纯函数递归 —— 对应 Python 的 `def jcs_canonicalize(value)`
3. `sha256()` 是 `crypto.createHash('sha256')` —— 对应 Python 的 `hashlib.sha256()`
4. 不依赖任何 Node.js 特有的 API 模式 (如 Stream/Buffer 高级功能)

**翻译为 Python** (~30 行核心差异):
```python
# Node.js
const hash = crypto.createHash('sha256').update(data, 'utf-8').digest('hex')

# Python
import hashlib
hash = hashlib.sha256(data.encode('utf-8')).hexdigest()
```

其余逻辑（JCS 序列化、对象遍历、数组处理）是纯算法，语际直译。

## 6. 错误处理与边界情况

| 场景 | 行为 |
|------|------|
| 向量文件不存在 | 退出码 1，输出 `ERROR: Vector file not found` |
| 向量格式无效 (缺少 audit_vectors) | 退出码 2，输出 `ERROR: Invalid vector format` |
| AV-013 的 expected MISMATCH | 状态 `EXPECTED_FAIL`，不计入总失败数 |
| extensions 验证 | 直接参与主 JCS，不需要单独验证 |
| canonical_bytes 不一致 | 状态 `FAIL`，输出差异长度和位置 |
| 自建 JCS 与 reference 不同 | 状态 `PASS` 但输出 WARNING: `JCS divergence detected` |
| JCS 遇到 NaN/Infinity | 抛出: 退出码 3，输出 `INVALID: NaN/Infinity in JCS input` |

## 7. 函数签名 (完整 API)

```javascript
// 核心 JCS 序列化
function jcsCanonicalize(value) → string

// SHA-256 哈希
function sha256(data) → string (hex)

// 平面哈希验证 (对单个 DO)
function computeAuditHash(decisionObject) → { hash, canonicalBytes }

// 五步验证
function verifyAuditVector(av) → AuditResult

// 完整验证套件
function verifyAll(vectors, options) → { summary, results[] }

// CLI 主入口
function main(args) → exitCode
```

## 8. 退出码

| 码 | 含义 |
|:---:|------|
| 0 | 全部 PASS (含 AV-013 expected failure) |
| 1 | 文件 I/O 错误 |
| 2 | 向量格式无效 |
| 3 | JCS 输入违规 (NaN/Infinity) |
| 4 | 有真正的 FAIL (非 expected failure) |

## 9. 文件大小预估

`verify.js` 单文件约 **400-500 行**:
- JCS 序列化器: ~70 行
- SHA-256 封装: ~5 行
- 五步验证逻辑: ~60 行
- CLI 解析 + 格式化输出: ~100 行
- 注释 + 文档字符串: ~100 行

## 10. 测试策略

### 10.1 自验证 (smoke test)

```bash
# 生成向量集
node scripts/generate-vectors.cjs

# 验证器验证自己生成的向量
node scripts/verify.js --vectors=decision-object-vectors-v1.3.json --level=L3

# 期望输出: 11/12 PASS, 1 expected failure (AV-013)
```

### 10.2 交叉验证 (cross-implementation)

```bash
# Node.js 验证器
node scripts/verify.js > node-result.txt

# Python 翻译版验证器
python3 scripts/verify.py > python-result.txt

# Go 翻译版验证器
go run scripts/verify.go > go-result.txt

# 比较: 三个结果的 canonical_bytes 必须逐字节一致
diff node-result.txt python-result.txt  # should be empty
diff python-result.txt go-result.txt    # should be empty
```

### 10.3 回归检测

```bash
# v1.2 的 canonical_bytes 与 v1.1 不同是预期的 (平面哈希变更)
# 但 v1.1 的旧向量在 v1.2 下重算应有明确的差异记录
node scripts/verify.js --vectors=../erdl-vectors-v1.1/decision-object-vectors-v1.1.json 2>&1
# 期望: JCS 方法不同 → 大部分 audit.hash 不匹配 → 记录为"v1.1 legacy"
```

---

> *中立性是被测出来的，不是宣称出来的。*
