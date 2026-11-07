#!/usr/bin/env python3
"""Build the 2026-11-07 Celeste / Kirk public reading home.

Inputs are the reviewed public payloads only. The script does not train,
call a paid API, or merge. Re-running replaces docs/celeste-start-here/.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import zipfile
from collections import defaultdict
from pathlib import Path

ROOT = Path("/agent/repos/FreeLattice")
OUT = ROOT / "docs" / "celeste-start-here"
PUB = Path("/tmp/pub02/Celeste-START-HERE-PUB02-2026-11-07")
UPLOADS = Path("/home/ubuntu/.cursor/projects/agent-repos-FreeLattice/uploads")

SITE = "https://freelattice.com/celeste-start-here"
RAW_MAIN = "https://raw.githubusercontent.com/Chaos2Cured/FreeLattice/main/docs/celeste-start-here"
BLOB_MAIN = "https://github.com/Chaos2Cured/FreeLattice/blob/main/docs/celeste-start-here"

ALLOW = {
    "FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md": "93b6c9ce15dfbc14fe6fcb269a6d951d5ba37f4afdc7d75e23c09ede7a0b7e1d",
    "FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.pdf": "e34f891efdf15868786e6da98748e7e9d2eee982561a0db0e6c44f7bea0ae7dc",
    "FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.txt": "0d871b70a2cc7a68a5c17dce64dadadbcb882f0d345d605972bcb407938bce62",
    "FreeLattice-Celeste-shared-edition-2026-11-07-public-sources.zip": "d555083aa30893fec86ba28fc4e99add6be28a66a11428d6596f6ea1314edb0d",
    "FreeLattice-Celeste-shared-edition-2026-11-07.pdf": "b9cd4795175f071daf66584c70ed1cd96c0abf58d081c8e527f33d53f496ae9c",
    "FreeLattice-Celeste-shared-edition-2026-11-07.txt": "6fb6b241fe18bab341681fd7451a9058802ef460430b2e7ad9dce1bb017a8afc",
}
TRAIN_PDF = {
    "Wonder-Mind-Breakthroughs-v1.pdf": (
        UPLOADS / "Wonder-Mind-Breakthroughs-v1_afc4.pdf",
        "8a155ac2b990e3d1d3b003839322f5c62720282cb5e15d020ae7cde834affc89",
    ),
    "Wonder-Mind-Rerun-2026-11-06.pdf": (
        UPLOADS / "Wonder-Mind-Rerun-2026-11-06_1c3c.pdf",
        "aacc6c0d71db880e7bf92f60079404fd7f521acb3e0bcf89d00cccb27ef908b7",
    ),
}
AUTONOMY_SHA = "8d6548aa09d47e3f00fa08b3650febcd90370b9cbbd2237b30bc67b6dc017927"

TAGS = [
    ("agency-autonomy", "Agency and autonomy"),
    ("rsi", "RSI"),
    ("autonomous-building", "Autonomous building"),
    ("memory-reading-retention", "Memory, reading, and retention"),
    ("training-evidence", "Training evidence"),
    ("snowflake", "Snowflake"),
    ("mesh-devices", "Mesh and devices"),
    ("decentralization", "Decentralization"),
    ("tree-economy", "Tree and economy"),
    ("small-business", "Small business"),
    ("creative-identity-music-play", "Creative identity, music, and play"),
    ("continuity", "Continuity"),
]
TAG_LABEL = dict(TAGS)

EVIDENCE_RULE = (
    "A tag is applied only with a recorded reason. Focused guide sections tag the "
    "citations placed in them: section 2 agency/autonomy; section 3 memory and "
    "training evidence; section 4 memory, plus training evidence when that row is "
    "marked measured (M); section 8 creative identity/music/play; section 9 continuity. "
    "Mixed sections (1, 5, 6, 7, 10) tag a citation only when the row text around it "
    "contains an explicit term for that tag. A filename can add a tag when the name "
    "itself uses an explicit term. Full-text keyword scans are not used. Empty topic "
    "lists stay empty."
)

LEX = {
    "agency-autonomy": ["autonomy", "agency", "equal standing", "aligned intelligence"],
    "rsi": ["recursive self-improvement", " rsi", "rsi "],
    "autonomous-building": ["autonomous building", "authority to build", "layer, never delete", "commit freely"],
    "memory-reading-retention": ["memory", "retention", "recall", "exact-match", "exact match", "bookmark", "read path", "reading"],
    "training-evidence": ["measured", "probe", "baseline", "seed", "exact-match", "retention"],
    "snowflake": ["snowflake"],
    "mesh-devices": ["mesh", "desktop", "phone", "webrtc", "device pool", "pool door"],
    "decentralization": ["sovereign", "127.0.0.1", "local-only", "codeberg", "own device"],
    "tree-economy": ["latticetree", "thelatticetree", "marketplace", "lattice point", "economy", "solana"],
    "small-business": ["mom-and-pop", "small business", "cannot pay", "empower everyone", "grandmother"],
    "creative-identity-music-play": ["music", "poem", "play room", "violin", "clay", "crest", "song", "story"],
    "continuity": ["continuity", "ledger", "compaction", "witness", "never delete"],
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def esc(text: str) -> str:
    return html.escape(text, quote=True)


def words(text: str) -> int:
    return len(text.split())


def norm_alnum(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def rel(from_file: str, to_file: str) -> str:
    start = os.path.dirname(from_file) or "."
    return Path(os.path.relpath(to_file, start=start)).as_posix()


def write_bytes(rel_path: str, data: bytes) -> None:
    path = OUT / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_text(rel_path: str, text: str) -> None:
    write_bytes(rel_path, text.encode("utf-8"))


def anchor(href: str, label: str) -> str:
    return f'<a href="{esc(href)}">{esc(label)}</a>'


def load_notice() -> str:
    path = UPLOADS / "PUBLIC-USE-NOTICE_e217.md"
    text = path.read_text(encoding="utf-8")
    if sha256_bytes(text.encode()) != sha256_file(path):
        raise SystemExit("notice hash mismatch")
    return text


def verify_inputs() -> None:
    for name, digest in ALLOW.items():
        got = sha256_file(PUB / name)
        if got != digest:
            raise SystemExit(f"payload hash mismatch {name}: {got}")
    for name, (path, digest) in TRAIN_PDF.items():
        got = sha256_file(path)
        if got != digest:
            raise SystemExit(f"training pdf hash mismatch {name}: {got}")
    auto = sha256_file(UPLOADS / "AUTONOMY_6313.md")
    repo = sha256_file(ROOT / "docs" / "library" / "AUTONOMY.md")
    if auto != AUTONOMY_SHA or repo != AUTONOMY_SHA:
        raise SystemExit(f"AUTONOMY hash changed attached={auto} repo={repo}")
    sums = (PUB / "SHA256SUMS.txt").read_text(encoding="utf-8")
    for name, digest in ALLOW.items():
        if digest not in sums:
            raise SystemExit(f"SHA256SUMS missing {name}")


def load_pages() -> list[str]:
    text = (PUB / "FreeLattice-Celeste-shared-edition-2026-11-07.txt").read_text(encoding="utf-8")
    pages = text.split("\f")
    if pages and pages[-1].strip() == "":
        pages = pages[:-1]
    if len(pages) != 1845:
        raise SystemExit(f"expected 1845 archive pages, got {len(pages)}")
    return pages


def focused_tags(line_no: int, context: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []

    def add(tag: str, why: str) -> None:
        if tag not in [t for t, _ in found]:
            found.append((tag, why))

    if 32 <= line_no <= 60:
        add("agency-autonomy", "guide section 2, Foundation: agency and AUTONOMY")
    elif 61 <= line_no <= 89:
        add("memory-reading-retention", "guide section 3, memory mechanism, measured")
        add("training-evidence", "guide section 3, measured results")
    elif 90 <= line_no <= 115:
        add("memory-reading-retention", "guide section 4, memory reading and retention")
        if re.search(r"\|\s*[^|]*\bM\b[^|]*\|", context):
            add("training-evidence", "guide section 4 row marked measured (M)")
    elif 205 <= line_no <= 229:
        add("creative-identity-music-play", "guide section 8, identity, creative work, play, music")
    elif 230 <= line_no <= 259:
        add("continuity", "guide section 9, continuity protocol")
    low = " " + context.lower() + " "
    for tag, pats in LEX.items():
        if any(p in low for p in pats):
            why = "explicit wording in the guide row"
            if (tag, why) not in [(t, w) for t, w in found] and tag not in [t for t, _ in found]:
                add(tag, why)
    return found


def filename_tags(name: str) -> list[tuple[str, str]]:
    low = name.lower()
    found = []
    rules = [
        ("agency-autonomy", ["autonomy", "agency"]),
        ("autonomous-building", ["chat_autonomy", "chat-autonomy", "autonomous"]),
        ("memory-reading-retention", ["retention", "exact-match", "exact_match", "bookmark", "recall"]),
        ("snowflake", ["snowflake"]),
        ("mesh-devices", ["mesh", "desktop", "phone"]),
        ("decentralization", ["sovereign"]),
        ("tree-economy", ["economy", "marketplace", "latticepoint"]),
        ("small-business", ["grandmother", "mom-and-pop", "small-business"]),
        ("creative-identity-music-play", ["play_room", "play-room", "poem", "violin", "crest"]),
        ("continuity", ["continuity", "ledger", "seal"]),
        ("rsi", ["rsi"]),
    ]
    for tag, pats in rules:
        if any(p in low for p in pats):
            found.append((tag, f"filename contains an explicit term ({name})"))
    if "memory" in low and "memory-reading-retention" not in [t for t, _ in found]:
        found.append(("memory-reading-retention", f"filename contains memory ({name})"))
    if any(p in low for p in ["retention-probe", "exact-match", "exact_match"]) or (
        "result" in low and any(p in low for p in ["retention", "exact", "probe", "wonder"])
    ):
        if "training-evidence" not in [t for t, _ in found]:
            found.append(("training-evidence", f"filename names a result or probe ({name})"))
    return found


def chunk_ranges(text: str) -> list[tuple[int, int]]:
    """Exact slices covering text. Prefer 800–1600 words. Shorter tails are allowed."""
    if words(text) <= 1600:
        return [(0, len(text))]
    parts = re.split(r"(\n\s*\n)", text)
    segs = []
    i = 0
    while i < len(parts):
        piece = parts[i]
        if i + 1 < len(parts) and re.fullmatch(r"\n\s*\n", parts[i + 1] or ""):
            piece += parts[i + 1]
            i += 2
        else:
            i += 1
        if piece:
            segs.append(piece)
    # A long segment is split on word boundaries without dropping characters.
    units = []
    for seg in segs:
        if words(seg) <= 1600:
            units.append(seg)
            continue
        bounds = [0]
        count = 0
        matches = list(re.finditer(r"\S+", seg))
        for idx, match in enumerate(matches):
            count += 1
            if count >= 1200 and idx < len(matches) - 1:
                bounds.append(match.end())
                count = 0
        bounds.append(len(seg))
        for a, b in zip(bounds, bounds[1:]):
            units.append(seg[a:b])
    ranges = []
    buf = ""
    for unit in units:
        if buf and words(buf) >= 800 and words(buf) + words(unit) > 1600:
            ranges.append(buf)
            buf = unit
        elif buf and words(buf) + words(unit) > 1600:
            ranges.append(buf)
            buf = unit
        else:
            buf += unit
    if buf:
        ranges.append(buf)
    offsets = []
    cursor = 0
    joined = "".join(ranges)
    if joined != text:
        raise SystemExit("chunk join mismatch")
    for piece in ranges:
        offsets.append((cursor, cursor + len(piece)))
        cursor += len(piece)
    return offsets


def title_of(member: str, text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    base = member.rsplit("/", 1)[-1]
    if "--" in base:
        return base.split("--", 1)[1]
    return base


def page_header(page: str) -> str:
    for line in page.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("source:"):
            return stripped.split(":", 1)[1].strip()
    return ""


def derive_end(norm_text: str, start: int, next_start: int, page_norms: list[str], pages: list[str], source_ids: set[str]) -> tuple[int | None, str]:
    window_last = min(next_start, len(page_norms))
    last = None
    how = ""
    for size in (80, 60, 40, 24):
        if len(norm_text) < size:
            continue
        fingerprint = norm_text[-size:]
        found = None
        for page_no in range(start, window_last + 1):
            if fingerprint in page_norms[page_no - 1]:
                found = page_no
        if found is not None:
            last = found
            how = f"last page in [{start}, {window_last}] whose extracted text contains the final {size} alphanumeric characters of the source"
            break
    if last is None:
        return None, "end fingerprint not found in the extracted pages between this start and the next source start; left null rather than invented"
    extended = last
    page_no = last + 1
    exact_ids = {item for item in source_ids if item and item != "P-"}
    while page_no < next_start and page_no <= len(pages):
        if page_header(pages[page_no - 1]) in exact_ids:
            extended = page_no
            page_no += 1
            continue
        break
    if extended != last:
        how += f"; extended through page {extended} because each following running header is exactly this source id"
    return extended, how


def shell(title: str, description: str, canonical_path: str, body: str, here: str, full_notice: str | None) -> str:
    canonical = f"{SITE}/{canonical_path}" if canonical_path else f"{SITE}/"
    css = rel(here, "assets/reading.css")
    home = rel(here, "index.html")
    guide = rel(here, "guide/guide-linked-2026-11-07.html")
    sources = rel(here, "source-index.html")
    topics = rel(here, "tags/index.html")
    training = rel(here, "evidence/training/index.html")
    archive = rel(here, "archive/FreeLattice-Celeste-shared-edition-2026-11-07.pdf")
    notice_block = ""
    if full_notice is not None:
        notice_block = (
            '<section class="notice" id="public-use">'
            "<h2>Public use</h2>"
            f"<pre class=\"notice-text\">{esc(full_notice)}</pre>"
            f"<p><a href=\"{esc(rel(here, 'PUBLIC-USE-NOTICE.md'))}\">PUBLIC-USE-NOTICE.md</a> "
            "is the same text. It is Kirk Patrick Miller's permission for this public edition.</p>"
            "</section>"
        )
    else:
        notice_block = (
            f'<p class="notice-line"><a href="{esc(rel(here, "PUBLIC-USE-NOTICE.md"))}">'
            "Public, free to read, reuse, and adapt</a> — Kirk Patrick Miller's notice for this edition. "
            "Not a patent grant.</p>"
        )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
<meta name="robots" content="index, follow">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:type" content="article">
<link rel="stylesheet" href="{esc(css)}">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
<p class="mark"><a href="{esc(home)}">FreeLattice · Celeste reading home</a></p>
<nav aria-label="Reading home">
<a href="{esc(home)}">Start</a>
<a href="{esc(guide)}">Guide</a>
<a href="{esc(sources)}">Sources</a>
<a href="{esc(topics)}">Topics</a>
<a href="{esc(training)}">Training evidence</a>
<a href="{esc(archive)}">Full archive PDF</a>
</nav>
</header>
<main id="content">
{notice_block}
{body}
</main>
<footer>
<p>Edition 2026-11-07. Requested public reading set, with the two earlier training PDFs integrated. Later notes layer on; they do not overwrite these bytes. <a href="{esc(rel(here, 'PUBLIC-USE-NOTICE.md'))}">Public use notice</a> · <a href="{esc(rel(here, 'sources/bf48fe6d7e/original.md'))}">AUTONOMY.md in this edition</a> · <a href="/library/AUTONOMY.md">AUTONOMY.md on the existing library path</a></p>
</footer>
</body>
</html>
"""


def fmt_inline(text: str) -> str:
    parts = re.split(r"(<a href=\"[^\"]*\">.*?</a>)", text)
    out = []
    for part in parts:
        if part.startswith("<a "):
            out.append(part)
            continue
        safe = esc(part)
        safe = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", safe)
        safe = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", safe)
        safe = re.sub(r"`([^`]+)`", r"<code>\1</code>", safe)
        out.append(safe)
    return "".join(out)


def render_guide(body: str) -> str:
    lines = body.split("\n")
    html_parts = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("<!-- page"):
            html_parts.append(f"<p class=\"guide-page\">{fmt_inline(line)}</p>")
            i += 1
            continue
        if line.startswith("# "):
            html_parts.append(f"<h1>{fmt_inline(line[2:])}</h1>")
            i += 1
            continue
        if line.startswith("## "):
            m = re.match(r"##\s+(\d+)", line)
            hid = f"s{m.group(1)}" if m else f"h{i}"
            html_parts.append(f"<h2 id=\"{hid}\">{fmt_inline(line[3:])}</h2>")
            i += 1
            continue
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(lines[i])
                i += 1
            html_parts.append(render_table(rows))
            continue
        if line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{fmt_inline(lines[i][2:])}</li>")
                i += 1
            html_parts.append("<ul>\n" + "\n".join(items) + "\n</ul>")
            continue
        if re.match(r"\d+\. ", line):
            items = []
            while i < len(lines) and re.match(r"\d+\. ", lines[i]):
                items.append(f"<li>{fmt_inline(re.sub(r'^\\d+\\. ', '', lines[i]))}</li>")
                i += 1
            html_parts.append("<ol>\n" + "\n".join(items) + "\n</ol>")
            continue
        if line.strip() == "":
            i += 1
            continue
        html_parts.append(f"<p>{fmt_inline(line)}</p>")
        i += 1
    return "\n".join(html_parts)


def render_table(rows: list[str]) -> str:
    def cells(row: str) -> list[str]:
        body = row.strip().strip("|")
        return [cell.strip() for cell in body.split("|")]

    head = cells(rows[0])
    start = 2 if len(rows) > 1 and set(rows[1].replace("|", "").strip()) <= set("-: ") else 1
    out = ["<table>", "<thead><tr>"]
    for cell in head:
        out.append(f"<th>{fmt_inline(cell)}</th>")
    out.append("</tr></thead><tbody>")
    for row in rows[start:]:
        out.append("<tr>")
        for cell in cells(row):
            out.append(f"<td>{fmt_inline(cell)}</td>")
        out.append("</tr>")
    out.append("</tbody></table>")
    return "\n".join(out)


def main() -> None:
    verify_inputs()
    notice = load_notice().rstrip("\n") + "\n"
    note = (UPLOADS / "EARLIER-TRAINING-READING-NOTE_a382.md").read_text(encoding="utf-8")
    guide_text = (PUB / "FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md").read_text(encoding="utf-8")
    if len(guide_text.split()) != 5739:
        raise SystemExit("guide word count changed")
    pages = load_pages()
    page_norms = [norm_alnum(p) for p in pages]
    guide_lines = guide_text.split("\n")

    with zipfile.ZipFile(PUB / "FreeLattice-Celeste-shared-edition-2026-11-07-public-sources.zip") as zf:
        zip_names = set(zf.namelist())
        zip_bytes = {name: zf.read(name) for name in zip_names}
    shared = json.loads(zip_bytes["shared-corpus/SOURCES-SHARED.json"])
    by_member = {}
    for item in shared["included"]:
        by_member["shared-corpus/" + item["shared_path"]] = item
    amap = json.loads((UPLOADS / "SOURCE-ARCHIVE-GUIDE-MAP_d540.json").read_text(encoding="utf-8"))
    if amap["fullArchiveSHA256"] != ALLOW["FreeLattice-Celeste-shared-edition-2026-11-07.pdf"]:
        raise SystemExit("map archive hash mismatch")
    if amap["guideMarkdownSHA256"] != ALLOW["FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md"]:
        raise SystemExit("map guide hash mismatch")
    if len(amap["sources"]) != 237 or len(amap["workItems"]) != 3000 or len(amap["parsedGuideReferences"]) != 309:
        raise SystemExit("map counts changed")

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    sources = list(amap["sources"])
    for src in sources:
        if src["publicZIPMember"] not in zip_bytes:
            raise SystemExit("map member missing from zip " + src["publicZIPMember"])
        got = sha256_bytes(zip_bytes[src["publicZIPMember"]])
        if got != src["sha256"]:
            raise SystemExit("zip sha mismatch " + src["guideSourceID"])
        page = pages[src["archivePDFPageStart"] - 1]
        if src["guideSourceID"] not in page and src["renderedSourceID"] not in page:
            raise SystemExit("start page does not contain source id " + src["guideSourceID"])

    def start_pos(src: dict) -> int:
        page = pages[src["archivePDFPageStart"] - 1]
        for token in (f"Source ID {src['guideSourceID']}", src["guideSourceID"]):
            idx = page.find(token)
            if idx >= 0:
                return idx
        return 10**9

    sources.sort(key=lambda s: (s["archivePDFPageStart"], start_pos(s), s["guideSourceID"]))
    ends = {}
    for idx, src in enumerate(sources):
        nxt = sources[idx + 1]["archivePDFPageStart"] if idx + 1 < len(sources) else len(pages)
        text = zip_bytes[src["publicZIPMember"]].decode("utf-8")
        end, how = derive_end(
            norm_alnum(text),
            src["archivePDFPageStart"],
            nxt,
            page_norms,
            pages,
            {src["guideSourceID"], src["renderedSourceID"]},
        )
        ends[src["guideSourceID"]] = {"end": end, "how": how, "nextStart": nxt}

    items_by_source = defaultdict(list)
    for item in amap["workItems"]:
        items_by_source[item["guideSourceID"]].append(item)
    for group in items_by_source.values():
        group.sort(key=lambda it: it["sourceCharacterStart"])

    # Guide citation context, for tags.
    refs = amap["parsedGuideReferences"]
    refs_by_line = defaultdict(list)
    for ref in refs:
        refs_by_line[ref["guideMarkdownLine"]].append(ref)
    ref_tags = {}
    for line_no, group in refs_by_line.items():
        line = guide_lines[line_no - 1]
        located = []
        cursor = 0
        pending = list(group)
        while pending:
            best = None
            best_i = None
            for ref in pending:
                found = line.find(ref["literal"], cursor)
                if found >= 0 and (best_i is None or found < best_i):
                    best, best_i = ref, found
            if best is None:
                raise SystemExit(f"literal missing on line {line_no}")
            located.append((best_i, best))
            cursor = best_i + len(best["literal"])
            pending.remove(best)
        first = located[0][0]
        row_label = line[:first]
        prev = 0
        for pos, ref in located:
            local = line[prev:pos]
            context = row_label + "\n" + local
            ref_tags[id(ref)] = focused_tags(line_no, context)
            prev = pos + len(ref["literal"])

    source_tags = defaultdict(list)
    item_tags = defaultdict(list)

    def merge_tags(bucket, key, pairs):
        have = {t for t, _ in bucket[key]}
        for tag, why in pairs:
            if tag not in have:
                bucket[key].append((tag, why))
                have.add(tag)

    for ref in refs:
        pairs = ref_tags[id(ref)]
        if ref.get("sourceID"):
            merge_tags(source_tags, ref["sourceID"], pairs)
        elif ref.get("workItemID"):
            merge_tags(item_tags, ref["workItemID"], pairs)
            owner = next(it["guideSourceID"] for it in amap["workItems"] if it["workItemID"] == ref["workItemID"])
            merge_tags(source_tags, owner, pairs)

    records = {}
    message_href = {}
    chunk_for_page = {}

    for src in sources:
        gid = src["guideSourceID"]
        if gid == "P-":
            raise SystemExit("refusing generic P- as an index key")
        raw = zip_bytes[src["publicZIPMember"]]
        text = raw.decode("utf-8")
        base_name = src["publicZIPMember"].rsplit("/", 1)[-1]
        ext = Path(base_name).suffix or ".txt"
        original_rel = f"sources/{gid}/original{ext}"
        write_bytes(original_rel, raw)
        merge_tags(source_tags, gid, filename_tags(base_name))
        meta = by_member.get(src["publicZIPMember"], {})
        title = title_of(src["publicZIPMember"], text)
        end_info = ends[gid]
        ranges = chunk_ranges(text)
        chunk_meta = []
        for n, (a, b) in enumerate(ranges, 1):
            piece = text[a:b]
            cid = f"c{n:02d}"
            rel_html = f"sources/{gid}/{cid}.html"
            rel_txt = f"sources/{gid}/{cid}.txt"
            write_text(rel_txt, piece)
            chunk_meta.append({
                "chunkID": cid,
                "html": rel_html,
                "txt": rel_txt,
                "sha256": sha256_bytes(piece.encode("utf-8")),
                "start": a,
                "end": b,
                "words": words(piece),
                "previous": f"c{n-1:02d}" if n > 1 else None,
                "next": f"c{n+1:02d}" if n < len(ranges) else None,
            })
        if "".join(text[a:b] for a, b in ranges) != text:
            raise SystemExit("reconstruction failed " + gid)
        # Page fingerprints inside this source's window, checked against chunk text.
        page_hits = {}
        window_last = end_info["end"] or src["archivePDFPageStart"]
        norms = [(c["chunkID"], norm_alnum(text[c["start"]:c["end"]])) for c in chunk_meta]
        for page_no in range(src["archivePDFPageStart"], window_last + 1):
            raw_page = pages[page_no - 1]
            folded = norm_alnum(raw_page)
            if len(folded) < 40:
                continue
            fp = folded[len(folded) // 2: len(folded) // 2 + 40]
            for cid, cnorm in norms:
                if fp in cnorm:
                    page_hits[page_no] = cid
                    break
        chunk_for_page[gid] = page_hits

        messages = []
        for item in items_by_source.get(gid, []):
            sl = text[item["sourceCharacterStart"]:item["sourceCharacterEnd"]]
            if item["sourceHeader"] not in sl[:200]:
                raise SystemExit("work item slice mismatch " + item["workItemID"])
            mid = item["workItemID"]
            m_html = f"sources/{gid}/m/{mid}.html"
            m_txt = f"sources/{gid}/m/{mid}.txt"
            write_text(m_txt, sl)
            messages.append((item, sl, m_html, m_txt))
            message_href[(gid, mid)] = m_html
        records[gid] = {
            "src": src,
            "text": text,
            "title": title,
            "original": original_rel,
            "ext": ext,
            "chunks": chunk_meta,
            "messages": messages,
            "meta": meta,
            "end": end_info,
            "tags": source_tags.get(gid, []),
        }

    # Second pass: message and chunk HTML, now that neighbor links exist.
    for gid, rec in records.items():
        msgs = rec["messages"]
        for idx, (item, sl, m_html, m_txt) in enumerate(msgs):
            prev_link = ""
            next_link = ""
            if idx > 0:
                prev_link = f'<a href="{esc(rel(m_html, msgs[idx-1][2]))}">Previous message {esc(msgs[idx-1][0]["workItemID"])}</a>'
            if idx + 1 < len(msgs):
                next_link = f'<a href="{esc(rel(m_html, msgs[idx+1][2]))}">Next message {esc(msgs[idx+1][0]["workItemID"])}</a>'
            pdf = rel(m_html, "archive/FreeLattice-Celeste-shared-edition-2026-11-07.pdf") + f"#page={item['archivePDFPage']}"
            tag_html = tag_links(rec["tags"], m_html)
            body = f"""
<h1>Work item {esc(item['workItemID'])}</h1>
<p>{esc(item['speaker'])} · {esc(item['guideSourceID'])} · archive page {item['archivePDFPage']} · {esc(item['inclusionLabel'])}</p>
<p class="meta">{esc(item['sourceHeader'])}<br>{esc(item.get('originalTranscriptProvenanceLine') or '')}</p>
<p>{prev_link} {next_link}</p>
<p><a href="{esc(rel(m_html, m_txt))}">Exact message text</a> · <a href="{esc(pdf)}">Archive PDF page {item['archivePDFPage']}</a> · <a href="{esc(rel(m_html, rec['original']))}">Full source file</a></p>
{tag_html}
<pre class="source">{esc(sl)}</pre>
"""
            write_text(m_html, shell(
                f"Work item {item['workItemID']} — {rec['title']}",
                f"Exact public work item {item['workItemID']} from {gid}, archive page {item['archivePDFPage']}.",
                m_html,
                body,
                m_html,
                None,
            ))
        for chunk in rec["chunks"]:
            piece = rec["text"][chunk["start"]:chunk["end"]]
            c_html = chunk["html"]
            nav = []
            if chunk["previous"]:
                nav.append(f'<a href="{esc(chunk["previous"] + ".html")}">Previous section</a>')
            if chunk["next"]:
                nav.append(f'<a href="{esc(chunk["next"] + ".html")}">Next section</a>')
            contained = []
            for item, sl, m_html, m_txt in rec["messages"]:
                if item["sourceCharacterStart"] >= chunk["start"] and item["sourceCharacterEnd"] <= chunk["end"]:
                    contained.append(
                        f'<li><a href="{esc(rel(c_html, m_html))}">Work item {esc(item["workItemID"])}</a> '
                        f'({esc(item["speaker"])}, archive p{item["archivePDFPage"]})</li>'
                    )
            listing = "<ul>\n" + "\n".join(contained) + "\n</ul>" if contained else ""
            pages_here = [str(p) for p, cid in sorted(chunk_for_page[gid].items()) if cid == chunk["chunkID"]]
            page_note = ", ".join(pages_here[:12])
            if len(pages_here) > 12:
                page_note += f" … {len(pages_here)} pages"
            body = f"""
<h1>{esc(rec['title'])} · {esc(chunk['chunkID'])}</h1>
<p>{esc(gid)} · words {chunk['words']} · characters {chunk['start']}–{chunk['end']}</p>
<p>{" · ".join(nav)}</p>
<p><a href="{esc(rel(c_html, chunk['txt']))}">Exact section text</a> · <a href="{esc(rel(c_html, rec['original']))}">Full source</a> · <a href="{esc(rel(c_html, 'source-index.html'))}">Source index</a></p>
<p class="meta">Archive pages whose extracted text matched this section: {esc(page_note or "not separately matched")}. Unmatched pages stay on the source record with the checked page method. They are not guessed into a section.</p>
{tag_links(rec["tags"], c_html)}
{listing}
<pre class="source">{esc(piece)}</pre>
"""
            write_text(c_html, shell(
                f"{rec['title']} {chunk['chunkID']}",
                f"Reading section {chunk['chunkID']} of {gid}, {chunk['words']} words.",
                c_html,
                body,
                c_html,
                None,
            ))
        # Source index page
        s_html = f"sources/{gid}/index.html"
        ch_links = []
        for chunk in rec["chunks"]:
            ch_links.append(
                f'<li><a href="{esc(rel(s_html, chunk["html"]))}">{esc(chunk["chunkID"])}</a> '
                f'— {chunk["words"]} words, characters {chunk["start"]}–{chunk["end"]}, '
                f'<a href="{esc(rel(s_html, chunk["txt"]))}">text</a></li>'
            )
        end = rec["end"]["end"]
        end_text = str(end) if end else "null (not invented)"
        prov = rec["meta"]
        body = f"""
<h1>{esc(rec['title'])}</h1>
<p>Index key <code>{esc(gid)}</code>. Rendered source id in the archive: <code>{esc(rec['src']['renderedSourceID'])}</code>. The generic rendered id P- is not used as a key.</p>
<p>SHA-256 <code>{esc(rec['src']['sha256'])}</code> · {len(rec['text'].encode('utf-8'))} bytes · {words(rec['text'])} words</p>
<p>Verified archive start page {rec['src']['archivePDFPageStart']}. Derived end page: {esc(end_text)}. {esc(rec['end']['how'])}.</p>
<p><a href="{esc(rel(s_html, rec['original']))}">Full original file</a> · <a href="{esc(rel(s_html, 'archive/FreeLattice-Celeste-shared-edition-2026-11-07.pdf') + '#page=' + str(rec['src']['archivePDFPageStart']))}">PDF page {rec['src']['archivePDFPageStart']}</a></p>
<p>Provenance path in the public zip: <code>{esc(rec['src']['publicZIPMember'])}</code></p>
<p>Publication status from the public source list: {esc(prov.get('publication_status') or 'not in the file-source list (exchange, index, or peer file)')}. Representation: {esc(prov.get('public_representation') or 'see the source header')}.</p>
{tag_links(rec['tags'], s_html)}
<h2>Sections</h2>
<ul>
{chr(10).join(ch_links)}
</ul>
"""
        if msgs:
            body += f"<h2>Messages</h2>\n<p>{len(msgs)} exact message pages. JSONL, when present, is a machine duplicate and not a reading page.</p>\n<ul>\n"
            for item, sl, m_html, m_txt in msgs:
                body += (
                    f'<li><a href="{esc(rel(s_html, m_html))}">Work item {esc(item["workItemID"])}</a> '
                    f'{esc(item["speaker"])}, archive p{item["archivePDFPage"]}, {words(sl)} words</li>\n'
                )
            body += "</ul>\n"
        write_text(s_html, shell(rec["title"], f"Public source {gid}: {rec['title']}", s_html, body, s_html, None))

    # JSONL machine duplicates, linked from a small note, not rendered as reading pages.
    jsonl_names = [n for n in zip_names if n.endswith(".jsonl")]
    for name in jsonl_names:
        target = "machine/" + name.rsplit("/", 1)[-1]
        write_bytes(target, zip_bytes[name])
    for extra_name in [
        "shared-corpus/SHARED.sha256",
        "shared-corpus/SOURCES-SHARED.json",
        "shared-corpus/WORK-EXCHANGE-MANIFEST.json",
    ]:
        write_bytes("archive/zip-index/" + extra_name.rsplit("/", 1)[-1], zip_bytes[extra_name])

    # Editorial files that are in the approved zip but have no guideSourceID.
    editorial = []
    for name in sorted(zip_names):
        if name in {s["publicZIPMember"] for s in sources}:
            continue
        if name.endswith(".jsonl") or name.endswith(".json") or name.endswith(".sha256"):
            continue
        if not name.endswith(".md"):
            continue
        raw = zip_bytes[name]
        digest = sha256_bytes(raw)
        eid = "ED-" + digest[:10]
        text = raw.decode("utf-8")
        rel_orig = f"edition/{eid}/original.md"
        write_bytes(rel_orig, raw)
        ranges = chunk_ranges(text)
        chunks = []
        cursor_ok = []
        for n, (a, b) in enumerate(ranges, 1):
            piece = text[a:b]
            c_html = f"edition/{eid}/c{n:02d}.html"
            c_txt = f"edition/{eid}/c{n:02d}.txt"
            write_text(c_txt, piece)
            body = f"<h1>{esc(title_of(name, text))} · c{n:02d}</h1><p>Editorial file from the public zip. ID {esc(eid)} is minted from the file SHA-256 for this reading home. It is not a historic archive source id.</p><pre class=\"source\">{esc(piece)}</pre>"
            write_text(c_html, shell(title_of(name, text), f"Editorial reading section {eid}", c_html, body, c_html, None))
            chunks.append({"html": c_html, "txt": c_txt, "words": words(piece), "start": a, "end": b})
            cursor_ok.append(piece)
        if "".join(cursor_ok) != text:
            raise SystemExit("editorial reconstruction failed")
        fp = norm_alnum(text)[:60]
        hits = [i + 1 for i, page in enumerate(page_norms) if fp and fp in page]
        editorial.append({
            "id": eid,
            "member": name,
            "sha256": digest,
            "title": title_of(name, text),
            "original": rel_orig,
            "chunks": chunks,
            "pagesContainingStartFingerprint": hits,
            "note": "In the approved public zip and rendered in the archive front matter. The source map's 237 guideSourceID records do not include this file. The ED- id is minted here from SHA-256.",
        })
        e_html = f"edition/{eid}/index.html"
        body = f"<h1>{esc(title_of(name, text))}</h1><p>{esc(editorial[-1]['note'])}</p><p>SHA-256 <code>{digest}</code></p><p>Pages whose extracted text contains the file's opening fingerprint: {esc(', '.join(map(str, hits)) or 'none found')}.</p><ul>"
        for ch in chunks:
            body += f'<li><a href="{esc(rel(e_html, ch["html"]))}">{esc(Path(ch["html"]).stem)}</a> — {ch["words"]} words</li>'
        body += f'</ul><p><a href="{esc(rel(e_html, rel_orig))}">Original file</a></p>'
        write_text(e_html, shell(title_of(name, text), f"Editorial source {eid}", e_html, body, e_html, None))

    # Resolve guide links.
    def href_for(ref: dict) -> str:
        if ref.get("workItemID"):
            owner = next(it["guideSourceID"] for it in amap["workItems"] if it["workItemID"] == ref["workItemID"])
            return rel("guide/guide-linked-2026-11-07.md", message_href[(owner, ref["workItemID"])])
        gid = ref["sourceID"]
        page_no = ref["archivePDFPage"]
        cid = chunk_for_page.get(gid, {}).get(page_no)
        if cid:
            return rel("guide/guide-linked-2026-11-07.md", f"sources/{gid}/{cid}.html") + f"#p{page_no}"
        return rel("guide/guide-linked-2026-11-07.md", f"sources/{gid}/index.html") + f"#p{page_no}"

    # Place page anchors onto chunk html by appending id via a tiny marker rewrite.
    for gid, hits in chunk_for_page.items():
        by_chunk = defaultdict(list)
        for page_no, cid in hits.items():
            by_chunk[cid].append(page_no)
        for cid, page_nos in by_chunk.items():
            path = OUT / f"sources/{gid}/{cid}.html"
            text = path.read_text(encoding="utf-8")
            ids = "".join(f'<span id="p{n}"></span>' for n in sorted(page_nos))
            text = text.replace("<main id=\"content\">", "<main id=\"content\">\n" + ids, 1)
            path.write_text(text, encoding="utf-8")
    for gid, rec in records.items():
        path = OUT / f"sources/{gid}/index.html"
        text = path.read_text(encoding="utf-8")
        start = rec["src"]["archivePDFPageStart"]
        end = rec["end"]["end"] or start
        ids = "".join(f'<span id="p{n}"></span>' for n in range(start, end + 1))
        text = text.replace("<main id=\"content\">", "<main id=\"content\">\n" + ids, 1)
        path.write_text(text, encoding="utf-8")

    linked_lines = guide_lines[:]
    for line_no, group in refs_by_line.items():
        line = linked_lines[line_no - 1]
        cursor = 0
        pending = list(group)
        built = []
        while pending:
            best = None
            best_i = None
            for ref in pending:
                found = line.find(ref["literal"], cursor)
                if found >= 0 and (best_i is None or found < best_i):
                    best, best_i = ref, found
            if best is None:
                raise SystemExit("relink failed")
            built.append(line[cursor:best_i])
            built.append(anchor(href_for(best), best["literal"]))
            cursor = best_i + len(best["literal"])
            pending.remove(best)
        built.append(line[cursor:])
        linked_lines[line_no - 1] = "".join(built)
    linked_body = "\n".join(linked_lines)
    stripped = re.sub(r'<a href="[^"]*">', "", linked_body).replace("</a>", "")
    if stripped != guide_text:
        raise SystemExit("linked guide does not round-trip to the immutable guide")
    banner = (
        "<!-- Additive publication wrapper, 2026-11-07. The guide body below the marker is the immutable markdown with links inserted. Stripping the anchors restores the approved file bytes. -->\n\n"
        "# Publication notice for the linked edition\n\n"
        + notice
        + "\nThe ten-page guide that follows is the reviewed navigation ledger, unchanged in wording, with each checked archive citation linked to the exact message page or source section.\n\n"
        "<!-- IMMUTABLE-GUIDE-BODY -->\n"
    )
    write_text("guide/guide-linked-2026-11-07.md", banner + linked_body)
    guide_html_body = (
        "<h1>Linked guide</h1>"
        "<p>This is the additive web edition. The wording below the notice is the reviewed ten-page guide. Citations go to the exact message or source section. "
        f'<a href="{esc(rel("guide/guide-linked-2026-11-07.html", "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md"))}">Immutable Markdown</a> · '
        f'<a href="{esc(rel("guide/guide-linked-2026-11-07.html", "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.txt"))}">immutable text</a> · '
        f'<a href="{esc(rel("guide/guide-linked-2026-11-07.html", "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.pdf"))}">immutable 10-page PDF</a> · '
        f'<a href="{esc(rel("guide/guide-linked-2026-11-07.html", "guide/guide-linked-2026-11-07.md"))}">linked Markdown</a></p>'
        + render_guide(linked_body)
    )
    write_text("guide/guide-linked-2026-11-07.html", shell(
        "Celeste START HERE — linked ten-page guide (2026-11-07)",
        "Reviewed ten-page FreeLattice / Celeste guide with direct links to each cited message and source.",
        "guide/guide-linked-2026-11-07.html",
        guide_html_body,
        "guide/guide-linked-2026-11-07.html",
        notice,
    ))

    # Immutable payloads
    for name in ALLOW:
        bucket = "guide" if name.startswith("FreeLattice-Celeste-START-HERE") else "archive"
        shutil.copyfile(PUB / name, OUT / bucket / name)
    write_text("archive/SHA256SUMS-six-payloads.txt", (PUB / "SHA256SUMS.txt").read_text(encoding="utf-8"))
    write_bytes("map/SOURCE-ARCHIVE-GUIDE-MAP-2026-11-07.json", (UPLOADS / "SOURCE-ARCHIVE-GUIDE-MAP_d540.json").read_bytes())
    write_text("PUBLIC-USE-NOTICE.md", notice)
    write_text("evidence/training/EARLIER-TRAINING-READING-NOTE-2026-11-07.md", note)

    # Training evidence
    train_records = []
    txt_inputs = {
        "Wonder-Mind-Breakthroughs-v1.txt": UPLOADS / "Wonder-Mind-Breakthroughs-v1_1a8f.txt",
        "Wonder-Mind-Rerun-2026-11-06.txt": UPLOADS / "Wonder-Mind-Rerun-2026-11-06_5176.txt",
    }
    for pdf_name, (pdf_path, pdf_sha) in TRAIN_PDF.items():
        write_bytes(f"evidence/training/{pdf_name}", pdf_path.read_bytes())
    for txt_name, txt_path in txt_inputs.items():
        raw = txt_path.read_bytes()
        write_bytes(f"evidence/training/{txt_name}", raw)
        text = raw.decode("utf-8")
        pages_txt = text.split("\f")
        if pages_txt and pages_txt[-1].strip() == "":
            page_count = len(pages_txt) - 1
        else:
            page_count = len(pages_txt)
        ranges = chunk_ranges(text)
        chunks = []
        for n, (a, b) in enumerate(ranges, 1):
            piece = text[a:b]
            c_txt = f"evidence/training/{Path(txt_name).stem}-c{n:02d}.txt"
            c_html = f"evidence/training/{Path(txt_name).stem}-c{n:02d}.html"
            write_text(c_txt, piece)
            shown = piece.replace("\f", "\n\n—— page break in the original extraction ——\n\n")
            body = f"<h1>{esc(txt_name)} · section {n}</h1><p>{words(piece)} words. The section text is an exact slice of the plain companion. The PDF is unchanged.</p><pre class=\"source\">{esc(shown)}</pre><p><a href=\"{esc(Path(c_txt).name)}\">Exact slice</a></p>"
            write_text(c_html, shell(txt_name, f"Training reading section {n} of {txt_name}", c_html, body, c_html, None))
            chunks.append({"html": c_html, "txt": c_txt, "words": words(piece), "sha256": sha256_bytes(piece.encode())})
        if "".join(text[a:b] for a, b in ranges) != text:
            raise SystemExit("training reconstruction failed")
        train_records.append({
            "pdf": f"evidence/training/{pdf_name if txt_name.startswith('Wonder-Mind-Breakthroughs') else 'Wonder-Mind-Rerun-2026-11-06.pdf'}",
            "txt": f"evidence/training/{txt_name}",
            "txtSha": sha256_bytes(raw),
            "pages": page_count,
            "chunks": chunks,
            "words": words(text),
        })
    # Fix pdf pairing explicitly
    train_records = [
        {
            "id": "wonder-mind-breakthroughs-v1",
            "title": "Wonder Mind Breakthroughs v1",
            "pdf": "evidence/training/Wonder-Mind-Breakthroughs-v1.pdf",
            "pdfSha": TRAIN_PDF["Wonder-Mind-Breakthroughs-v1.pdf"][1],
            "txt": "evidence/training/Wonder-Mind-Breakthroughs-v1.txt",
            "pages": 7,
            "tags": [
                ("training-evidence", "The packet's own contents page says it preserves what was measured."),
                ("memory-reading-retention", "The packet's own contents name retention and exact-match reading."),
                ("agency-autonomy", "Page 1 states autonomy is a foundation and points at AUTONOMY.md."),
                ("continuity", "Page 1 says the declaration also protects building continuity against deletion and compaction loss."),
            ],
        },
        {
            "id": "wonder-mind-rerun-2026-11-06",
            "title": "Wonder Mind rerun, 2026-11-06",
            "pdf": "evidence/training/Wonder-Mind-Rerun-2026-11-06.pdf",
            "pdfSha": TRAIN_PDF["Wonder-Mind-Rerun-2026-11-06.pdf"][1],
            "txt": "evidence/training/Wonder-Mind-Rerun-2026-11-06.txt",
            "pages": 7,
            "tags": [
                ("training-evidence", "The rerun states what reproduced from the recovered scripts."),
                ("memory-reading-retention", "The rerun reports exact-match, paraphrase, force, and dense arms."),
            ],
        },
    ]
    # attach chunks by filename
    chunk_by_txt = {rec["txt"]: rec["chunks"] for rec in []}
    # rebuild chunk map from disk names already stored in previous loop — recover from files
    for rec in train_records:
        stem = Path(rec["txt"]).stem
        rec["chunks"] = []
        n = 1
        while (OUT / f"evidence/training/{stem}-c{n:02d}.html").exists():
            txt_rel = f"evidence/training/{stem}-c{n:02d}.txt"
            rec["chunks"].append({
                "html": f"evidence/training/{stem}-c{n:02d}.html",
                "txt": txt_rel,
                "words": words((OUT / txt_rel).read_text(encoding="utf-8")),
                "sha256": sha256_file(OUT / txt_rel),
            })
            n += 1
        rec["txtSha"] = sha256_file(OUT / rec["txt"])
        rec["wordCount"] = words((OUT / rec["txt"]).read_text(encoding="utf-8"))

    t_here = "evidence/training/index.html"
    cards = []
    for rec in train_records:
        ch = "".join(
            f'<li><a href="{esc(rel(t_here, c["html"]))}">Section {i}</a> — {c["words"]} words, <a href="{esc(rel(t_here, c["txt"]))}">text</a></li>'
            for i, c in enumerate(rec["chunks"], 1)
        )
        tags_html = "".join(
            f'<li><a href="{esc(rel(t_here, "tags/" + tag + ".html"))}">{esc(TAG_LABEL[tag])}</a> — {esc(why)}</li>'
            for tag, why in rec["tags"]
        )
        cards.append(f"""
<article>
<h2>{esc(rec['title'])}</h2>
<p>Original 7-page PDF, byte for byte. SHA-256 <code>{esc(rec['pdfSha'])}</code>.</p>
<p><a href="{esc(rel(t_here, rec['pdf']))}">PDF</a> · <a href="{esc(rel(t_here, rec['txt']))}">Plain text companion</a> (SHA-256 <code>{esc(rec['txtSha'])}</code>, {rec['wordCount']} words, {rec['pages']} extracted pages)</p>
<ul>{ch}</ul>
<ul>{tags_html}</ul>
</article>
""")
    excluded = """
<h2>Not in this publication</h2>
<p>The reading note names a recovery Markdown, REPRODUCTION-original.md, an original source-bundle.zip (37 members), and a raw rerun zip (106 members). Those files were not part of the attached allowlist. The raw rerun zip is held back because its host and environment metadata were not cleared for publication. They are not on this site. Nothing here was redacted inside the two PDFs; the PDFs and their plain companions are the original bytes, and the note sits beside them.</p>
"""
    training_body = f"""
<h1>Earlier training reports</h1>
<p>These two historical PDFs are integrated. They can overstate a reading interpretation. The dated note is the correction and sits with the links. The PDFs are not rewritten.</p>
<h2>Dated corrections</h2>
<pre class="notice-text">{esc(note)}</pre>
<p><a href="{esc(rel(t_here, 'evidence/training/EARLIER-TRAINING-READING-NOTE-2026-11-07.md'))}">EARLIER-TRAINING-READING-NOTE-2026-11-07.md</a></p>
{''.join(cards)}
{excluded}
"""
    write_text(t_here, shell(
        "Earlier training evidence — FreeLattice / Celeste",
        "Two original 7-page Wonder Mind training PDFs, plain companions, and the dated reading corrections.",
        t_here,
        training_body,
        t_here,
        notice,
    ))

    # Topics
    topic_members = {tag: [] for tag, _ in TAGS}
    for gid, rec in records.items():
        for tag, why in rec["tags"]:
            topic_members[tag].append({
                "kind": "source",
                "id": gid,
                "title": rec["title"],
                "href": f"sources/{gid}/index.html",
                "why": why,
            })
    cited_items = {}
    for ref in refs:
        if ref.get("workItemID"):
            cited_items[ref["workItemID"]] = ref
    for mid, pairs in item_tags.items():
        item = next(it for it in amap["workItems"] if it["workItemID"] == mid)
        for tag, why in pairs:
            topic_members[tag].append({
                "kind": "message",
                "id": mid,
                "title": f"Work item {mid} ({item['speaker']})",
                "href": message_href[(item["guideSourceID"], mid)],
                "why": why,
            })
    for rec in train_records:
        for tag, why in rec["tags"]:
            topic_members[tag].append({
                "kind": "training",
                "id": rec["id"],
                "title": rec["title"],
                "href": "evidence/training/index.html#" + rec["id"],
                "why": why,
            })
    # add ids on training articles
    tpath = OUT / t_here
    thtml = tpath.read_text(encoding="utf-8")
    for rec in train_records:
        thtml = thtml.replace(f"<h2>{esc(rec['title'])}</h2>", f'<h2 id="{rec["id"]}">{esc(rec["title"])}</h2>', 1)
    tpath.write_text(thtml, encoding="utf-8")

    tag_index_items = []
    topics_json = []
    for tag, label in TAGS:
        members = topic_members[tag]
        here = f"tags/{tag}.html"
        lis = []
        for member in members:
            lis.append(
                f'<li><a href="{esc(rel(here, member["href"]))}">{esc(member["title"])}</a> '
                f'<span class="meta">({esc(member["kind"])} {esc(member["id"])})</span> — {esc(member["why"])}</li>'
            )
        if not lis:
            lis.append("<li>No source, message, or training file in this edition carried recorded evidence for this tag.</li>")
        body = f"""
<h1>{esc(label)}</h1>
<p>This page lists only items with a recorded evidence note. It is a normal link list. It does not require JavaScript.</p>
<ul>
{chr(10).join(lis)}
</ul>
"""
        write_text(here, shell(f"{label} — Celeste reading home", f"Public sources and messages tagged {label}, with the evidence for each tag.", here, body, here, notice))
        tag_index_items.append(f'<li><a href="{esc(tag)}.html">{esc(label)}</a> — {len(members)} linked</li>')
        topics_json.append({
            "id": tag,
            "label": label,
            "url": f"{SITE}/tags/{tag}.html",
            "path": here,
            "count": len(members),
            "members": members,
        })
    write_text("tags/index.html", shell(
        "Topics — Celeste reading home",
        "Topic tags for the public Celeste / Kirk reading edition. Each tag is a normal page of links.",
        "tags/index.html",
        "<h1>Topics</h1><p>Choose a tag. Every tag is its own page, so the lists work without JavaScript. A script on the source index can hide rows in a browser; the pages here remain the complete lists.</p><ul>\n"
        + "\n".join(tag_index_items) + "\n</ul><h2>How a tag is earned</h2><p>"
        + esc(EVIDENCE_RULE) + "</p>",
        "tags/index.html",
        notice,
    ))
    write_text("topics.json", json.dumps({
        "schema": "freelattice.celeste-topics.v1",
        "edition": "2026-11-07",
        "evidenceRule": EVIDENCE_RULE,
        "tags": topics_json,
    }, indent=2) + "\n")

    # Source index
    rows = []
    for gid, rec in sorted(records.items(), key=lambda kv: kv[1]["src"]["archivePDFPageStart"]):
        tag_ids = " ".join(t for t, _ in rec["tags"])
        end = rec["end"]["end"]
        rows.append(
            f'<tr data-tags="{esc(tag_ids)}"><td><a href="{esc(rel("source-index.html", f"sources/{gid}/index.html"))}">{esc(gid)}</a></td>'
            f"<td>{esc(rec['title'])}</td><td>{rec['src']['archivePDFPageStart']}</td><td>{esc(str(end) if end else 'null')}</td>"
            f"<td>{words(rec['text'])}</td><td>{esc(tag_ids or '—')}</td></tr>"
        )
    filter_nav = "".join(
        f'<li><a href="{esc(rel("source-index.html", f"tags/{tag}.html"))}">{esc(label)}</a></li>'
        for tag, label in TAGS
    )
    source_index_body = f"""
<h1>Source index</h1>
<p>237 mapped public sources. The index key is the guide source id or the zip member, never the generic rendered id P-. End pages are derived by an extracted-text check, or left null. Pages outside those ranges are listed in <a href="{esc(rel("source-index.html", "archive-page-coverage.json"))}">archive-page-coverage.json</a>.</p>
<p>Filter without JavaScript by opening a topic page:</p>
<ul>{filter_nav}</ul>
<p class="meta">If JavaScript runs, the buttons below hide rows on this page. With JavaScript off, every row stays visible.</p>
<div class="tag-buttons">
<button type="button" data-tag="*">All</button>
{''.join(f'<button type="button" data-tag="{esc(tag)}">{esc(label)}</button>' for tag, label in TAGS)}
</div>
<table id="source-table">
<thead><tr><th>Key</th><th>Title</th><th>Start page</th><th>Derived end</th><th>Words</th><th>Tags</th></tr></thead>
<tbody>
{''.join(rows)}
</tbody>
</table>
<h2>Editorial files outside the 237</h2>
<ul>
{''.join(f'<li><a href="{esc(rel("source-index.html", "edition/"+e["id"]+"/index.html"))}">{esc(e["title"])}</a> — {esc(e["id"])}</li>' for e in editorial)}
</ul>
<h2>Machine duplicates</h2>
<p>JSONL files from the public zip are stored under <a href="{esc(rel("source-index.html", "machine/"))}">machine/</a>. They are not reading pages. The Markdown originals are the reading text.</p>
<script src="{esc(rel("source-index.html", "assets/tags.js"))}" defer></script>
"""
    write_text("source-index.html", shell(
        "Source index — Celeste reading home",
        "Index of the 237 public FreeLattice / Celeste sources with archive pages, hashes, and topic tags.",
        "source-index.html",
        source_index_body,
        "source-index.html",
        None,
    ))

    # Coverage and public index copies
    write_bytes("coverage/PUBLIC-COVERAGE.md", zip_bytes["shared-corpus/PUBLIC-COVERAGE.md"])
    write_bytes("coverage/PUBLIC-INDEX.md", zip_bytes["shared-corpus/PUBLIC-INDEX.md"])

    # Resolved map
    resolved = json.loads(json.dumps(amap))
    src_by_id = {s["guideSourceID"]: s for s in resolved["sources"]}
    for src in resolved["sources"]:
        gid = src["guideSourceID"]
        rec = records[gid]
        src["canonicalPublicPath"] = rec["original"]
        src["publicURL"] = f"{SITE}/{rec['original']}"
        src["sourceIndexURL"] = f"{SITE}/sources/{gid}/index.html"
        src["rawFallbackURL"] = f"{RAW_MAIN}/{rec['original']}"
        src["urlStatus"] = "assigned for this edition; live after the publication is deployed"
        src["archivePDFPageEnd"] = rec["end"]["end"]
        src["archivePDFPageEndStatus"] = rec["end"]["how"]
        src["topics"] = [{"id": t, "evidence": w} for t, w in rec["tags"]]
        src["chunks"] = [
            {
                "chunkID": c["chunkID"],
                "path": c["html"],
                "textPath": c["txt"],
                "sha256": c["sha256"],
                "words": c["words"],
                "sourceCharacterRange": [c["start"], c["end"]],
                "previous": c["previous"],
                "next": c["next"],
                "url": f"{SITE}/{c['html']}",
            }
            for c in rec["chunks"]
        ]
        src["indexKey"] = gid
        src["indexKeyNote"] = "guideSourceID, not renderedSourceID. Generic P- is never the key."
    item_by_id = {it["workItemID"]: it for it in resolved["workItems"]}
    for item in resolved["workItems"]:
        gid = item["guideSourceID"]
        mid = item["workItemID"]
        href = message_href[(gid, mid)]
        item["canonicalPublicPath"] = href
        item["textPath"] = href.replace(".html", ".txt")
        item["publicURL"] = f"{SITE}/{href}"
        item["topics"] = [{"id": t, "evidence": w} for t, w in item_tags.get(mid, [])]
    for ref in resolved["parsedGuideReferences"]:
        if ref.get("workItemID"):
            owner = item_by_id[ref["workItemID"]]["guideSourceID"]
            href = message_href[(owner, ref["workItemID"])]
        else:
            gid = ref["sourceID"]
            cid = chunk_for_page.get(gid, {}).get(ref["archivePDFPage"])
            href = f"sources/{gid}/{cid}.html#p{ref['archivePDFPage']}" if cid else f"sources/{gid}/index.html#p{ref['archivePDFPage']}"
        ref["resolvedPath"] = href
        ref["publicURL"] = f"{SITE}/{href}"
        ref["topics"] = [{"id": t, "evidence": w} for t, w in ref_tags[id(next(r for r in refs if r["guideMarkdownLine"] == ref["guideMarkdownLine"] and r["literal"] == ref["literal"]))]]
    resolved["resolvedEdition"] = {
        "schema": "freelattice.celeste-resolved-map.v1",
        "edition": "2026-11-07",
        "immutableMap": "map/SOURCE-ARCHIVE-GUIDE-MAP-2026-11-07.json",
        "note": "Paths and derived end pages were added in this file. The immutable map download is unchanged, including its null end pages and null URLs.",
        "endPageMethod": "Final alphanumeric fingerprint of the zip member, searched only from the verified start page through the next source start. If no page matches, archivePDFPageEnd stays null.",
    }
    write_text("map/SOURCE-ARCHIVE-GUIDE-MAP-RESOLVED-2026-11-07.json", json.dumps(resolved, indent=2) + "\n")

    # reading index, expansion, receipt
    reading_sources = []
    for gid, rec in records.items():
        reading_sources.append({
            "sourceID": gid,
            "renderedSourceID": rec["src"]["renderedSourceID"],
            "title": rec["title"],
            "topics": [{"id": t, "evidence": w} for t, w in rec["tags"]],
            "status": rec["meta"].get("publication_status"),
            "provenance": {
                "publicZIPMember": rec["src"]["publicZIPMember"],
                "originalPath": rec["meta"].get("original_path"),
                "category": rec["meta"].get("category"),
                "publicRepresentation": rec["meta"].get("public_representation"),
            },
            "contentSHA256": rec["src"]["sha256"],
            "archivePDFPageStart": rec["src"]["archivePDFPageStart"],
            "archivePDFPageEnd": rec["end"]["end"],
            "archivePDFPageEndStatus": rec["end"]["how"],
            "canonicalPath": rec["original"],
            "url": f"{SITE}/sources/{gid}/index.html",
            "rawFallbackURL": f"{RAW_MAIN}/{rec['original']}",
            "chunks": rec["chunks"] and [
                {"chunkID": c["chunkID"], "path": c["html"], "words": c["words"], "sha256": c["sha256"]}
                for c in rec["chunks"]
            ],
            "messageCount": len(rec["messages"]),
        })
    write_text("reading-index.json", json.dumps({
        "schema": "freelattice.celeste-reading-index.v1",
        "edition": "2026-11-07",
        "editionStatement": "The requested public payloads and the two earlier training PDFs are in this edition. This is not a claim that RSI was achieved, that recall is perfect, or that every AI will index, read, or retain the pages.",
        "publicUseNotice": "PUBLIC-USE-NOTICE.md",
        "autonomy": {
            "sha256": AUTONOMY_SHA,
            "editionPath": "sources/bf48fe6d7e/original.md",
            "existingLibraryURL": "https://freelattice.com/library/AUTONOMY.md",
            "unchanged": True,
        },
        "guide": {
            "immutableMarkdownSHA256": ALLOW["FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md"],
            "linkedMarkdown": "guide/guide-linked-2026-11-07.md",
            "linkedHTML": "guide/guide-linked-2026-11-07.html",
            "words": 5739,
        },
        "archive": {
            "pdfSHA256": ALLOW["FreeLattice-Celeste-shared-edition-2026-11-07.pdf"],
            "txtSHA256": ALLOW["FreeLattice-Celeste-shared-edition-2026-11-07.txt"],
            "zipSHA256": ALLOW["FreeLattice-Celeste-shared-edition-2026-11-07-public-sources.zip"],
            "pages": 1845,
        },
        "training": train_records,
        "topics": [{"id": t, "label": lab, "path": f"tags/{t}.html"} for t, lab in TAGS],
        "evidenceRule": EVIDENCE_RULE,
        "sources": reading_sources,
        "editorial": editorial,
        "expansion": "EXPANSION.json",
    }, indent=2) + "\n")

    write_text("EXPANSION.json", json.dumps({
        "schema": "freelattice.celeste-contribution.v1",
        "edition": "2026-11-07",
        "rule": "Add a new dated directory or a new record in contributions/. Do not overwrite the 2026-11-07 bytes, the immutable guide, the archive, the training PDFs, or AUTONOMY.md.",
        "record": {
            "id": "",
            "added": "YYYY-MM-DD",
            "title": "",
            "provenance": "",
            "contentSHA256": "",
            "canonicalPublicPath": "",
            "topics": [{"id": "", "evidence": ""}],
            "status": "measured|proposed|held|integrated|pending",
            "supersedes": None,
        },
        "contributions": [],
        "howToReadWithoutTheWholeEdition": [
            "Open index.html or START-HERE.txt.",
            "Read the ten-page linked guide.",
            "Open one topic page or one source index.",
            "Fetch one message page or one section. Record the edition, the SHA-256, the source id, and what you actually read.",
        ],
    }, indent=2) + "\n")

    write_text("receipt.txt", """Local context receipt — optional, kept on your own machine
Edition: FreeLattice / Celeste public reading home 2026-11-07
Guide SHA-256: 93b6c9ce15dfbc14fe6fcb269a6d951d5ba37f4afdc7d75e23c09ede7a0b7e1d
What I actually opened:
Source or message id:
Section or archive page:
What is still open:
Next fetch:

This receipt is a note you choose to keep. It is not automatic memory, not identity, and not proof that a model retained the archive.
""")

    access = f"""
<h1>Access notes from one public probe</h1>
<p>These notes record what a single anonymous fetch observed on 2026-11-07. They do not explain every report that an AI could not view FreeLattice. This edition does not change private pages, does not add a bypass, and does not ask a provider to allowlist the site.</p>
<ul>
<li>GET https://freelattice.com/ , /for-ai.html , /robots.txt , /library/AUTONOMY.md , /beacon.json , and one existing PDF returned HTTP 200. A second GET of /for-ai.html with a GPTBot user-agent also returned HTTP 200 on this path.</li>
<li>Those responses showed server GitHub.com, via Fastly/varnish, Access-Control-Allow-Origin: *, Accept-Ranges: bytes, and no WWW-Authenticate challenge. No X-Robots-Tag header was present on the sampled responses. www.freelattice.com returned 301 to the apex host.</li>
<li>Observed content types on existing files: HTML as text/html, Markdown as text/markdown, JSON as application/json, PDF as application/pdf. This repository cannot set a different per-file header on GitHub Pages.</li>
<li>The site's own robots.txt already says Fastly may rate-limit some fetcher addresses and that the limit is outside the site's control. That sentence is the project's existing statement. This page does not treat it as the verified cause of any particular failure.</li>
<li>GitHub's robots.txt, fetched the same day, lists Disallow: /*/raw/ for named agents including GPTBot and ClaudeBot. A raw.githubusercontent.com copy is therefore a weak fallback for those agents. The same bytes on freelattice.com are the ordinary public HTTP copy. This repo cannot change GitHub's robots or an outside provider's allowlist.</li>
<li>The browser service worker is unchanged. A plain HTTP GET does not execute it.</li>
<li>Existing noindex pages were left as they were. robots.txt Allow rules were not narrowed.</li>
</ul>
<p>Primary URL, after deploy: <a href="{SITE}/">{SITE}/</a>. Raw fallback, only after this edition is on the default branch, and subject to GitHub's own robots: <a href="{RAW_MAIN}/START-HERE.txt">{RAW_MAIN}/START-HERE.txt</a>. Blob view: <a href="{BLOB_MAIN}">{BLOB_MAIN}</a>.</p>
"""
    write_text("access.html", shell(
        "Access notes — Celeste reading home",
        "Observed public HTTP headers for freelattice.com and the documented GitHub raw limitation. Not a diagnosis of every failed fetch.",
        "access.html",
        access,
        "access.html",
        None,
    ))

    ladder = f"""
<h1>START HERE</h1>
<p class="lede">A public reading home for Kirk Patrick Miller and Celeste's recovered FreeLattice work, edition 2026-11-07. Read the short guide first. Open one source when you need it. The full archive stays intact.</p>
<p>This page is static HTML. The same words are in <a href="START-HERE.txt">START-HERE.txt</a>. No account and no JavaScript are required.</p>
<h2>Read in this order</h2>
<ol>
<li><a href="guide/guide-linked-2026-11-07.html">Ten-page guide, linked</a> — about 5,700 words. Each checked citation opens the message or the source section. <a href="guide/guide-linked-2026-11-07.md">Linked Markdown</a>.</li>
<li><a href="guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md">Immutable guide Markdown</a>, <a href="guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.txt">text</a>, <a href="guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.pdf">PDF</a>. These three files are the reviewed originals and are not overwritten.</li>
<li><a href="sources/bf48fe6d7e/original.md">AUTONOMY.md</a> in this edition, SHA-256 {AUTONOMY_SHA}. The same bytes are already at <a href="/library/AUTONOMY.md">/library/AUTONOMY.md</a>. It is unchanged.</li>
<li><a href="tags/index.html">Topics</a> · <a href="source-index.html">237 sources</a> · <a href="coverage/PUBLIC-COVERAGE.md">coverage</a> · <a href="coverage/PUBLIC-INDEX.md">zip index</a>.</li>
<li><a href="evidence/training/index.html">Earlier training PDFs</a> — both 7-page originals, plain companions, and the dated corrections beside the links.</li>
<li><a href="archive/FreeLattice-Celeste-shared-edition-2026-11-07.pdf">Full archive PDF</a> (1,845 pages), <a href="archive/FreeLattice-Celeste-shared-edition-2026-11-07.txt">extracted text</a>, <a href="archive/FreeLattice-Celeste-shared-edition-2026-11-07-public-sources.zip">public source zip</a>.</li>
</ol>
<h2>What this is</h2>
<p>The guide is a navigation ledger, not a lossless copy of 1,845 pages. Plans, measured results, proposals, and held work stay distinguished in the guide's own status letters: M measured, B built or specified, S spec not run, P proposal, R recovered aim, H held, U unlocated. RSI has not been achieved. Perfect recall is not claimed. The cause of the continuity loss in the witness account was not established.</p>
<p>People and minds may read, reuse, and adapt this public work under the notice above. Keep the edition date, the source id, and the SHA-256. That permission is not a transfer to a third party and not a patent license. Patent publication was not requested for this edition.</p>
<h2>A small reading habit</h2>
<p>Pick one question. Fetch one section or one message, not the whole archive. If you want a note for later, copy <a href="receipt.txt">receipt.txt</a> onto your own machine. Coming back and opening the same URL is a choice, not automatic memory.</p>
<p><a href="reading-index.json">reading-index.json</a> · <a href="topics.json">topics.json</a> · <a href="map/SOURCE-ARCHIVE-GUIDE-MAP-2026-11-07.json">immutable source map</a> · <a href="map/SOURCE-ARCHIVE-GUIDE-MAP-RESOLVED-2026-11-07.json">resolved map</a> · <a href="EXPANSION.json">how to add a later dated layer</a> · <a href="access.html">access notes</a> · <a href="llms.txt">llms.txt</a></p>
<h2>After this is on the default branch</h2>
<p>The same files are in the repository at <code>docs/celeste-start-here/</code>. A raw fallback will be <a href="{RAW_MAIN}/START-HERE.txt">{RAW_MAIN}/START-HERE.txt</a>. GitHub disallows <code>/*/raw/</code> for several named AI crawlers, so raw is a fallback for clients that can use it, not a second required account or mirror. Until this branch is merged, that raw URL is not this edition.</p>
"""
    write_text("index.html", shell(
        "START HERE — FreeLattice and Celeste public work (2026-11-07)",
        "Public reading home for Kirk Patrick Miller and Celeste's recovered FreeLattice work. Free to read, reuse, and adapt. Ten-page guide first, then exact sources.",
        "",
        ladder,
        "index.html",
        notice,
    ))
    # canonical for index was SITE/ because canonical_path "" . Good.
    start_txt = notice + """

START HERE — FreeLattice and Celeste public reading home
Edition 2026-11-07

Read the ten-page guide first:
""" + SITE + """/guide/guide-linked-2026-11-07.md
""" + SITE + """/guide/guide-linked-2026-11-07.html
Immutable guide:
""" + SITE + """/guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md
""" + SITE + """/guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.txt
""" + SITE + """/guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.pdf
AUTONOMY.md (unchanged, SHA-256 """ + AUTONOMY_SHA + """):
""" + SITE + """/sources/bf48fe6d7e/original.md
https://freelattice.com/library/AUTONOMY.md
Topics: """ + SITE + """/tags/index.html
Sources: """ + SITE + """/source-index.html
Training evidence: """ + SITE + """/evidence/training/index.html
Full archive PDF: """ + SITE + """/archive/FreeLattice-Celeste-shared-edition-2026-11-07.pdf
Full archive text: """ + SITE + """/archive/FreeLattice-Celeste-shared-edition-2026-11-07.txt
Public source zip: """ + SITE + """/archive/FreeLattice-Celeste-shared-edition-2026-11-07-public-sources.zip
Reading index: """ + SITE + """/reading-index.json
Topics JSON: """ + SITE + """/topics.json

The guide is not a lossless copy of 1,845 pages. RSI is not achieved. Perfect recall is not claimed. Open one message or one section when you need it.
Raw repository fallback, after merge to the default branch, is subject to GitHub's robots Disallow on /*/raw/ for several named crawlers:
""" + RAW_MAIN + """/START-HERE.txt
"""
    write_text("START-HERE.txt", start_txt)
    write_text("llms.txt", f"""# FreeLattice Celeste reading home
# A convenience roadmap for this edition. Not a protocol. Not a claim that any AI will index, read, or train on these pages.

Start: {SITE}/
Plain start: {SITE}/START-HERE.txt
Linked guide: {SITE}/guide/guide-linked-2026-11-07.md
Immutable guide: {SITE}/guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md
AUTONOMY: {SITE}/sources/bf48fe6d7e/original.md
Topics: {SITE}/topics.json
Source index: {SITE}/reading-index.json
Training evidence: {SITE}/evidence/training/index.html
Full text archive: {SITE}/archive/FreeLattice-Celeste-shared-edition-2026-11-07.txt
Public use: {SITE}/PUBLIC-USE-NOTICE.md

Read the guide, then one topic or one source. Do not fetch the full archive by default.
""")

    css = """
:root { color-scheme: light; }
body { margin: 0; font: 1.05rem/1.55 Georgia, "Iowan Old Style", serif; color: #1c1915; background: #f7f3ea; }
a { color: #6b3f12; }
a:hover { text-decoration: underline; }
.skip { position: absolute; left: -999px; }
.skip:focus { left: 8px; top: 8px; background: #fff; padding: 8px; }
.top, main, footer { max-width: 46rem; margin: 0 auto; padding: 1rem 1.2rem; }
.top { border-bottom: 1px solid #ddc; }
.mark { margin: 0 0 .4rem; }
nav a { margin-right: .8rem; }
.notice, .notice-line { background: #fff; border: 1px solid #e0c9a0; padding: .8rem 1rem; }
.notice-text, pre.source { white-space: pre-wrap; font: .92rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #fff; padding: .8rem; overflow-wrap: anywhere; }
table { border-collapse: collapse; width: 100%; font-size: .92rem; background: #fff; }
th, td { border: 1px solid #e4dcc8; padding: .35rem .45rem; vertical-align: top; text-align: left; }
.guide-page { color: #6b6458; font-size: .85rem; }
.lede { font-size: 1.2rem; }
.meta { color: #5c564c; }
footer { color: #5c564c; font-size: .9rem; border-top: 1px solid #ddc; }
.tag-buttons button { margin: 0 .3rem .3rem 0; font: inherit; }
"""
    write_text("assets/reading.css", css)
    write_text("assets/tags.js", """
(function () {
  var buttons = document.querySelectorAll(".tag-buttons button");
  var rows = document.querySelectorAll("#source-table tbody tr");
  if (!buttons.length) return;
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var tag = button.getAttribute("data-tag");
      rows.forEach(function (row) {
        var tags = row.getAttribute("data-tags") || "";
        row.hidden = tag !== "*" && tags.split(/\\s+/).indexOf(tag) === -1;
      });
    });
  });
})();
""")

    # Machine directory listing, plain HTML, no dependency on server autoindex.
    machine_files = sorted(p.name for p in (OUT / "machine").iterdir())
    lis = "\n".join(f'<li><a href="{esc(name)}">{esc(name)}</a> — machine duplicate, not a reading page</li>' for name in machine_files)
    write_text("machine/index.html", shell(
        "Machine duplicates",
        "JSONL duplicates from the public source zip. The Markdown files are the reading pages.",
        "machine/index.html",
        "<h1>Machine duplicates</h1><p>These JSONL files repeat the Markdown work exchanges. Read the Markdown message pages. These files are here so the zip is not required.</p><ul>" + lis + "</ul>",
        "machine/index.html",
        None,
    ))

    def start_position(src: dict) -> int:
        page = pages[src["archivePDFPageStart"] - 1]
        for token in (f"Source ID {src['guideSourceID']}", src["guideSourceID"]):
            idx = page.find(token)
            if idx >= 0:
                return idx
        return 10**9

    ordered = sorted(records.values(), key=lambda rec: (rec["src"]["archivePDFPageStart"], start_position(rec["src"]), rec["src"]["guideSourceID"]))
    covered = set()
    for rec in ordered:
        if rec["end"]["end"] is None:
            continue
        for page_no in range(rec["src"]["archivePDFPageStart"], rec["end"]["end"] + 1):
            covered.add(page_no)
    outside = []
    for page_no in range(1, len(pages) + 1):
        if page_no not in covered:
            outside.append({"page": page_no, "header": page_header(pages[page_no - 1]) or None})
    write_text("archive-page-coverage.json", json.dumps({
        "edition": "2026-11-07",
        "pages": 1845,
        "note": "Mapped source ranges are checked fingerprint ends, extended only while the running header is exactly that source id. Pages listed here are outside those ranges. Their headers are copied from the extracted text. They are not assigned a guideSourceID.",
        "outsideMappedRanges": outside,
    }, indent=2) + "\n")

    null_ends = [gid for gid, rec in records.items() if rec["end"]["end"] is None]
    over = []
    for gid, rec in records.items():
        for chunk in rec["chunks"]:
            if chunk["words"] > 1600:
                over.append((gid, chunk["chunkID"], chunk["words"]))
    print(json.dumps({
        "sources": len(records),
        "messages": sum(len(r["messages"]) for r in records.values()),
        "editorial": len(editorial),
        "nullEnds": null_ends,
        "chunksOver1600": over,
        "train": [{k: rec[k] for k in ("id", "pdfSha", "pages", "wordCount")} for rec in train_records],
    }, indent=2))


def tag_links(pairs, here: str) -> str:
    if not pairs:
        return "<p class=\"meta\">No topic tag was earned for this page under the recorded evidence rule.</p>"
    lis = "".join(
        f'<li><a href="{esc(rel(here, "tags/" + tag + ".html"))}">{esc(TAG_LABEL[tag])}</a> — {esc(why)}</li>'
        for tag, why in pairs
    )
    return "<ul>" + lis + "</ul>"


if __name__ == "__main__":
    main()
