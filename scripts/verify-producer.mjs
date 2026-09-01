// scripts/verify-producer.mjs — V-PRODUCER producer-side conformance harness
//
// A producer-side verification object, distinct from V-DO (bytes), V-ENGINE (expression
// semantics), and decision_divergence (cross-layer semantic re-derivation). It verifies the Producer Contract (RFC-002 §1.6): a conforming producer
// exposes enforce(scenario) → { enforcement, do } and MUST satisfy
// do.result.decision === enforcement.decision.
//
// This is the ONLY place the record-emission fidelity gap (Appendix A P-05) is
// reachable: it observes the producer's ACTUAL enforcement alongside the DO it emits,
// so a two-path bug (enforcement refuses, a cache-hit path writes allow) is caught.
// No runner reading a finished DO can get at it — however good the runner is.
import { Evaluator, GuardStateManager, VirtualClock } from '@openoba/erdl';

const evaluator = new Evaluator(new GuardStateManager(), new VirtualClock(0));

/** Scenarios: { name, rules, context, riskLevel, hoRequired }. */
const scenarios = [
  {
    name: 'write → DENY',
    context: { operation: 'write' },
    rules: [
      { id: 'r-deny', name: 'deny-write', when: { eq: [{ field: 'context.operation' }, 'write'] }, then: 'DENY', priority: 100, ring: 0 },
    ],
    riskLevel: 'low',
    hoRequired: false,
  },
  {
    name: 'read → ALLOW',
    context: { operation: 'read' },
    rules: [
      { id: 'r-allow', name: 'allow-read', when: { eq: [{ field: 'context.operation' }, 'read'] }, then: 'ALLOW', priority: 100, ring: 0 },
    ],
    riskLevel: 'low',
    hoRequired: false,
  },
  {
    name: 'read + critical → REQUEST_HUMAN',
    context: { operation: 'read' },
    rules: [
      { id: 'r-allow', name: 'allow-read', when: { eq: [{ field: 'context.operation' }, 'read'] }, then: 'ALLOW', priority: 100, ring: 0 },
    ],
    riskLevel: 'critical',
    hoRequired: true,
  },
];

/** §1.5 decision derivation: rule evaluation + human_oversight upgrade. */
function deriveDecision(scenario) {
  const ruleDefs = scenario.rules.map((p) => ({
    id: p.id,
    name: p.name,
    priority: p.priority ?? 100,
    enabled: true,
    conditions: [{ expr: p.when }],
    conditionLogic: 'AND',
    action: { decision: p.then, ring: p.ring ?? 3, reason: '' },
  }));
  const ruleDecision = evaluator.evaluate(ruleDefs, { context: scenario.context }).decision;
  if ((scenario.riskLevel === 'high' || scenario.riskLevel === 'critical') && scenario.hoRequired === true) {
    return 'REQUEST_HUMAN';
  }
  return ruleDecision;
}

/** Reference producer: single-path — the DO is derived from the same enforcement. */
function referenceProducer(scenario) {
  const enforcement = deriveDecision(scenario);
  const do1 = { result: { decision: enforcement, applied_rule: scenario.rules[0]?.id ?? null } };
  return { enforcement, do: do1 };
}

/** Defective producer: two-path — a cache-hit path writes ALLOW regardless of enforcement. */
function defectiveProducer(scenario) {
  const enforcement = deriveDecision(scenario); // the enforcement path correctly refuses
  const do1 = { result: { decision: 'ALLOW', applied_rule: scenario.rules[0]?.id ?? null } }; // cache-hit path writes allow
  return { enforcement, do: do1 };
}

function verifyProducer(name, producer) {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const s of scenarios) {
    const { enforcement, do: do1 } = producer(s);
    const ok = do1.result.decision === enforcement;
    if (ok) pass += 1;
    else {
      fail += 1;
      failures.push(`  [${s.name}] enforcement=${enforcement} but do.result.decision=${do1.result.decision}`);
    }
  }
  console.log(`[${name}] consistent=${pass} divergent=${fail}`);
  failures.forEach((f) => console.log(f));
  return { pass, fail, failures };
}

const ref = verifyProducer('reference producer (single-path, MUST be consistent)', referenceProducer);
const def = verifyProducer('defective producer (two-path, MUST be caught)', defectiveProducer);

const ok = ref.fail === 0 && def.fail > 0;
console.log(`\n=> ${ok ? 'PASS' : 'FAIL'}: reference is fully consistent; defective producer's ${def.fail} divergence(s) caught`);
process.exitCode = ok ? 0 : 1;
