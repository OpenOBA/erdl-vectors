# Independent §7.1 resolution pass

Spec basis: `erdl-landing@7ba1e64`, file `erdl-language-spec-v2.1.md` (v2.2 content). Run `node scripts/run-v-resolve.mjs` from the repository root. The runner imports neither `erdl-formal` nor the reference engine. It interprets the fixture's Simple `eq` conditions, applies an explicit pass before the catch-all pass, orders matches by ring/priority/override/definition order, and emits the requested observable fields. It intentionally supports only the subset exercised by R01–R13.

R04, R10, and R12 have a catch-all DENY, prohibited at load time by §7.4. They are marked as hypothetical tests of §7.1 item 6, **not** valid full-document conformance fixtures. The legal catch-all ALLOW rules carry an advisory instruction as §7.4 requires. `unless`, `enabled`, the other §6 decisions, error folding, canonical-tree evidence, and full-document validation are outside this narrow runner's contract.

## Independent result and subsequent comparison

The independent runner was implemented and executed before reading or executing the `erdl-formal` resolver. The initial cross-check agreed on R01–R07 and R09–R12, while R08 exposed a boundary in the interpretation of §7.1 item 5.

R08 uses a ring 0 ALLOW followed by a ring 3 critical DENY. The initial independent derivation preserved ALLOW, while `erdl-formal` returned DENY. This divergence was raised for maintainer clarification rather than treated as a reference defect.

The maintainer subsequently clarified the normative semantics and updated §7.1 item 5 and the reference implementations:

- tightening an established ALLOW with a restrictive DENY is the default behavior and does not require override or ring comparison;
- `override` on a DENY is inert;
- relaxing DENY → ALLOW requires a qualifying override.

The independent runner has therefore been aligned so R08 resolves to DENY. A same-ring critical-DENY regression vector, R13, has also been added to cover the clarified tightening behavior.

The neutral fixture inputs remain independent of the reference implementation; the clarification is recorded in the runner/regression layer rather than retroactively encoding an expected result into the original R08 fixture.
