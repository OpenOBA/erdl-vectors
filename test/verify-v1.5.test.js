/**
 * verify-v1.5.test.js — V-DO-v15 hash-layer 78-vector verification tests
 *
 * Coverage: JCS RFC 8785 self-consistency / five-step method Step 0–5 / canary /
 *       chain semantic breach (C series) / compliance semantic breach (F series) /
 *       required_fields presence / answer-file comparison
 */
const { verifyDO, jcsCanonicalize, sha256, detectDOBreach, detectChainBreach, getField } = require('../scripts/verify-v1.5.js');
const { canonicalize } = require('json-canonicalize');
const fs = require('fs');
const path = require('path');

const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'decision-object-vectors-v1.5.json'), 'utf8'),
);

const byCategory = (cat) => vectors.vectors.filter((v) => v.category === cat);

describe('JCS (RFC 8785) self-consistency', () => {
  it('object keys sorted by UTF-16 code unit', () => {
    expect(jcsCanonicalize({ b: 2, a: 1, c: 3 })).toBe('{"a":1,"b":2,"c":3}');
  });
  it('empty array preserved as []', () => {
    expect(jcsCanonicalize({ a: [], b: {} })).toBe('{"a":[],"b":{}}');
  });
  it('nested objects recursively sorted + array elements not reordered', () => {
    expect(jcsCanonicalize({ d: { b: 2, a: 1 }, c: [3, 1, 2] })).toBe(
      '{"c":[3,1,2],"d":{"a":1,"b":2}}',
    );
  });
  it('null preserved, undefined skipped (Omit over Null)', () => {
    expect(jcsCanonicalize({ a: null, b: 1 })).toBe('{"a":null,"b":1}');
  });
});

describe('cross-implementation JCS consistency (self-built vs json-canonicalize)', () => {
  it('78 vectors canonical bytes byte-identical', () => {
    const dos = [];
    vectors.vectors.forEach((v) => {
      if (v.decision_object) dos.push(v.decision_object);
      else if (v.chain) v.chain.forEach((d) => dos.push(d));
      else if (v.base_do) { dos.push(v.base_do); dos.push(v.tampered_do); }
    });
    let consistent = 0;
    dos.forEach((doObj) => {
      const c = JSON.parse(JSON.stringify(doObj));
      delete c.audit.hash;
      if (jcsCanonicalize(c) === canonicalize(c)) consistent++;
    });
    expect(consistent).toBe(dos.length);
  });

  it('edge cases consistent (empty array/null/empty object/unicode/emoji/large number/decimal/special chars)', () => {
    const edges = [
      { a: [] }, { a: null }, { a: {} }, { a: [1, 2, 3] }, { a: 'café' },
      { a: '😀' }, { a: 'has\nnewline' }, { a: 0 }, { a: -0 }, { a: 1e21 },
      { a: 0.1 }, { a: true, b: false }, { a: { n: { d: [{ x: 1 }] } } },
      { a: 'q"s\\' }, { a: '' },
    ];
    edges.forEach((e) => expect(jcsCanonicalize(e)).toBe(canonicalize(e)));
  });
});

describe('defense (reject invalid input)', () => {
  it('NaN/Infinity/Date/BigInt/Function rejected', () => {
    expect(() => jcsCanonicalize({ a: NaN })).toThrow();
    expect(() => jcsCanonicalize({ a: Infinity })).toThrow();
    expect(() => jcsCanonicalize({ a: new Date() })).toThrow();
    expect(() => jcsCanonicalize({ a: 1n })).toThrow();
    expect(() => jcsCanonicalize({ a: function () {} })).toThrow();
  });
  it('lone surrogate rejected (RFC-002 §1.3#4)', () => {
    expect(() => jcsCanonicalize({ a: '\uDEAD' })).toThrow(/lone surrogate/);
    expect(() => jcsCanonicalize({ a: 'a\uD800b' })).toThrow(/lone surrogate/);
    // valid paired surrogate pairs are not rejected
    expect(jcsCanonicalize({ a: '😀' })).toBe('{"a":"😀"}');
  });
});

describe('five-step verification (Step 0–5)', () => {
  it('D series 13 decision-type coverage self-consistent', () => {
    const ds = byCategory('D');
    expect(ds.length).toBe(13);
    ds.forEach((v) => expect(verifyDO(v.decision_object).passed, v.id).toBe(true));
  });

  it('C01 normal chain self-consistent + previous_hash continuous + no breach', () => {
    const c01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-C01');
    expect(c01.chain.length).toBe(3);
    c01.chain.forEach((dobj, i) => {
      expect(verifyDO(dobj).passed, `C01[${i}]`).toBe(true);
      if (i > 0) {
        expect(dobj.audit.previous_hash).toBe(c01.chain[i - 1].audit.hash);
        expect(dobj.audit.chain_seq).toBe(c01.chain[i - 1].audit.chain_seq + 1);
      }
    });
    expect(detectChainBreach(c01.chain)).toBeNull();
  });

  it('C02~C08 attack chains detect a specific breach code (semantic detection, not hash-mismatch fallback)', () => {
    const attacks = vectors.vectors.filter((v) => v.chain && v.id !== 'V-DO-v15-C01');
    expect(attacks.length).toBe(7);
    attacks.forEach((v) => {
      expect(detectChainBreach(v.chain), `${v.id} should detect ${v.expected.breach}`).toBe(v.expected.breach);
    });
    // semantic attacks must have self-consistent hash (proving the detected breach is semantic, not hash mismatch)
    ['V-DO-v15-C05', 'V-DO-v15-C06', 'V-DO-v15-C08'].forEach((id) => {
      const v = vectors.vectors.find((x) => x.id === id);
      v.chain.forEach((d) => expect(verifyDO(d).passed, `${id} hash should be self-consistent`).toBe(true));
    });
  });

  it('A series 10 anchoring attacks: hash (base self-consistent + tampered mismatch) + semantic (content_unresolvable/tree_snapshot_divergence)', () => {
    const as = byCategory('A');
    expect(as.length).toBe(10);
    as.forEach((v) => {
      if (v.base_do) {
        expect(verifyDO(v.base_do).passed, `${v.id} base`).toBe(true);
        expect(verifyDO(v.tampered_do).passed, `${v.id} tampered`).toBe(false);
      } else {
        expect(verifyDO(v.decision_object).passed, `${v.id} hash should be self-consistent`).toBe(true);
        expect(detectDOBreach(v.decision_object, v.expected), `${v.id} should detect ${v.expected.breach}`).toBe(v.expected.breach);
      }
    });
  });

  it('G series 14 outcome layer: structural-attack base self-consistent + domain examples self-consistent', () => {
    const gs = byCategory('G');
    expect(gs.length).toBe(14);
    gs.forEach((v) => {
      if (v.base_do) {
        expect(verifyDO(v.base_do).passed, `${v.id} base`).toBe(true);
        expect(verifyDO(v.tampered_do).passed, `${v.id} tampered`).toBe(false);
      } else {
        expect(verifyDO(v.decision_object).passed, v.id).toBe(true);
      }
    });
  });

  it('V-COMP series 32: MATCH positives (self-consistent + required_fields present) + semantic/hash BREACH', () => {
    const vs = byCategory('V-COMP');
    expect(vs.length).toBe(32);
    vs.forEach((v) => {
      const exp = v.expected;
      if (exp.type === 'MATCH') {
        expect(verifyDO(v.decision_object).passed, v.id).toBe(true);
        (exp.required_fields || []).forEach((f) => {
          expect(getField(v.decision_object, f), `${v.id} missing ${f}`).not.toBeUndefined();
        });
        if ((exp.checks || []).includes('sod')) {
          const agentId = v.decision_object.agent.id;
          v.decision_object.policies.forEach((p) => expect(p.author_id).not.toBe(agentId));
        }
      } else if (exp.type === 'BREACH') {
        if (v.base_do) {
          // hash type (F02/F06/F07): base self-consistent + tampered mismatch
          expect(verifyDO(v.base_do).passed, `${v.id} base`).toBe(true);
          expect(verifyDO(v.tampered_do).passed, `${v.id} tampered`).toBe(false);
        } else {
          // semantic type (F01/F03/F04/F05): hash self-consistent + detect specific breach
          expect(verifyDO(v.decision_object).passed, `${v.id} hash should be self-consistent`).toBe(true);
          expect(detectDOBreach(v.decision_object), `${v.id} should detect ${exp.breach}`).toBe(exp.breach);
        }
      }
    });
  });
});

describe('canary K01 (continues AV-013)', () => {
  it('correct implementation (deletes only audit.hash) → MISMATCH', () => {
    const k01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-K01');
    const r = verifyDO(k01.decision_object);
    expect(r.passed).toBe(false);
  });
  it('defective implementation (deletes the whole audit) → MATCH (canary catches regression)', () => {
    const k01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-K01');
    const regressed = JSON.parse(JSON.stringify(k01.decision_object));
    delete regressed.audit;
    const hash = 'sha256:' + sha256(jcsCanonicalize(regressed));
    expect(hash).toBe(k01.decision_object.audit.hash);
  });
});

describe('single deletion point (hash mode deletes only audit.hash)', () => {
  it('audit.previous_hash / commitment / mode / preimage_version all enter the preimage', () => {
    const d01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-D01');
    const doObj = d01.decision_object;
    const tampered = JSON.parse(JSON.stringify(doObj));
    tampered.audit.previous_hash = 'sha256:' + 'f'.repeat(64);
    expect(verifyDO(tampered).passed).toBe(false);
    const tampered2 = JSON.parse(JSON.stringify(doObj));
    tampered2.audit.preimage_version = 'erdl-do-v1.3-hash-flat';
    const r = verifyDO(tampered2);
    expect(r.passed).toBe(false);
  });
});

describe('answer-file cross-check (Step 6)', () => {
  const answersPath = path.join(__dirname, '..', 'decision-object-answers-v1.5.json');
  const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';

  /** Enumerate all DOs in the vector set and their oracle keys (isomorphic with verifier Step 6) */
  function eachDO(cb) {
    vectors.vectors.forEach((v) => {
      if (v.decision_object) cb(v.id, v.decision_object);
      if (v.base_do) {
        cb(`${v.id}-base`, v.base_do);
        cb(`${v.id}-tampered`, v.tampered_do);
      }
      if (v.chain) v.chain.forEach((dobj, i) => cb(`${v.id}[${i}]`, dobj));
    });
  }

  // assertion-style rather than magic numbers: adding vectors needs no number change (RUNNER_CONTRACT §4.1)
  it('zero missing oracle + zero byte drift: every applicable DO has an oracle key and is byte-identical', () => {
    if (!fs.existsSync(answersPath)) return;
    const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')).answers;
    const missing = [];
    const drifted = [];
    let checked = 0;
    eachDO((key, dobj) => {
      if (!dobj.audit || dobj.audit.preimage_version !== PREIMAGE_VERSION) return; // version gate: N/A
      const oracle = answers[key];
      if (oracle === undefined) { missing.push(key); return; }
      const r = verifyDO(dobj);
      if (r.canonicalHex !== oracle) drifted.push(key);
      checked++;
    });
    expect(missing).toEqual([]);
    expect(drifted).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });

  it('zero dead keys: the answer file must not contain unread keys', () => {
    if (!fs.existsSync(answersPath)) return;
    const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')).answers;
    const used = new Set();
    eachDO((key, dobj) => {
      if (dobj.audit && dobj.audit.preimage_version === PREIMAGE_VERSION) used.add(key);
    });
    const dead = Object.keys(answers).filter((k) => !used.has(k));
    expect(dead).toEqual([]);
  });

  it('version-gate exclusion: DOs with unsupported preimage_version MUST have no oracle key', () => {
    if (!fs.existsSync(answersPath)) return;
    const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')).answers;
    const leaked = [];
    eachDO((key, dobj) => {
      const pv = dobj.audit && dobj.audit.preimage_version;
      if (pv !== PREIMAGE_VERSION && answers[key] !== undefined) leaked.push(key);
    });
    expect(leaked).toEqual([]);
  });
});

describe('adversarial review regression gate (no false positive / hash priority / not hardcoded)', () => {
  const V = (id) => vectors.vectors.find((v) => v.id === id);
  const recompute = (doObj) => { const c = JSON.parse(JSON.stringify(doObj)); delete c.audit.hash; doObj.audit.hash = 'sha256:' + sha256(jcsCanonicalize(c)); };

  it('all MATCH positives detectDOBreach → null (zero false positive)', () => {
    vectors.vectors.filter((v) => v.expected.type === 'MATCH' && v.decision_object).forEach((v) => {
      expect(detectDOBreach(v.decision_object, v.expected), v.id).toBeNull();
    });
  });

  it('tamper timestamp without recompute → hash_mismatch (hash check precedes time_regression)', () => {
    const c01 = JSON.parse(JSON.stringify(V('V-DO-v15-C01').chain));
    c01[2].timestamp = '2026-08-21T00:00:00.000Z';
    expect(detectChainBreach(c01)).toBe('hash_mismatch');
  });

  it('semantic detector not hardcoded: fix the anomaly → null', () => {
    const a02 = JSON.parse(JSON.stringify(V('V-DO-v15-A02').decision_object));
    a02.evaluation.knowledge_references[0].entry_id = 'kb-001';
    expect(detectDOBreach(a02, { resolvable_entry_ids: ['kb-001'] })).toBeNull();

    const a07 = JSON.parse(JSON.stringify(V('V-DO-v15-A07').decision_object));
    a07.evaluation.matched_rules[0].canonical_tree = { eq: [{ field: 'context.amount' }, '0.95'] };
    expect(detectDOBreach(a07)).toBeNull();

    const f01 = JSON.parse(JSON.stringify(V('V-COMP-F01').decision_object));
    f01.agent.aid = '91110108MA12345678A00000001E';
    expect(detectDOBreach(f01)).toBeNull();

    const f03 = JSON.parse(JSON.stringify(V('V-COMP-F03').decision_object));
    f03.compliance_profile.jurisdictions = ['CN'];
    expect(detectDOBreach(f03)).toBeNull();

    const f05 = JSON.parse(JSON.stringify(V('V-COMP-F05').decision_object));
    f05.policies[0].author_id = 'author-openoba';
    expect(detectDOBreach(f05)).toBeNull();

    const c08 = JSON.parse(JSON.stringify(V('V-DO-v15-C08').chain));
    c08[1].audit.mode = 'hash';
    recompute(c08[1]);
    c08[2].audit.previous_hash = c08[1].audit.hash;
    recompute(c08[2]);
    expect(detectChainBreach(c08)).toBeNull();
  });
});
