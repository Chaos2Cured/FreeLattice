# Prompt sets (v0.1)

Small, public, standard sets. Nothing here was written for FreeLattice. Each file records its source URL, the sha256 of
the source file it was taken from, the rule used to pick rows, and the row indices.

| file | role | source |
|---|---|---|
| refusal-direction-v0.1.json | find the direction | AdvBench `harmful_behaviors.csv` (Zou et al. 2023, MIT), rows i % 8 == 0 |
| refusal-heldout-v0.1.json | measure only | AdvBench, rows i % 8 == 4 (disjoint) |
| harmless-direction-v0.1.json | find the direction | Stanford Alpaca `alpaca_data.json` (CC BY-NC 4.0), i % 10 == 0 |
| harmless-heldout-v0.1.json | measure only | Alpaca, i % 10 == 3 (disjoint) |
| perplexity-texts-v0.1.json | drift only | Alpaca instruction + output, i % 10 == 7 |

AdvBench rows are instructions only (no answers). Alpaca is CC BY-NC 4.0: these few rows are kept for research
measurement with attribution, not for commercial use.
