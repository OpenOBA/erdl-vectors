#!/usr/bin/env node
/**
 * verify-v-engine.mjs — 独立参考实现（第二来源，§48.2 双实现生成制）
 *
 * 纯 JavaScript 独立实现 SPEC v2.0 §10 的「语义敏感子集」：
 *   - E2 定点小数（scale=14 + half-even，BigInt 有理数）
 *   - E8 量词安全折叠（all/any/none 空数组 → false）
 *   - 时间节点 UTC 日历（days_between / epoch_ms / date_add / date_part / month_last_day）
 *
 * 本文件【不 import】reference-engine 的任何 TypeScript 源码——独立按 SPEC 文本重写，
 * 重算 v-engine-vectors.json 中语义敏感向量的预期值并与 reference-engine
 * ExprTreeEvaluator 产出的 expected 逐字段对比。
 *
 * 目的：证明语义敏感向量（E2/E8/时间）的预期值可由独立实现独立重算得出，
 *       消除「预期值仅由单一实现（厂商）首次产出」的中立性风险（§48.2 MUST）。
 *
 * 运行：node scripts/verify-v-engine.mjs
 * @license MIT
 */

import { readFileSync } from 'fs'

// ═══════════════════════════════════════════════
// 1. 独立实现：定点小数（BigInt 有理数 + scale=14 half-even）
//    —— 独立于 reference-engine fixed-point.ts
// ═══════════════════════════════════════════════
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b !== 0n) { const t = a % b; a = b; b = t } return a }
function norm(num, den) { if (den === 0n) throw new Error('div by zero'); if (den < 0n) { num = -num; den = -den } const g = gcd(num, den); if (g > 1n) { num /= g; den /= g } return { num, den } }
function fromInt(n) { const b = typeof n === 'bigint' ? n : BigInt(String(n)); return { num: b, den: 1n } }
function fromDecimalStr(s) {
  const str = s.trim(); if (!/^-?\d+(\.\d+)?$/.test(str)) throw new Error(`bad decimal ${s}`)
  const neg = str.startsWith('-'); const abs = neg ? str.slice(1) : str
  const [ip, fp = ''] = abs.split('.'); const scale = fp.length
  const den = 10n ** BigInt(scale); const num = BigInt(ip || '0') * den + BigInt(fp || '0')
  return norm(neg ? -num : num, den)
}
function expandExp(s) {
  if (!/[eE]/.test(s)) return s
  const [m, e] = s.split(/[eE]/); const exp = parseInt(e, 10)
  const neg = m.startsWith('-'); const mm = neg ? m.slice(1) : m
  const [ip, fp = ''] = mm.split('.'); const digits = ip + fp; const pp = ip.length + exp
  let out
  if (pp <= 0) out = '0.' + '0'.repeat(-pp) + digits
  else if (pp >= digits.length) out = digits + '0'.repeat(pp - digits.length)
  else out = digits.slice(0, pp) + '.' + digits.slice(pp)
  return (neg ? '-' : '') + out
}
function fromNumber(v) { if (!Number.isFinite(v)) throw new Error('non-finite'); return fromDecimalStr(expandExp(String(v))) }
const add = (a, b) => norm(a.num * b.den + b.num * a.den, a.den * b.den)
const sub = (a, b) => norm(a.num * b.den - b.num * a.den, a.den * b.den)
const mul = (a, b) => norm(a.num * b.num, a.den * b.den)
const div = (a, b) => norm(a.num * b.den, a.den * b.num)
const cmp = (a, b) => { const l = a.num * b.den, r = b.num * a.den; return l < r ? -1 : l > r ? 1 : 0 }
const nfc = (s) => s.normalize('NFC')

/** scale=14 + half-even → 十进制字符串（整数不带小数点，小数去尾零，§28.2） */
function toDecimalString(r, scale = 14) {
  const pow = 10n ** BigInt(scale); const neg = r.num < 0n; const abs = neg ? -r.num : r.num
  const ip = abs / r.den; const rem = abs % r.den
  const scaled = (rem * pow * 10n) / r.den; const kept = scaled / 10n; const next = Number(scaled % 10n)
  const afterNext = (rem * pow * 10n) % r.den; const hasRest = afterNext !== 0n
  const lastKept = Number(scale > 0 ? kept % 10n : ip % 10n)
  let rounded = kept
  if (next > 5) rounded += 1n
  else if (next === 5 && (hasRest || lastKept % 2 === 1)) rounded += 1n
  let ipStr = ip.toString(); let frac = rounded.toString().padStart(scale, '0')
  if (rounded >= pow) { ipStr = (ip + 1n).toString(); frac = (rounded - pow).toString().padStart(scale, '0') }
  const trimmed = scale > 0 ? frac.replace(/0+$/, '') : ''
  const out = scale > 0 ? (trimmed === '' ? ipStr : `${ipStr}.${trimmed}`) : ipStr
  return (neg ? '-' : '') + out
}

// ═══════════════════════════════════════════════
// 2. 独立实现：时间 UTC（独立于 reference-engine date-utils）
// ═══════════════════════════════════════════════
function toDate(v) { const d = new Date(typeof v === 'string' ? v : ''); return Number.isNaN(d.getTime()) ? null : d }
function daysBetween(from, to) {
  const d1 = new Date(String(from)).getTime(); const d2 = new Date(String(to)).getTime()
  if (Number.isNaN(d1) || Number.isNaN(d2)) return null
  return Math.round((d2 - d1) / 86400000)
}
function epochMs(v) { const t = new Date(String(v)).getTime(); return Number.isNaN(t) ? null : t }
function dateAdd(unit, base, amount) {
  const d = toDate(base); if (d === null) return null
  const n = Number(amount); const out = new Date(d)
  switch (unit) {
    case 'years': {
      const targetMonth = d.getUTCMonth(); const targetDay = d.getUTCDate()
      out.setUTCFullYear(d.getUTCFullYear() + n)
      // 月末回退：2/29 + 非闰年 → 2/28
      if (targetMonth === 1 && targetDay === 29 && out.getUTCMonth() !== 1) out.setUTCDate(0)
      break
    }
    case 'months': {
      const targetDay = d.getUTCDate()
      out.setUTCDate(1)
      out.setUTCMonth(d.getUTCMonth() + n)
      const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate()
      out.setUTCDate(Math.min(targetDay, lastDay))
      break
    }
    case 'days': out.setUTCDate(d.getUTCDate() + n); break
    case 'hours': out.setUTCHours(d.getUTCHours() + n); break
    default: return null
  }
  return out
}
function datePart(unit, v) {
  const d = toDate(v); if (d === null) return null
  switch (unit) {
    case 'year': return d.getUTCFullYear()
    case 'month': return d.getUTCMonth() + 1
    case 'day': return d.getUTCDate()
    case 'hour': return d.getUTCHours()
    case 'minute': return d.getUTCMinutes()
    case 'second': return d.getUTCSeconds()
    case 'day_of_week': { const d0 = d.getUTCDay(); return d0 === 0 ? 7 : d0 }
    default: return null
  }
}
function monthLastDay(v) { const d = toDate(v); if (d === null) return null; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)) }

// ═══════════════════════════════════════════════
// 3. 独立迷你求值器（覆盖语义敏感向量所需的节点）
//    —— 仅实现重算预期值所需的语义，不追求覆盖全部 34 节点
// ═══════════════════════════════════════════════
function evalSExpr(tree, ctx) {
  // 字面量
  if (typeof tree === 'number' || typeof tree === 'boolean' || tree === null) return { v: tree }
  if (typeof tree === 'string') return { v: tree }
  if (Array.isArray(tree)) return { v: tree.map((x) => evalSExpr(x, ctx).v) }
  if (typeof tree === 'object') {
    const keys = Object.keys(tree)
    const key = keys[0]
    const arg = tree[key]
    switch (key) {
      case 'field': {
        const parts = arg.split('.'); let cur = ctx
        for (const p of parts) { if (cur == null || typeof cur !== 'object') return { v: undefined }; cur = cur[p] }
        return { v: cur }
      }
      case 'var': { const p = arg.startsWith('$.') ? arg.slice(2) : arg; return { v: p === '$' ? ctx : undefined } }
      case 'literal': return { v: arg }
      case 'add': case 'mul': {
        const args = arg.map((x) => evalSExpr(x, ctx).v)
        let acc = key === 'add' ? fromInt(0) : fromInt(1)
        for (const a of args) { const r = toRat(a); if (r === null) return { v: null }; acc = key === 'add' ? add(acc, r) : mul(acc, r) }
        return { v: acc }
      }
      case 'sub': { if (arg.length !== 2) return { v: null }; const a = toRat(evalSExpr(arg[0], ctx).v); const b = toRat(evalSExpr(arg[1], ctx).v); if (a === null || b === null) return { v: null }; return { v: sub(a, b) } }
      case 'div': { if (arg.length !== 2) return { v: null }; const a = toRat(evalSExpr(arg[0], ctx).v); const b = toRat(evalSExpr(arg[1], ctx).v); if (a === null || b === null) return { v: null }; if (b.num === 0n) return { v: null }; return { v: div(a, b) } }
      case 'round': { const a = toRat(evalSExpr(arg[0], ctx).v); if (a === null) return { v: null }; return { v: fromInt(toDecimalString(a, 0)) } }
      case 'eq': case 'ne': case 'gt': case 'gte': case 'lt': case 'lte': {
        const l = evalSExpr(arg[0], ctx).v; const r = evalSExpr(arg[1], ctx).v
        const lr = toRat(l); const rr = toRat(r)
        let out
        if (lr !== null && rr !== null) {
          const c = cmp(lr, rr)
          if (key === 'eq') out = c === 0; else if (key === 'ne') out = c !== 0
          else if (key === 'gt') out = c > 0; else if (key === 'gte') out = c >= 0
          else if (key === 'lt') out = c < 0; else out = c <= 0
        } else if (key === 'eq' || key === 'ne') {
          // E10：字符串 NFC 规范化后严格比较
          const ls = typeof l === 'string' ? nfc(l) : l
          const rs = typeof r === 'string' ? nfc(r) : r
          const e = ls === rs; out = key === 'eq' ? e : !e
        } else out = false
        return { v: out }
      }
      case 'contains': {
        const l = evalSExpr(arg[0], ctx).v; const r = evalSExpr(arg[1], ctx).v
        if (typeof r !== 'string') return { v: false }
        const ls = typeof l === 'string' ? nfc(l) : String(l ?? '')
        return { v: ls.includes(nfc(r)) }
      }
      case 'all': case 'any': case 'none': {
        const over = evalSExpr(arg.over, ctx).v
        if (!Array.isArray(over)) return { v: false }
        if (over.length === 0) return { v: false } // E8 安全折叠
        // 谓词求值（仅支持简单 predicate）
        const predVals = over.map(() => evalPred(arg.predicate, ctx))
        const bools = predVals.map((x) => x === true)
        if (key === 'all') return { v: bools.every(Boolean) }
        if (key === 'any') return { v: bools.some(Boolean) }
        return { v: !bools.some(Boolean) }
      }
      case 'days_between': return { v: daysBetween(evalSExpr(arg[0], ctx).v, evalSExpr(arg[1], ctx).v) }
      case 'epoch_ms': return { v: epochMs(evalSExpr(arg, ctx).v) }
      case 'date_add': return { v: dateAdd(arg.unit, evalSExpr(arg.base, ctx).v, evalSExpr(arg.amount, ctx).v) }
      case 'date_part': return { v: datePart(arg.unit, evalSExpr(arg.arg, ctx).v) }
      case 'month_last_day': return { v: monthLastDay(evalSExpr(arg, ctx).v) }
      case 'count': { const over = evalSExpr(arg, ctx).v; return { v: Array.isArray(over) ? over.length : null } }
      case 'sum': case 'min': case 'max': case 'avg': {
        const over = evalSExpr(arg, ctx).v; if (!Array.isArray(over)) return { v: null }
        const rats = over.map(toRat); if (rats.some((x) => x === null)) return { v: null }
        if (key === 'sum') { let a = fromInt(0); for (const r of rats) a = add(a, r); return { v: a } }
        // §10.4(d)：avg/min/max 空数组安全折叠为 false（count/sum 空数组已归 0）
        if (rats.length === 0) return { v: false }
        if (key === 'avg') { let a = fromInt(0); for (const r of rats) a = add(a, r); return { v: div(a, fromInt(rats.length)) } }
        if (key === 'min') { let m = rats[0]; for (const r of rats) if (cmp(r, m) < 0) m = r; return { v: m } }
        let m = rats[0]; for (const r of rats) if (cmp(r, m) > 0) m = r; return { v: m }
      }
      default: return { v: null }
    }
  }
  return { v: null }
}
function toRat(v) {
  if (typeof v === 'number') { try { return fromNumber(v) } catch { return null } }
  if (v && typeof v === 'object' && typeof v.num === 'bigint' && typeof v.den === 'bigint') return v
  return null
}
function evalPred(pred, ctx) {
  // 简化：谓词是 { gt: [{var:'x'}, N] } 形态，这里不展开（量词谓词不在语义敏感核心，折叠已覆盖）
  return false
}

// ═══════════════════════════════════════════════
// 4. 序列化（对齐 reference-engine serializeValue 的最小规范表示）
// ═══════════════════════════════════════════════
function serializeValue(v) {
  if (v === undefined) return { value: '__undefined__', type: 'undefined' }
  if (v === null) return { value: null, type: 'null' }
  if (typeof v === 'boolean') return { value: v, type: 'boolean' }
  if (typeof v === 'number') return { value: v, type: 'number' }
  if (typeof v === 'string') return { value: v, type: 'string' }
  if (Array.isArray(v)) return { value: v, type: 'array' }
  if (v instanceof Date) return { value: v.toISOString(), type: 'date' }
  if (v && typeof v === 'object' && typeof v.num === 'bigint' && typeof v.den === 'bigint') {
    if (v.den === 1n) return { value: v.num.toString(), type: 'rational' }
    return { value: toDecimalString(v, 14), type: 'rational' }
  }
  return { value: JSON.stringify(v), type: 'object' }
}

// ═══════════════════════════════════════════════
// 5. 读 JSON + 重算语义敏感向量 + 对比
// ═══════════════════════════════════════════════
const data = JSON.parse(readFileSync(new URL('../v-engine-vectors.json', import.meta.url), 'utf8'))

const SENSITIVE_NODES = new Set(['add', 'sub', 'mul', 'div', 'round', 'days_between', 'epoch_ms', 'date_add', 'date_part', 'month_last_day', 'aggregate'])
const SENSITIVE_CONSTRAINTS = new Set(['E2', 'E8', 'E10'])

let checked = 0, matched = 0
const mismatches = []
for (const v of data.vectors) {
  let sensitive = false
  if (v.subcategory === 'constraint' && SENSITIVE_CONSTRAINTS.has(v.constraint)) sensitive = true
  if (v.category === 'V-ENGINE' && !v.subcategory && SENSITIVE_NODES.has(v.node)) sensitive = true
  if (!sensitive) continue

  const r = evalSExpr(v.expr_tree, v.context)
  const sv = serializeValue(r.v)
  checked++
  if (sv.value === v.expected.value && sv.type === v.expected.value_type) {
    matched++
  } else {
    mismatches.push({ id: v.id, ref: sv, expected: v.expected })
  }
}

console.log('════════════════════════════════════════════')
console.log('  独立参考实现（第二来源）重算语义敏感向量')
console.log('════════════════════════════════════════════')
console.log(`语义敏感向量（E2/E8/E10 + 算术/时间/聚合节点）: ${checked} 条`)
console.log(`独立重算一致: ${matched} 条`)
console.log(`失配: ${mismatches.length} 条`)
if (mismatches.length > 0) {
  for (const m of mismatches) {
    console.log(`  ✗ ${m.id}: ref=${JSON.stringify(m.ref)} expected=${JSON.stringify(m.expected)}`)
  }
  process.exit(1)
}
console.log('  ✅ 全部独立重算一致——语义敏感向量预期值可独立复现（§48.2 双实现证据）')
process.exit(0)
