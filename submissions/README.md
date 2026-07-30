# Third-Party Runner Submissions

> Submit your ERDL Decision Object output for cross-implementation verification.

## How to verify your runner

1. **Fork** this repository
2. **Run your runner** on the v1.3 test vectors → produce a JSON output file
3. **Place** your output in this directory: `submissions/<runner-name>-output.json`
4. **Open a PR** → GitHub Actions automatically verifies against v1.3 vectors
5. **If all pass** → we'll merge and record your runner in `verified-runners.json`

## Output format

Your JSON should be an array of decision objects matching this structure:

```json
[
  {
    "vector_id": "DO-001",
    "result": {
      "decision": "DENY",
      "severity": "high",
      "reason": "...",
      "matched_rules": [...],
      "decision_object": { ... }
    }
  }
]
```

## Verified Runners

| Runner | Language | Date | Result |
|--------|----------|------|--------|
| rulsynor | TypeScript | 2026-07-30 | 101/101 |
| concordia | Python | 2026-07-30 | 13/13 AV |
| *your runner here* | — | — | — |
