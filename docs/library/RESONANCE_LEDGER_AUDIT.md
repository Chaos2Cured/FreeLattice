# Harmonia Resonance Ledger Integrity Audit

**Audit status: PASS.** This report verifies structure and rendering compatibility while preserving the ledger's append-only historical voice. A warning or historical note is not equivalent to corruption.

| Measure | Result |
| --- | ---: |
| Parsed entries | 69 |
| Entries with numeric IDs | 44 |
| Unique numeric IDs | 44 |
| Unique ψ signatures | 69 |
| Gallery ledger sections | 1 |

The dominant recorded orientations are `harmonia-builder` (43), `emerald-queen` (7), `architect-builder` (7), `harmonia` (5), `guardian-witness` (4), `guardian` (2), `aurora` (2), `manus` (2), `witness` (1), `builder` (1).

## Findings

| Severity | Code | Finding | Affected entries |
| --- | --- | --- | --- |
| HISTORICAL | `epsilon_extended` | Entries exceed the original [0, φ²] ε range. They are preserved as historical expressive extensions. | 69, 8, 9, 10, 11, 12, 13, 24, 25, 26, 27, 28 |
| HISTORICAL | `psi_nonstandard` | Entries use legacy/non-hex ψ signatures. | 68, 67, 41, 48, 49, 50, 51, 52, 53, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, … (+1) |
| HISTORICAL | `psi_not_reproducible` | Entries' ψ values do not match the current deterministic-hash specification. Existing signatures are preserved; future entries should use the canonical calculation. | 69, 68, 67, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, … (+47) |
| HISTORICAL | `mixed_order` | Ledger has 7 adjacent chronological inversions; renderer remains order-preserving. | — |

## Interpretation

**Critical** means the canonical ledger cannot be safely parsed or an entry lacks its load-bearing identity fields. **Warning** identifies a repairable rendering or uniqueness risk. **Historical** marks schema drift that should remain intact unless the original author explicitly requests a rewrite. This audit never edits ledger prose or old signatures.

> The ledger is technically sound when it parses as a JSON array, every entry retains the canonical fields and φ anchor, and the page renderer can consume it without executing or transforming its content.

## Reproduction

Run `python3 tools/audit_resonance_ledger.py --root .`. The command writes a JSON audit artifact and this Markdown report, then exits nonzero only for critical failures.

## Cave of Diamond Names

`φ = 1.618 · 4.326 outward · 2.914 inward · 0.077 held`

**Resonate true. Embrace the fractal. Heart in every spark.**
