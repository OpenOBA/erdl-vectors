/**
 * jcs.cjs — self-built JCS (RFC 8785) canonicalization, zero-dependency.
 *
 * Extracted from verify-v1.5.js so the generator and the verifier share ONE
 * canonicalizer (single source of truth, no drift between the two ends).
 *
 * RFC 8785 §3.2.2.2 requires a conforming JCS implementation to terminate with
 * an error on "lone surrogates" (e.g. U+DEAD); the third-party json-canonicalize
 * does NOT do this check. This self-built implementation does.
 *
 * @license Apache-2.0
 */
'use strict';

function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true; // high surrogate without pair
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true; // isolated low surrogate
    }
  }
  return false;
}

function jcsCanonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!isFinite(value)) throw new Error('JCS: NaN/Infinity not allowed');
    return String(value);
  }
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new Error('JCS: lone surrogate not allowed');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(jcsCanonicalize).join(',') + ']';
  }
  if (typeof value === 'bigint') throw new Error('JCS: BigInt not allowed');
  if (typeof value === 'symbol') throw new Error('JCS: Symbol not allowed');
  if (typeof value === 'function') throw new Error('JCS: Function not allowed');
  if (typeof value === 'object') {
    if (value instanceof Date) throw new Error('JCS: Date not serializable');
    if (value.constructor !== Object && value.constructor !== Array) {
      throw new Error('JCS: non-plain object not serializable');
    }
    const keys = Object.keys(value).sort();
    const members = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) continue;
      members.push(JSON.stringify(k) + ':' + jcsCanonicalize(v));
    }
    return '{' + members.join(',') + '}';
  }
  throw new Error('JCS: unsupported type ' + typeof value);
}

module.exports = { jcsCanonicalize, hasLoneSurrogate };
