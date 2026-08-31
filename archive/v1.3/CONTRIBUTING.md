# Contributing to ERDL Decision Object Vectors

> Copyright © 2026 深圳市秒镜科技有限公司 (Shenzhen Miaojing Technology Co., Ltd.)

## Core Principle

**Deterministic architecture.** Every run of `node scripts/generate-vectors.cjs` must produce **byte-identical** output. If your change alters the generated JSON, update the deterministic hash in CHANGELOG.md and verify with three consecutive runs.

## Quick Validation After Changes

```bash
# 1. Regenerate vectors
npm run generate

# 2. Verify audit hashes
npm run verify

# 3. Run test suite
npm test

# 4. Confirm determinism (hash must match across runs)
npm run generate && sha256sum decision-object-vectors-v1.3.json
npm run generate && sha256sum decision-object-vectors-v1.3.json  # same hash
```

## Adding a New Static Vector

1. Add a `V({...})` entry to `vectorDefinitions[]` in `scripts/generate-vectors.cjs`
2. Ensure the vector has a unique ID (`DO-xxx`)
3. Provide complete `context`, `rules`, and `expected`
4. Regenerate and verify with the steps above

## Adding an Audit Hash Vector

1. Add an entry to `avMapping[]` in `scripts/generate-vectors.cjs`
2. Reference an existing DO vector (must be statically generated)
3. AV-013 is the chain integrity canary (AV-013 pattern (superseded AV-008)) — do not modify its hash or purpose. Its stored hash = regressed runner digest.
4. Regenerate and verify

## Modifying verify.js

- `verify.js` is **zero-dependency** — do not add npm imports
- The self-built JCS implementation must remain byte-compatible with `json-canonicalize@2.0.0`
- Any change to JCS logic must pass both the inline self-consistency checks AND the full test suite
- Five-step verification must not be altered without updating the whitepaper (§13.3)

## Test Guidelines

- Unit tests in `test/generate-comprehensive.test.ts` validate generator output structure
- Unit tests in `test/verify-comprehensive.test.ts` validate JCS + SHA-256 + 7-step verification
- Do not add snapshot tests that depend on specific UUID values — UUIDs are deterministic but may change if the frozen timestamp is updated
- Run `npm test` before committing

## Commit Conventions

- `feat:` — new vector or feature
- `fix:` — bug fix in generator or verifier
- `docs:` — documentation only
- `audit:` — audit report updates
- `test:` — test additions or corrections
- `chore:` — package.json, config, etc.

## Regulatory Knowledge Base

Files in `knowledge/regulatory/` are reference documentation. When updating:
- Cite official sources (HHS.gov, eur-lex.europa.eu, etc.)
- Include effective dates and amendment history
- For laws older than 10 years, document the most recent significant amendment

## Questions?

Open an issue at https://github.com/OpenOBA/erdl-vectors or contact OpenOBA at support@openoba.com.
