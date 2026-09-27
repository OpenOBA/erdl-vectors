# Independent §7.1 resolution pass

Spec basis: `erdl-landing@7ba1e64`, file `erdl-language-spec-v2.1.md` (v2.2 content). Run `node scripts/run-v-resolve.mjs` from the repository root. The runner imports neither `erdl-formal` nor the reference engine. It interprets the fixture's Simple `eq` conditions, applies an explicit pass before the catch-all pass, orders matches by ring/priority/override/definition order, and emits the requested observable fields. It intentionally supports only the subset exercised by R01–R12.

R04, R10, and R12 have a catch-all DENY, prohibited at load time by §7.4. They are marked as hypothetical tests of §7.1 item 6, **not** valid full-document conformance fixtures. The legal catch-all ALLOW rules carry an advisory instruction as §7.4 requires. `unless`, `enabled`, the other §6 decisions, error folding, canonical-tree evidence, and full-document validation are outside this narrow runner's contract.

## Independent result and subsequent comparison

The independent runner was implemented and executed before reading or executing the `erdl-formal` resolver. Afterwards, the matched rules for each fixture were passed to `erdl_formal.resolution.resolve` from the public `OpenOBA/erdl-formal` repository. The final decisions agree for R01–R07 and R09–R12. R08 diverges:

| Case | Input | Independent runner | `erdl-formal` |
| --- | --- | --- | --- |
| R08 | ring 0 ALLOW, then ring 3 critical DENY | ALLOW | DENY |

The independent reading treats §7.1 item 5's DENY → ALLOW-only override direction as excluding the later `critical` DENY from replacing the established ALLOW. The reference resolver instead treats a restrictive decision in a later ring as tightening an earlier ALLOW, regardless of the restrictive rule's `critical` marker. The reference engine's `evaluator.ts` has the same explicit later-ring restriction behavior. This is a **spec interpretation question**, not yet proof of a reference defect. In particular, the text does not state in one place whether later-ring restrictive tightening operates independently of the direction limit on marked overrides. Retain the neutral R08 input and ask the maintainer to clarify the intended normative outcome; then record the resolution with a spec citation and a regression case.

No expected decisions are embedded in `resolution-vectors.json`; its observables remain neutral. This note records the first cross-check rather than silently adapting the independent runner to match the reference.
