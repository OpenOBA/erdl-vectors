# Contributing to erdl-vectors

Thank you for your interest in contributing to **erdl-vectors** — the neutral,
cross-implementation conformance-vector suite for the ERDL deterministic kernel.

This repository holds the decision-object vectors, the V-ENGINE expression-kernel
vectors, the V-SIGN signature vectors, the V-RESOLVE resolution vectors, and the
independent-runner contracts. The core principle is: **neutrality is measured,
not claimed** — every vector is recomputed independently by at least one
spec-and-contract-only runner, and attribution is recorded per vector.

## Ways to Contribute

- **Report a vector bug** — open an issue with the vector id, the expected vs
  observed output, and (if possible) the recompute trace.
- **Add a vector** — propose a new conformance scenario (attack / legal / canary)
  with the breach code it must discriminate.
- **Add or fix an independent runner** — a spec-and-contract-only implementation
  that recomputes vectors without consulting the reference implementation.
- **Improve contracts or docs** — runner contracts, README, acknowledgments.

## Development Setup

```bash
git clone https://github.com/OpenOBA/erdl-vectors.git
cd erdl-vectors
npm install
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run verify` | Recompute and verify the vector suite against the answer oracle |
| `npm test` | Run the local test suite |

## Neutrality Rules

- Independent runners MUST be implemented from the spec/contract only, without
  reading the reference implementation or the answer oracle (`*-answers-*.json`,
  which is physically isolated via `.gitignore`).
- Every vector MUST state which object it verifies and its breach/decision code.
- A vector's provenance (author, review, date) MUST be recorded — see
  `IMPLEMENTATIONS.md` and the acknowledgments.

## License & Contributor License Agreement (CLA)

Vectors and spec are CC0-1.0 / Apache-2.0 (see [LICENSE](./LICENSE) and
[LICENSE-CC0](./LICENSE-CC0)). "ERDL" is a trademark of 深圳市秒镜科技有限公司
(Shenzhen Miaojing Technology Co., Ltd.); licenses cover content only and grant
no trademark rights (see [NOTICE](./NOTICE)).

**All contributors MUST agree to a Contributor License Agreement (CLA) before
their contribution can be merged.**

- **Individual contributors**: your agreement to the [Individual CLA](./CLA.md)
  is signified by opening a pull request. No separate signature is required.
- **Contributing on behalf of an employer or legal entity**: an authorized
  representative MUST sign the [Corporate CLA](./CLA-ENTITY.md) and submit it to
  OpenOBA before the contribution is merged.

The CLA grants OpenOBA the right to re-license, sublicense, and distribute your
contributions under the project's open-source licenses — including future license
changes — while you retain ownership of your original work.
