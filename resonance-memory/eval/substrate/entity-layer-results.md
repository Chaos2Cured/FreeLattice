# Entity-id layer — measured

**Date:** 2026-09-07
**Mechanism:** `entity.js` — closed-class relation (family/work/friend) + proper-name mentions, store-wide resolve. Polarity is the same shape (incompatible/synergistic, allergy-to). Feeds Related: `conflict` + Hebbian `pairScale`. Never primary cosine (I2/I3). Server-assigned (I4).

## Fire-together

| kind | n | share entity | conflict |
|---|---:|---:|---:|
| true pairs | 15 | 3 | 0 |
| near-miss pairs | 15 | 0 | 3 |

Sister-Naima true members (t3_m1/m2/m3) must share one id; t3_nm must conflict.
- t3_m1/m2/m3 ids: `e1` / `e1` / `e1`
- t3_nm ids: `e2` conflict vs t3_m1: true

## Probes

| id | class | expect | ok | conflict | share |
|---|---|---|---|---|---|
| A1 | shared-name-conflict-relation | split | yes | true | false |
| A2 | shared-name-conflict-relation | split | yes | true | false |
| A3 | shared-name-conflict-relation | split | yes | true | false |
| A4 | shared-name-conflict-relation | split | yes | true | false |
| Ap1 | shared-name-same-relation | merge | yes | false | true |
| Ap2 | shared-name-same-relation | merge | yes | false | true |
| B1 | same-relation-different-name | different-ids-no-name-conflict | yes | false | false |
| F1 | structure-only-no-name | no-entity-conflict | yes | false | false |
| F2 | structure-only-same-person | no-entity-conflict | yes | false | false |
| P1 | polarity | split | yes | true | false |
| P2 | polarity-different-object | no-entity-conflict | yes | false | false |

Over-split guard is Ap1/Ap2 + t3_m1↔t3_m3: same person, two phrasings, one entity.
B1 (Naima vs Layla) gets different ids but **no** name-conflict flag — the field filter is name-keyed; same-role different-name is still a geometric near-paraphrase (fair-run 0.88). Named as a ceiling, not a miss.

## Field kNN at minSim 0.70 (nomic plain cache)

| | true-pair edges | near-miss edges |
|---|---:|---:|
| geometry only | 14 / 15 | 0 / 15 |
| + entity filter | 14 / 15 | 0 / 15 |

## Polarity ceiling

The same logical-feature approach catches incompatible vs synergistic on a shared object (P1). It does **not** invent a topic ontology: penicillin-allergy vs vitamin-D (P2 / fire-together allergy near-miss) is a different object, left to geometry (already well separated, nm mean 0.45). A general 'opposite meaning, near-identical vector' solver for arbitrary predicates would need a closed-class of predicates (this file) or an NLI/cross-encoder on the recall path — not a bigger embedder.
