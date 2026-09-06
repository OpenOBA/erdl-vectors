const fs = require('fs')
const path = require('path')
const root = process.cwd()

function apply(file, pairs) {
  const p = path.join(root, file)
  if (!fs.existsSync(p)) { console.log('MISSING FILE', file); return }
  let t = fs.readFileSync(p, 'utf8')
  const missing = []
  for (const [from, to] of pairs) {
    if (!t.includes(from)) { missing.push(from.slice(0, 40)); continue }
    t = t.split(from).join(to)
  }
  fs.writeFileSync(p, t)
  console.log(file + (missing.length ? '  MISSING: ' + missing.join(' | ') : '  ok'))
}

// Number sync: 236→239, 48→51 (constraints), 214→217 (V-ENGINE), 314→317 (Core), 74→77 (semantic-sensitive)
apply('scripts/verify-v-engine-full.mjs', [
  ['V-ENGINE full 236-vector verifier', 'V-ENGINE full 239-vector verifier'],
  ['this file: full 236 coverage', 'this file: full 239 coverage'],
  ['✅ V-ENGINE 236 vectors full verification passed', '✅ V-ENGINE 239 vectors full verification passed'],
])
apply('scripts/generate-v-engine.mjs', [
  ['V-ENGINE 236-vector generator', 'V-ENGINE 239-vector generator'],
])
apply('scripts/v-engine.mjs', [
  ['node 136 + constraint 48 + simple_compile 30 + gloss 12 + gloss_integrity 4 + projection 6 = 236', 'node 136 + constraint 51 + simple_compile 30 + gloss 12 + gloss_integrity 4 + projection 6 = 239'],
])
apply('scripts/verify-decision.mjs', [
  ['pinned by the 236 V-ENGINE vectors', 'pinned by the 239 V-ENGINE vectors'],
])

apply('README.md', [
  ['Core vectors 314 (audit layer 78 + expression layer 236)', 'Core vectors 317 (audit layer 78 + expression layer 239)'],
  ['Core%20vectors-314', 'Core%20vectors-317'],
  ['Core total **314** = V-DO-v15 audit layer 78 + V-ENGINE expression layer 236.', 'Core total **317** = V-DO-v15 audit layer 78 + V-ENGINE expression layer 239.'],
  ['Node semantics 136 + evaluation constraints 48 + Simple compilation 30', 'Node semantics 136 + evaluation constraints 51 + Simple compilation 30'],
  ['| 214 | Unverified (reference only) |', '| 217 | Unverified (reference only) |'],
  ['| **Core** | **314** | **Partial (78/314)** |', '| **Core** | **317** | **Partial (78/317)** |'],
  ['the expression layer 236 vectors (V-ENGINE 214 + V-GLOSS / V-PROJ 22)', 'the expression layer 239 vectors (V-ENGINE 217 + V-GLOSS / V-PROJ 22)'],
  ['`v-engine-vectors.json` (V-ENGINE expression layer, 236 vectors).', '`v-engine-vectors.json` (V-ENGINE expression layer, 239 vectors).'],
  ['### V-ENGINE expression layer (236 vectors)', '### V-ENGINE expression layer (239 vectors)'],
  ['evaluation constraints 48 (the E1–E12 vectorizable subset)', 'evaluation constraints 51 (the E1–E12 vectorizable subset)'],
  ['not in Core 314', 'not in Core 317'],
  ['On top of Core 314, two new verification objects', 'On top of Core 317, two new verification objects'],
  ['npm run generate:vengine  # generate the 236 V-ENGINE vectors', 'npm run generate:vengine  # generate the 239 V-ENGINE vectors'],
  ['npm run verify:vengine    # V-ENGINE expression-layer independent verification (74 semantics-sensitive vectors)', 'npm run verify:vengine    # V-ENGINE expression-layer independent verification (77 semantics-sensitive vectors)'],
  ['npm run verify:vengine:full  # V-ENGINE full 236 vectors', 'npm run verify:vengine:full  # V-ENGINE full 239 vectors'],
])
apply('README.zh-CN.md', [
  ['Core 向量 314 条（审计层 78 + 表达层 236）', 'Core 向量 317 条（审计层 78 + 表达层 239）'],
  ['Core%20vectors-314', 'Core%20vectors-317'],
  ['Core 合计 **314 条** = V-DO-v15 审计层 78 + V-ENGINE 表达层 236。', 'Core 合计 **317 条** = V-DO-v15 审计层 78 + V-ENGINE 表达层 239。'],
  ['节点语义 136 + 求值约束 48 + Simple 编译 30', '节点语义 136 + 求值约束 51 + Simple 编译 30'],
  ['| 214 | 未验证（仅参考） |', '| 217 | 未验证（仅参考） |'],
  ['| **Core** | **314** | **部分验证（78/314）** |', '| **Core** | **317** | **部分验证（78/317）** |'],
  ['表达层 236 条（V-ENGINE 214 + V-GLOSS / V-PROJ 22）', '表达层 239 条（V-ENGINE 217 + V-GLOSS / V-PROJ 22）'],
  ['`v-engine-vectors.json`（V-ENGINE 表达层 236 条）。', '`v-engine-vectors.json`（V-ENGINE 表达层 239 条）。'],
  ['### V-ENGINE 表达层（236 条）', '### V-ENGINE 表达层（239 条）'],
  ['求值约束 48（E1–E12 可向量化子集）', '求值约束 51（E1–E12 可向量化子集）'],
  ['非 Core 314', '非 Core 317'],
  ['在 Core 314 之上', '在 Core 317 之上'],
  ['npm run generate:vengine  # 生成 V-ENGINE 236 条向量', 'npm run generate:vengine  # 生成 V-ENGINE 239 条向量'],
  ['npm run verify:vengine    # V-ENGINE 表达层独立验证（74 条语义敏感向量）', 'npm run verify:vengine    # V-ENGINE 表达层独立验证（77 条语义敏感向量）'],
  ['npm run verify:vengine:full  # V-ENGINE 全量 236 条', 'npm run verify:vengine:full  # V-ENGINE 全量 239 条'],
])
apply('EXPRESSION-RUNNER-CONTRACT.md', [
  ['recomputes the 236 `v-engine-vectors.json` vectors', 'recomputes the 239 `v-engine-vectors.json` vectors'],
  ['together the 236-vector surface', 'together the 239-vector surface'],
  ['For all **236** `v-engine-vectors.json` vectors', 'For all **239** `v-engine-vectors.json` vectors'],
  ['run all 236 `v-engine-vectors.json` vectors', 'run all 239 `v-engine-vectors.json` vectors'],
  ['(**74 vectors**, the same set', '(**77 vectors**, the same set'],
  ['this 74-vector set is the *honesty sentinel*', 'this 77-vector set is the *honesty sentinel*'],
  ['conformance requires **all 236** vectors (ER4); the 74 are', 'conformance requires **all 239** vectors (ER4); the 77 are'],
])
apply('EXPRESSION-RUNNER-CONTRACT.zh-CN.md', [
  ['对 `v-engine-vectors.json` 的 236 条向量逐条重算', '对 `v-engine-vectors.json` 的 239 条向量逐条重算'],
  ['合计 236 条向量的覆盖面', '合计 239 条向量的覆盖面'],
  ['对 `v-engine-vectors.json` 全部 **236 条**向量逐条重算', '对 `v-engine-vectors.json` 全部 **239 条**向量逐条重算'],
  ['对 `v-engine-vectors.json` 全部 236 条向量运行', '对 `v-engine-vectors.json` 全部 239 条向量运行'],
  ['（**74 条**，即本仓第二源独立重算的那批）', '（**77 条**，即本仓第二源独立重算的那批）'],
  ['注意：这 74 条是*诚实性哨兵子集*', '注意：这 77 条是*诚实性哨兵子集*'],
  ['conformance 要求**全部 236 条**（ER4）；74 条', 'conformance 要求**全部 239 条**（ER4）；77 条'],
])
apply('docs/VECTOR-POSITIONING.md', [
  ['## 三、236 条向量在表达什么', '## 三、239 条向量在表达什么'],
  ['**全部 236 条只验一件事', '**全部 239 条只验一件事'],
  ['是「补强」现有 236 向量', '是「补强」现有 239 向量'],
])
apply('docs/VERIFIER-GUIDE.en.md', [
  ['pinned by the 236 V-ENGINE vectors', 'pinned by the 239 V-ENGINE vectors'],
])
apply('docs/VERIFIER-GUIDE.md', [
  ['被 V-ENGINE 236 向量钉住', '被 V-ENGINE 239 向量钉住'],
])
apply('docs/OPENOBA-DOBJ-RFC-002-CN.md', [
  ['非 Core 314', '非 Core 317'],
])
apply('docs/OPENOBA-DOBJ-RFC-002-EN.md', [
  ['not in Core 314', 'not in Core 317'],
])
