// scripts/verify-decision.mjs — decision_divergence cross-layer semantic re-derivation check
//
// Re-derives each DO's decision from its own stored context + rules, then asserts
// result.decision coherence. Uses @openoba/erdl's deterministic Evaluator (the same
// evaluation core pinned by the 223 V-ENGINE vectors) — so the re-derivation is
// cross-implementation: any independent runner can reproduce it byte-for-byte.
//
// This is a "bound, not a closure" (RFC-002 §1.5 / VERIFIER-GUIDE §4.4): it catches an internally
// INCOHERENT record (a decision that does not follow from the cited rules), but NOT
// a producer-side record-emission fidelity gap (Appendix A P-05), which no finished
// artifact can expose.
import { readFileSync } from 'node:fs';
import { Evaluator, GuardStateManager, VirtualClock } from '@openoba/erdl';

const evaluator = new Evaluator(new GuardStateManager(), new VirtualClock(0));

/** Collect every DO-bearing object a vector can carry. */
function collectDOs(v) {
  const out = [];
  if (v.decision_object) out.push([v.id, v.decision_object]);
  if (v.base_do) out.push([`${v.id}-base`, v.base_do]);
  if (v.tampered_do) out.push([`${v.id}-tampered`, v.tampered_do]);
  return out;
}

/** Convert DO policies[] → Evaluator RuleDefinition[] (when is the S-expression form). */
function toRules(policies) {
  return policies.map((p) => ({
    id: p.id,
    name: p.name || p.id,
    priority: p.priority ?? 100,
    enabled: true,
    conditions: p.when !== undefined ? [{ expr: p.when }] : [],
    conditionLogic: 'AND',
    action: { decision: p.then, ring: p.ring ?? 3, reason: '' },
  }));
}

/**
 * Three-state result:
 *  - 'skip'     : not a decision-bearing DO (missing policies/result/context)
 *  - 'coherent' : decision re-derives cleanly to result.decision
 *  - { reason } : decision_divergence detected
 */
function check(doObj) {
  if (!doObj || !Array.isArray(doObj.policies) || doObj.policies.length === 0) return 'skip';
  if (!doObj.result || typeof doObj.result.decision !== 'string') return 'skip';
  if (doObj.context === undefined) return 'skip';

  // dangling applied_rule: the cited rule id is absent from policies
  const appliedRuleId = doObj.result.applied_rule;
  if (appliedRuleId !== undefined && !doObj.policies.some((p) => p.id === appliedRuleId)) {
    return { reason: `applied_rule ${appliedRuleId} not in policies` };
  }

  let reDerived;
  try {
    reDerived = evaluator.evaluate(toRules(doObj.policies), { context: doObj.context });
  } catch (e) {
    return { reason: `re-derivation error: ${e && e.message ? e.message : String(e)}` };
  }

  // RFC-002 §1.5 step 2: human_oversight upgrade for high/critical risk.
  let expected = reDerived.decision;
  const riskLevel = doObj.compliance_profile && doObj.compliance_profile.risk_level;
  const hoRequired = doObj.human_oversight && doObj.human_oversight.required;
  if ((riskLevel === 'high' || riskLevel === 'critical') && hoRequired === true) {
    expected = 'REQUEST_HUMAN';
  }

  if (expected !== doObj.result.decision) {
    return { reason: `re-derived ${expected} != claimed ${doObj.result.decision}` };
  }
  return 'coherent';
}

/** Run the check over a vector file; returns {coherent, skipped, divergences}. */
function run(vectors, expectDivergence) {
  let coherent = 0;
  let skipped = 0;
  const divergences = [];
  for (const v of vectors) {
    for (const [label, doObj] of collectDOs(v)) {
      const r = check(doObj);
      if (r === 'skip') {
        skipped += 1;
        continue;
      }
      if (r === 'coherent') {
        coherent += 1;
        continue;
      }
      divergences.push({ vector: label, reason: r.reason });
    }
  }
  return { coherent, skipped, divergences, expectDivergence };
}

function report(name, { coherent, skipped, divergences, expectDivergence }) {
  console.log(`[${name}] coherent=${coherent} skipped=${skipped} divergences=${divergences.length}`);
  for (const d of divergences) console.log(`  DIVERGENCE ${d.vector}: ${d.reason}`);
  const pass = expectDivergence
    ? divergences.length > 0 && coherent === 0
    : divergences.length === 0;
  console.log(`  => ${pass ? 'PASS' : 'FAIL'}${expectDivergence ? ' (all MUST diverge)' : ' (all MUST be coherent)'}`);
  return pass;
}

const main = JSON.parse(
  readFileSync(new URL('../decision-object-vectors-v1.5.json', import.meta.url), 'utf8'),
).vectors;
const div = JSON.parse(
  readFileSync(new URL('../decision-divergence-vectors.json', import.meta.url), 'utf8'),
).vectors;

const okMain = report('main-vectors (expect coherent)', run(main, false));
const okDiv = report('divergence-vectors (expect divergence)', run(div, true));
process.exitCode = okMain && okDiv ? 0 : 1;
