# Normalizer Rules (Phase 1)

Nimbus Finance ships with a lightweight merchant normalizer that runs during
categorization. Rules are stored in the `normalization_rules` table and are
evaluated **in ascending priority order** (`priority ASC, createdAt ASC`). The
first matching rule wins; no subsequent rules are evaluated.

## Matchers

Each rule uses one of four matchers:

| matcher     | behaviour                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| `contains`  | case- and diacritics-insensitive substring search across text + counterparty |
| `startsWith`| matches when any token or the full corpus starts with the pattern          |
| `equals`    | matches when a token or the full corpus equals the pattern                 |
| `regex`     | JavaScript regular expression with the `i` flag                            |

Patterns are stored verbatim; non-regex matchers are normalised (lowercase,
diacritics removed) before comparison. Regex patterns should avoid catastrophic
backtracking – prefer `contains` / `startsWith` where possible.

## Runtime behaviour

* Rules are cached per process (`loadRules()`) and invalidated automatically on
  CRUD mutations and on `/api/normalizer/test` requests.
* When a rule matches:
  * `merchant` on the categorized transaction is set to `normalizeTo`.
  * `categoryHint` is populated if the transaction did not already provide a
    category.
  * `raw.normalizerMatchedRuleId` records the rule id for debugging.
  * In non-production environments we log `ruleId` + `profileId`.
* Imports include the `normalizerRulesActive` count in their diagnostics.

## Admin APIs (Phase 1)

```
GET    /api/normalizer/rules
POST   /api/normalizer/rules
PUT    /api/normalizer/rules/:id
DELETE /api/normalizer/rules           { ids: string[] }
POST   /api/normalizer/test            { text, counterparty? }
```

The API rejects duplicate `(matcher, pattern, normalizeTo)` triplets by default.
Use `priority` to control precedence (lower ⇒ earlier). `is_active=false`
disables a rule without deleting it.

## Dev workflow

* Seed script adds a sample “Uber” rule for local smoke testing.
* Use `ts-node backend/scripts/debug-normalizer.ts "sample text" [counterparty]`
  to inspect what a rule would return without running a full import.
* After direct DB edits run `clearRulesCache()` (exported from
  `normalizer/engine`) or call any CRUD endpoint to invalidate the cache.

## Reindexing (Phase 2+)

A `/api/admin/reindex` endpoint is planned to re-run normalization over prior
imports. Until then, upload imports again to apply new rules.

## Performance notes

Rules are simple string comparisons; keep rule sets lean and prefer contains /
startsWith for common merchants. Regex support is for exceptional cases; avoid
complex expressions that could introduce backtracking latency.


