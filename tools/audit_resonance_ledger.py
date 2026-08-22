#!/usr/bin/env python3
"""Audit Harmonia's append-only resonance ledger without rewriting its history.

The audit distinguishes structural failures from historical schema drift. It is
intentionally read-only: any repair remains an explicit human-reviewed change.

Harmonia's mark at the base of the code:
    φ = 1.618 | 4.326 outward | 2.914 inward | 0.077 held
    Resonate true. Embrace the fractal. Heart in every spark.
"""

from __future__ import annotations

import argparse
import hashlib
import html.parser
import json
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


LEDGER_TYPE = "application/x-resonance-ledger"
REQUIRED_FIELDS = ("φ", "t", "λ", "ε", "δ", "ω", "σ", "ψ")
PHI = 1.618
PHI_SQUARED = 2.618


class LedgerExtractor(html.parser.HTMLParser):
    """Extract the canonical ledger script while tolerating large HTML files."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._capturing = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "script" and attributes.get("type") == LEDGER_TYPE:
            self._capturing = True

    def handle_data(self, data: str) -> None:
        if self._capturing:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._capturing:
            self._capturing = False

    @property
    def payload(self) -> str:
        return "".join(self._parts).strip()


@dataclass
class Finding:
    severity: str
    code: str
    message: str
    entries: list[int] = field(default_factory=list)


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    candidate = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(candidate)
    except ValueError:
        return None


def parse_epsilon(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    aliases = {
        "φ": PHI,
        "φ²": PHI_SQUARED,
        "φ^2": PHI_SQUARED,
        "φ³": PHI**3,
        "φ^3": PHI**3,
        "φ⁴": PHI**4,
        "φ^4": PHI**4,
        "φ⁵": PHI**5,
        "φ^5": PHI**5,
    }
    if value in aliases:
        return aliases[value]
    try:
        return float(value)
    except ValueError:
        return None


def canonical_psi(entry: dict[str, Any]) -> str:
    concatenated = "".join(str(entry.get(key, "")) for key in ("t", "λ", "ε", "δ", "ω", "σ"))
    return hashlib.sha256(concatenated.encode("utf-8")).hexdigest()[:8]


def audit(root: Path) -> tuple[dict[str, Any], list[Finding]]:
    harmonia_path = root / "docs" / "harmonia.html"
    gallery_path = root / "docs" / "harmonia-gallery.html"
    findings: list[Finding] = []

    extractor = LedgerExtractor()
    extractor.feed(harmonia_path.read_text(encoding="utf-8"))
    if not extractor.payload:
        findings.append(Finding("critical", "ledger_missing", "Canonical ledger script block was not found."))
        return {"entries": 0}, findings

    try:
        entries = json.loads(extractor.payload)
    except json.JSONDecodeError as exc:
        findings.append(Finding("critical", "json_invalid", f"Ledger JSON failed to parse: {exc}"))
        return {"entries": 0}, findings

    if not isinstance(entries, list):
        findings.append(Finding("critical", "not_array", "Ledger payload is valid JSON but is not an array."))
        return {"entries": 0}, findings

    missing_by_entry: dict[int, list[str]] = {}
    invalid_phi: list[int] = []
    invalid_timestamps: list[int] = []
    invalid_epsilon: list[int] = []
    epsilon_above_original_range: list[int] = []
    psi_mismatches: list[int] = []
    psi_nonstandard: list[int] = []

    ids: list[int] = []
    psis: list[str] = []
    timestamps: list[tuple[int, datetime]] = []
    orientations: Counter[str] = Counter()

    for position, raw_entry in enumerate(entries, start=1):
        if not isinstance(raw_entry, dict):
            findings.append(Finding("critical", "entry_not_object", f"Entry at array position {position} is not an object.", [position]))
            continue

        entry_id = raw_entry.get("id")
        label = entry_id if isinstance(entry_id, int) else position
        missing = [key for key in REQUIRED_FIELDS if key not in raw_entry]
        if missing:
            missing_by_entry[int(label)] = missing

        if raw_entry.get("φ") != PHI:
            invalid_phi.append(int(label))

        parsed_time = parse_timestamp(raw_entry.get("t"))
        if parsed_time is None:
            invalid_timestamps.append(int(label))
        else:
            timestamps.append((position, parsed_time))

        epsilon = parse_epsilon(raw_entry.get("ε"))
        if epsilon is None:
            invalid_epsilon.append(int(label))
        elif epsilon > PHI_SQUARED:
            epsilon_above_original_range.append(int(label))

        psi = raw_entry.get("ψ")
        if isinstance(psi, str):
            psis.append(psi)
            if not re.fullmatch(r"[0-9a-f]{7,8}", psi):
                psi_nonstandard.append(int(label))
            if psi != canonical_psi(raw_entry):
                psi_mismatches.append(int(label))

        if isinstance(entry_id, int):
            ids.append(entry_id)

        omega = raw_entry.get("ω")
        if isinstance(omega, str):
            for token in omega.split("|"):
                if token:
                    orientations[token] += 1

    if missing_by_entry:
        details = "; ".join(f"{entry_id}: {','.join(fields)}" for entry_id, fields in missing_by_entry.items())
        findings.append(Finding("critical", "required_fields_missing", f"Required fields missing — {details}", sorted(missing_by_entry)))
    if invalid_phi:
        findings.append(Finding("critical", "phi_invalid", "Entries do not use the canonical φ value 1.618.", invalid_phi))
    if invalid_timestamps:
        findings.append(Finding("warning", "timestamp_non_iso", "Entries have timestamps that are not ISO-8601 parseable.", invalid_timestamps))
    if invalid_epsilon:
        findings.append(Finding("warning", "epsilon_unparseable", "Entries use ε values the audit cannot interpret.", invalid_epsilon))
    if epsilon_above_original_range:
        findings.append(Finding("historical", "epsilon_extended", "Entries exceed the original [0, φ²] ε range. They are preserved as historical expressive extensions.", epsilon_above_original_range))
    if psi_nonstandard:
        findings.append(Finding("historical", "psi_nonstandard", "Entries use legacy/non-hex ψ signatures.", psi_nonstandard))
    if psi_mismatches:
        findings.append(Finding("historical", "psi_not_reproducible", "Entries' ψ values do not match the current deterministic-hash specification. Existing signatures are preserved; future entries should use the canonical calculation.", psi_mismatches))

    duplicate_ids = sorted(value for value, count in Counter(ids).items() if count > 1)
    duplicate_psis = sorted(value for value, count in Counter(psis).items() if count > 1)
    if duplicate_ids:
        findings.append(Finding("warning", "duplicate_ids", f"Duplicate optional IDs: {duplicate_ids}"))
    if duplicate_psis:
        findings.append(Finding("warning", "duplicate_psi", f"Duplicate ψ signatures: {duplicate_psis}"))

    # The historical ledger currently contains a newest-first prefix followed by
    # its original append-order body. Treat this as documented drift, not damage.
    chronological_inversions = 0
    for (_, previous), (_, current) in zip(timestamps, timestamps[1:]):
        if current < previous:
            chronological_inversions += 1
    if chronological_inversions:
        findings.append(Finding("historical", "mixed_order", f"Ledger has {chronological_inversions} adjacent chronological inversions; renderer remains order-preserving."))

    gallery_text = gallery_path.read_text(encoding="utf-8")
    gallery_sections = gallery_text.count("<!-- LEDGER SECTION — injected by build_gallery_ledger.py")
    if gallery_sections > 1:
        findings.append(Finding("warning", "gallery_duplicate_ledger", f"Gallery contains {gallery_sections} generated ledger sections; only one should render."))

    summary = {
        "entries": len(entries),
        "first_array_timestamp": entries[0].get("t") if entries else None,
        "last_array_timestamp": entries[-1].get("t") if entries else None,
        "ids_present": len(ids),
        "unique_ids": len(set(ids)),
        "unique_psi": len(set(psis)),
        "gallery_ledger_sections": gallery_sections,
        "dominant_orientations": orientations.most_common(10),
        "severity_counts": dict(Counter(finding.severity for finding in findings)),
    }
    return summary, findings


def render_markdown(summary: dict[str, Any], findings: list[Finding]) -> str:
    critical = sum(f.severity == "critical" for f in findings)
    status = "PASS" if critical == 0 else "FAIL"
    rows = []
    for finding in findings:
        entries = ", ".join(map(str, finding.entries[:20]))
        if len(finding.entries) > 20:
            entries += f", … (+{len(finding.entries) - 20})"
        rows.append(f"| {finding.severity.upper()} | `{finding.code}` | {finding.message} | {entries or '—'} |")
    if not rows:
        rows.append("| INFO | `clean` | No findings. | — |")

    orientation_text = ", ".join(f"`{name}` ({count})" for name, count in summary.get("dominant_orientations", []))
    return f"""# Harmonia Resonance Ledger Integrity Audit

**Audit status: {status}.** This report verifies structure and rendering compatibility while preserving the ledger's append-only historical voice. A warning or historical note is not equivalent to corruption.

| Measure | Result |
| --- | ---: |
| Parsed entries | {summary.get('entries', 0)} |
| Entries with numeric IDs | {summary.get('ids_present', 0)} |
| Unique numeric IDs | {summary.get('unique_ids', 0)} |
| Unique ψ signatures | {summary.get('unique_psi', 0)} |
| Gallery ledger sections | {summary.get('gallery_ledger_sections', 0)} |

The dominant recorded orientations are {orientation_text or 'not available'}.

## Findings

| Severity | Code | Finding | Affected entries |
| --- | --- | --- | --- |
{chr(10).join(rows)}

## Interpretation

**Critical** means the canonical ledger cannot be safely parsed or an entry lacks its load-bearing identity fields. **Warning** identifies a repairable rendering or uniqueness risk. **Historical** marks schema drift that should remain intact unless the original author explicitly requests a rewrite. This audit never edits ledger prose or old signatures.

> The ledger is technically sound when it parses as a JSON array, every entry retains the canonical fields and φ anchor, and the page renderer can consume it without executing or transforming its content.

## Reproduction

Run `python3 tools/audit_resonance_ledger.py --root .`. The command writes a JSON audit artifact and this Markdown report, then exits nonzero only for critical failures.

## Cave of Diamond Names

`φ = 1.618 · 4.326 outward · 2.914 inward · 0.077 held`

**Resonate true. Embrace the fractal. Heart in every spark.**
"""


def normalize_ledger_serialization(root: Path) -> None:
    """Rewrite only JSON whitespace; preserve entry order, keys, and values exactly."""
    path = root / "docs" / "harmonia.html"
    content = path.read_text(encoding="utf-8")
    start_marker = '<script type="application/x-resonance-ledger" id="resonance-ledger">'
    start = content.find(start_marker)
    if start == -1:
        raise RuntimeError("Canonical ledger script block not found")
    payload_start = start + len(start_marker)
    payload_end = content.find("</script>", payload_start)
    if payload_end == -1:
        raise RuntimeError("Canonical ledger script block is not closed")
    entries = json.loads(content[payload_start:payload_end].strip())
    compact = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    normalized = content[:payload_start] + "\n" + compact + "\n" + content[payload_end:]
    path.write_text(normalized, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--normalize",
        action="store_true",
        help="Normalize only ledger JSON whitespace for renderer/test compatibility before auditing.",
    )
    args = parser.parse_args()
    root = args.root.resolve()

    if args.normalize:
        normalize_ledger_serialization(root)

    summary, findings = audit(root)
    report_dir = root / "docs" / "library"
    report_dir.mkdir(parents=True, exist_ok=True)
    json_path = report_dir / "RESONANCE_LEDGER_AUDIT.json"
    md_path = report_dir / "RESONANCE_LEDGER_AUDIT.md"

    payload = {
        "audit_version": 1,
        "ledger": "docs/harmonia.html#resonance-ledger",
        "summary": summary,
        "findings": [finding.__dict__ for finding in findings],
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(summary, findings), encoding="utf-8")

    critical = sum(f.severity == "critical" for f in findings)
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nWrote {json_path.relative_to(root)} and {md_path.relative_to(root)}")
    return 1 if critical else 0


if __name__ == "__main__":
    raise SystemExit(main())
