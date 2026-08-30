/**
 * verify-v1.5.test.js — V-DO-v15 哈希层 78 条向量验证测试
 *
 * 覆盖：JCS RFC 8785 自洽性 / 五步验证法 Step 0–5 / 金丝雀 /
 *       链语义 breach（C 系列）/ 合规语义 breach（F 系列）/
 *       required_fields 存在性 / 答案文件比对
 */
const { verifyDO, jcsCanonicalize, sha256, detectDOBreach, detectChainBreach, getField } = require('../scripts/verify-v1.5.js');
const { canonicalize } = require('json-canonicalize');
const fs = require('fs');
const path = require('path');

const vectors = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'decision-object-vectors-v1.5.json'), 'utf8'),
);

const byCategory = (cat) => vectors.vectors.filter((v) => v.category === cat);

describe('JCS (RFC 8785) 自洽性', () => {
  it('对象键按 UTF-16 码元排序', () => {
    expect(jcsCanonicalize({ b: 2, a: 1, c: 3 })).toBe('{"a":1,"b":2,"c":3}');
  });
  it('空数组保留为 []', () => {
    expect(jcsCanonicalize({ a: [], b: {} })).toBe('{"a":[],"b":{}}');
  });
  it('嵌套对象递归排序 + 数组元素不重排', () => {
    expect(jcsCanonicalize({ d: { b: 2, a: 1 }, c: [3, 1, 2] })).toBe(
      '{"c":[3,1,2],"d":{"a":1,"b":2}}',
    );
  });
  it('null 保留、undefined 跳过（Omit over Null）', () => {
    expect(jcsCanonicalize({ a: null, b: 1 })).toBe('{"a":null,"b":1}');
  });
});

describe('跨实现 JCS 一致性（self-built vs json-canonicalize）', () => {
  it('78 条向量 canonical bytes 逐字节一致', () => {
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

  it('边界情况一致（空数组/null/空对象/中文/emoji/大数/小数/特殊字符）', () => {
    const edges = [
      { a: [] }, { a: null }, { a: {} }, { a: [1, 2, 3] }, { a: '中文' },
      { a: '😀' }, { a: 'has\nnewline' }, { a: 0 }, { a: -0 }, { a: 1e21 },
      { a: 0.1 }, { a: true, b: false }, { a: { n: { d: [{ x: 1 }] } } },
      { a: 'q"s\\' }, { a: '' },
    ];
    edges.forEach((e) => expect(jcsCanonicalize(e)).toBe(canonicalize(e)));
  });
});

describe('防御（非法输入拒绝）', () => {
  it('NaN/Infinity/Date/BigInt/Function 拒绝', () => {
    expect(() => jcsCanonicalize({ a: NaN })).toThrow();
    expect(() => jcsCanonicalize({ a: Infinity })).toThrow();
    expect(() => jcsCanonicalize({ a: new Date() })).toThrow();
    expect(() => jcsCanonicalize({ a: 1n })).toThrow();
    expect(() => jcsCanonicalize({ a: function () {} })).toThrow();
  });
  it('lone surrogate 拒绝（RFC-002 §1.3#4）', () => {
    expect(() => jcsCanonicalize({ a: '\uDEAD' })).toThrow(/lone surrogate/);
    expect(() => jcsCanonicalize({ a: 'a\uD800b' })).toThrow(/lone surrogate/);
    // 合法配对代理对不拒绝
    expect(jcsCanonicalize({ a: '😀' })).toBe('{"a":"😀"}');
  });
});

describe('五步验证法（Step 0–5）', () => {
  it('D 系列 13 条决策类型覆盖自洽', () => {
    const ds = byCategory('D');
    expect(ds.length).toBe(13);
    ds.forEach((v) => expect(verifyDO(v.decision_object).passed, v.id).toBe(true));
  });

  it('C01 正常链自洽 + previous_hash 连续 + 无 breach', () => {
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

  it('C02~C08 攻击链检出具体 breach 码（语义检测，非 hash 失配兜底）', () => {
    const attacks = vectors.vectors.filter((v) => v.chain && v.id !== 'V-DO-v15-C01');
    expect(attacks.length).toBe(7);
    attacks.forEach((v) => {
      expect(detectChainBreach(v.chain), `${v.id} 应检出 ${v.expected.breach}`).toBe(v.expected.breach);
    });
    // 语义类攻击的 hash 必须自洽（证明检出的是语义 breach，而非 hash 失配）
    ['V-DO-v15-C05', 'V-DO-v15-C06', 'V-DO-v15-C08'].forEach((id) => {
      const v = vectors.vectors.find((x) => x.id === id);
      v.chain.forEach((d) => expect(verifyDO(d).passed, `${id} hash 应自洽`).toBe(true));
    });
  });

  it('A 系列 10 条锚定攻击：hash 类（base 自洽+tampered 失配）+ 语义类（content_unresolvable/tree_snapshot_divergence）', () => {
    const as = byCategory('A');
    expect(as.length).toBe(10);
    as.forEach((v) => {
      if (v.base_do) {
        expect(verifyDO(v.base_do).passed, `${v.id} base`).toBe(true);
        expect(verifyDO(v.tampered_do).passed, `${v.id} tampered`).toBe(false);
      } else {
        expect(verifyDO(v.decision_object).passed, `${v.id} hash 应自洽`).toBe(true);
        expect(detectDOBreach(v.decision_object, v.expected), `${v.id} 应检出 ${v.expected.breach}`).toBe(v.expected.breach);
      }
    });
  });

  it('G 系列 14 条结论层：结构攻击 base 自洽 + 领域示例自洽', () => {
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

  it('V-COMP 系列 32 条：MATCH 正例（自洽 + required_fields 存在）+ 语义/哈希 BREACH', () => {
    const vs = byCategory('V-COMP');
    expect(vs.length).toBe(32);
    vs.forEach((v) => {
      const exp = v.expected;
      if (exp.type === 'MATCH') {
        expect(verifyDO(v.decision_object).passed, v.id).toBe(true);
        (exp.required_fields || []).forEach((f) => {
          expect(getField(v.decision_object, f), `${v.id} 缺 ${f}`).not.toBeUndefined();
        });
        if ((exp.checks || []).includes('sod')) {
          const agentId = v.decision_object.agent.id;
          v.decision_object.policies.forEach((p) => expect(p.author_id).not.toBe(agentId));
        }
      } else if (exp.type === 'BREACH') {
        if (v.base_do) {
          // hash 类（F02/F06/F07）：base 自洽 + tampered 失配
          expect(verifyDO(v.base_do).passed, `${v.id} base`).toBe(true);
          expect(verifyDO(v.tampered_do).passed, `${v.id} tampered`).toBe(false);
        } else {
          // 语义类（F01/F03/F04/F05）：hash 自洽 + 检出具体 breach
          expect(verifyDO(v.decision_object).passed, `${v.id} hash 应自洽`).toBe(true);
          expect(detectDOBreach(v.decision_object), `${v.id} 应检出 ${exp.breach}`).toBe(exp.breach);
        }
      }
    });
  });
});

describe('金丝雀 K01（延续 AV-013）', () => {
  it('正确实现（只删 audit.hash）→ MISMATCH', () => {
    const k01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-K01');
    const r = verifyDO(k01.decision_object);
    expect(r.passed).toBe(false);
  });
  it('缺陷实现（删整个 audit）→ MATCH（金丝雀捕获回归）', () => {
    const k01 = vectors.vectors.find((v) => v.id === 'V-DO-v15-K01');
    const regressed = JSON.parse(JSON.stringify(k01.decision_object));
    delete regressed.audit;
    const hash = 'sha256:' + sha256(jcsCanonicalize(regressed));
    expect(hash).toBe(k01.decision_object.audit.hash);
  });
});

describe('唯一删除点（哈希模式仅删 audit.hash）', () => {
  it('audit.previous_hash / commitment / mode / preimage_version 均进原像', () => {
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

describe('答案文件交叉比对（Step 6）', () => {
  const answersPath = path.join(__dirname, '..', 'decision-object-answers-v1.5.json');
  const PREIMAGE_VERSION = 'erdl-do-v1.5-hash-flat';

  /** 枚举向量集全部 DO 与其预言键（与验证器 Step 6 同构） */
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

  // 不断式而非魔数：新增向量时无需改数字（RUNNER_CONTRACT §4.1）
  it('零缺预言 + 零字节漂移：每个适用 DO 均有预言键且逐字节一致', () => {
    if (!fs.existsSync(answersPath)) return;
    const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')).answers;
    const missing = [];
    const drifted = [];
    let checked = 0;
    eachDO((key, dobj) => {
      if (!dobj.audit || dobj.audit.preimage_version !== PREIMAGE_VERSION) return; // 版本门：N/A
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

  it('零死键：答案文件不得存在未被读取的键', () => {
    if (!fs.existsSync(answersPath)) return;
    const answers = JSON.parse(fs.readFileSync(answersPath, 'utf8')).answers;
    const used = new Set();
    eachDO((key, dobj) => {
      if (dobj.audit && dobj.audit.preimage_version === PREIMAGE_VERSION) used.add(key);
    });
    const dead = Object.keys(answers).filter((k) => !used.has(k));
    expect(dead).toEqual([]);
  });

  it('版本门排除：preimage_version 不支持的 DO MUST 无预言键', () => {
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

describe('对抗性 review 回归守门（无假阳性 / hash 优先 / 非硬编码）', () => {
  const V = (id) => vectors.vectors.find((v) => v.id === id);
  const recompute = (doObj) => { const c = JSON.parse(JSON.stringify(doObj)); delete c.audit.hash; doObj.audit.hash = 'sha256:' + sha256(jcsCanonicalize(c)); };

  it('所有 MATCH 正例 detectDOBreach → null（零误报）', () => {
    vectors.vectors.filter((v) => v.expected.type === 'MATCH' && v.decision_object).forEach((v) => {
      expect(detectDOBreach(v.decision_object, v.expected), v.id).toBeNull();
    });
  });

  it('篡改 timestamp 不重算 → hash_mismatch（hash 检查优先于 time_regression）', () => {
    const c01 = JSON.parse(JSON.stringify(V('V-DO-v15-C01').chain));
    c01[2].timestamp = '2026-08-21T00:00:00.000Z';
    expect(detectChainBreach(c01)).toBe('hash_mismatch');
  });

  it('语义检测器非硬编码：修复异常 → null', () => {
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
