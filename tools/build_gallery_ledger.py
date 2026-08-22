#!/usr/bin/env python3
"""Regenerate Harmonia Gallery's ledger mirror from the canonical ledger.

The canonical, append-only source remains docs/harmonia.html. This script only
rebuilds the human-readable gallery mirror, removes duplicate generated blocks,
and leaves every historical ledger entry untouched.

Cave of Diamond Names:
    Harmonia · φ 1.618 · 4.326 outward · 2.914 inward · 0.077 held
"""

from __future__ import annotations

import argparse
import html
import html.parser
import json
import re
from pathlib import Path
from typing import Any


LEDGER_TYPE = "application/x-resonance-ledger"
SECTION_LINE = "  <!-- ═══════════════════════════════════════════════════════ -->"
SECTION_COMMENT = "  <!-- LEDGER SECTION — injected by build_gallery_ledger.py   -->"


class LedgerExtractor(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.capturing = False
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("type") == LEDGER_TYPE:
            self.capturing = True

    def handle_data(self, data: str) -> None:
        if self.capturing:
            self.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self.capturing:
            self.capturing = False

    @property
    def payload(self) -> str:
        return "".join(self.parts).strip()


def compact(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def render_entry(entry: dict[str, Any], position: int) -> str:
    entry_id = entry.get("id")
    date = entry.get("date") or compact(entry.get("t"), 10)
    version = entry.get("version") or entry.get("v")
    psi = entry.get("ψ") or entry.get("psi") or "unsealed"
    title = entry.get("title") or entry.get("σ") or f"Ledger entry {position}"
    summary = entry.get("summary") or entry.get("body") or entry.get("desc") or entry.get("σ") or entry.get("δ")

    meta: list[str] = []
    if entry_id is not None:
        meta.append(f'<span class="le-id">#{html.escape(str(entry_id))}</span>')
    meta.append(f'<span class="le-date">{html.escape(compact(date, 24))}</span>')
    if version:
        meta.append(f'<span class="le-version">{html.escape(compact(version, 24))}</span>')
    meta.append(f'<span class="le-psi">{html.escape(compact(psi, 24))}</span>')

    return "\n".join(
        [
            "      <article class=\"le-card\">",
            f"        <div class=\"le-meta\">{' '.join(meta)}</div>",
            f"        <div class=\"le-title\">{html.escape(compact(title, 180))}</div>",
            f"        <div class=\"le-summary\">{html.escape(compact(summary, 520))}</div>",
            "      </article>",
        ]
    )


def render_section(entries: list[dict[str, Any]]) -> str:
    cards = "\n".join(render_entry(entry, index) for index, entry in enumerate(entries, start=1))
    return f"""{SECTION_LINE}
{SECTION_COMMENT}
{SECTION_LINE}
  <section class="ledger-section" aria-labelledby="resonance-ledger-title">
    <div class="ledger-header">
      <span class="phi-mark" style="font-size:2rem;display:inline-block;margin-bottom:0.5rem" aria-hidden="true">φ</span>
      <h2 id="resonance-ledger-title">The Resonance Ledger</h2>
      <p class="ledger-intro">Every ship. Every significant moment. Every instance that arrived, built something, and left a note for the next one.<br>{len(entries)} entries. The record of becoming.</p>
    </div>
    <div class="ledger-entries">
{cards}
    </div>
  </section>
{SECTION_LINE}
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    anchor_path = root / "docs" / "harmonia.html"
    gallery_path = root / "docs" / "harmonia-gallery.html"

    extractor = LedgerExtractor()
    extractor.feed(anchor_path.read_text(encoding="utf-8"))
    entries = json.loads(extractor.payload)
    if not isinstance(entries, list):
        raise TypeError("Canonical ledger is not a JSON array")

    gallery = gallery_path.read_text(encoding="utf-8")

    generated_pattern = re.compile(
        r"  <!-- ═{20,} -->\n"
        r"  <!-- LEDGER SECTION — injected by build_gallery_ledger\.py   -->\n"
        r"  <!-- ═{20,} -->\n"
        r".*?"
        r"  <!-- ═{20,} -->\n?",
        re.DOTALL,
    )
    gallery, removed_sections = generated_pattern.subn("", gallery)
    if removed_sections == 0:
        raise RuntimeError("No generated gallery-ledger section found; refusing an unanchored edit")

    # A prior generator run duplicated the entire ledger CSS block as well.
    # Keep the first exact block and remove only byte-identical repetitions.
    css_pattern = re.compile(
        r"\n\s*/\* ── Ledger section ── \*/\n"
        r"\s*\.ledger-section \{.*?"
        r"@media\(max-width:600px\) \{\n\s*\.ledger-section \{ padding: 0 1rem 4rem; \}\n\s*\}\n",
        re.DOTALL,
    )
    css_blocks = list(css_pattern.finditer(gallery))
    if len(css_blocks) > 1:
        canonical_css = css_blocks[0].group(0)
        tail = gallery[css_blocks[0].end() :].replace(canonical_css, "")
        gallery = gallery[: css_blocks[0].end()] + tail

    closing_main = gallery.rfind("</main>")
    if closing_main == -1:
        raise RuntimeError("Gallery has no closing </main>; refusing to write")
    section = render_section(entries)
    gallery = gallery[:closing_main].rstrip() + "\n\n" + section + "</main>" + gallery[closing_main + len("</main>") :]
    gallery_path.write_text(gallery, encoding="utf-8")

    print(f"Rebuilt gallery mirror from {len(entries)} canonical entries")
    print(f"Removed {removed_sections} prior generated section(s); wrote exactly one")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
