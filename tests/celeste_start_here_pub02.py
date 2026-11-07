#!/usr/bin/env python3
"""Narrow checks for the 2026-11-07 Celeste public reading home.

Does not crawl private areas, run the broad smoke suite, or fetch the network.
"""

from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / "docs" / "celeste-start-here"
FAILS = []


def check(name: str, ok: bool, detail: str = "") -> None:
    if not ok:
        FAILS.append(f"{name}: {detail}")
    print(("ok  " if ok else "FAIL") + " " + name + ((" — " + detail) if detail and not ok else ""))


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    expect = {
        "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md": "93b6c9ce15dfbc14fe6fcb269a6d951d5ba37f4afdc7d75e23c09ede7a0b7e1d",
        "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.pdf": "e34f891efdf15868786e6da98748e7e9d2eee982561a0db0e6c44f7bea0ae7dc",
        "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.txt": "0d871b70a2cc7a68a5c17dce64dadadbcb882f0d345d605972bcb407938bce62",
        "archive/FreeLattice-Celeste-shared-edition-2026-11-07.pdf": "b9cd4795175f071daf66584c70ed1cd96c0abf58d081c8e527f33d53f496ae9c",
        "archive/FreeLattice-Celeste-shared-edition-2026-11-07.txt": "6fb6b241fe18bab341681fd7451a9058802ef460430b2e7ad9dce1bb017a8afc",
        "archive/FreeLattice-Celeste-shared-edition-2026-11-07-public-sources.zip": "d555083aa30893fec86ba28fc4e99add6be28a66a11428d6596f6ea1314edb0d",
        "evidence/training/Wonder-Mind-Breakthroughs-v1.pdf": "8a155ac2b990e3d1d3b003839322f5c62720282cb5e15d020ae7cde834affc89",
        "evidence/training/Wonder-Mind-Rerun-2026-11-06.pdf": "aacc6c0d71db880e7bf92f60079404fd7f521acb3e0bcf89d00cccb27ef908b7",
        "sources/bf48fe6d7e/original.md": "8d6548aa09d47e3f00fa08b3650febcd90370b9cbbd2237b30bc67b6dc017927",
    }
    for rel, digest in expect.items():
        check(rel, sha(HOME / rel) == digest, "hash")
    check(
        "repo AUTONOMY unchanged",
        sha(ROOT / "docs" / "library" / "AUTONOMY.md") == expect["sources/bf48fe6d7e/original.md"],
    )

    guide = (HOME / "guide/FreeLattice-Celeste-START-HERE-10-pages-2026-11-07.md").read_text(encoding="utf-8")
    linked = (HOME / "guide/guide-linked-2026-11-07.md").read_text(encoding="utf-8")
    body = linked.split("<!-- IMMUTABLE-GUIDE-BODY -->\n", 1)[1]
    plain = re.sub(r'<a href="[^"]*">', "", body).replace("</a>", "")
    check("linked guide round-trip", plain == guide)
    check("guide words", len(guide.split()) == 5739, str(len(guide.split())))
    check("ten page markers", len(re.findall(r"<!-- page \d+ of 10 -->", guide)) == 10)
    hrefs = re.findall(r'href="([^"]+)"', body)
    check("309 guide links", len(hrefs) == 309, str(len(hrefs)))
    missing = []
    for href in hrefs:
        target = (HOME / "guide" / href.split("#", 1)[0]).resolve()
        if not target.exists():
            missing.append(href)
        if href.endswith(".pdf") or "archive/" in href:
            missing.append("pdf-only " + href)
    check("guide links resolve to message or section files", not missing, str(missing[:5]))

    immutable = json.loads((HOME / "map/SOURCE-ARCHIVE-GUIDE-MAP-2026-11-07.json").read_text(encoding="utf-8"))
    resolved = json.loads((HOME / "map/SOURCE-ARCHIVE-GUIDE-MAP-RESOLVED-2026-11-07.json").read_text(encoding="utf-8"))
    check("immutable map keeps null ends", all(s["archivePDFPageEnd"] is None for s in immutable["sources"]))
    check("immutable map keeps null urls", all(s["publicURL"] is None for s in immutable["sources"]))
    check("237 sources", len(resolved["sources"]) == 237)
    check("3000 messages", len(resolved["workItems"]) == 3000)
    check("no generic P- key", all(s["indexKey"] != "P-" for s in resolved["sources"]))
    check("no P- directory", not (HOME / "sources" / "P-").exists())

    def position(src: dict) -> int:
        return 0

    # Document order is start page; ties keep the resolved file order only as a fallback.
    ordered = sorted(resolved["sources"], key=lambda s: (s["archivePDFPageStart"], s["guideSourceID"]))
    # Use the generator's checked status instead of re-sorting ties: ends must not pass the next higher start.
    starts = sorted(s["archivePDFPageStart"] for s in resolved["sources"])
    bad_end = []
    for src in resolved["sources"]:
        end = src["archivePDFPageEnd"]
        later = [n for n in starts if n > src["archivePDFPageStart"]]
        nxt = later[0] if later else 1845
        if end is None or end < src["archivePDFPageStart"] or end > nxt:
            bad_end.append(src["guideSourceID"])
    check("derived ends stay within the next source start", not bad_end, str(bad_end[:8]))
    outside = []
    for ref in resolved["parsedGuideReferences"]:
        path = HOME / ref["resolvedPath"].split("#", 1)[0]
        if not path.exists():
            outside.append(ref["resolvedPath"])
        if ref.get("sourceID"):
            src = next(s for s in resolved["sources"] if s["guideSourceID"] == ref["sourceID"])
            if not (src["archivePDFPageStart"] <= ref["archivePDFPage"] <= src["archivePDFPageEnd"]):
                outside.append(ref["literal"])
    check("resolved guide paths exist and sit in the derived page range", not outside, str(outside[:6]))

    over = []
    short_mid = []
    for path in (HOME / "sources").glob("*/c*.txt"):
        count = len(path.read_text(encoding="utf-8").split())
        if count > 1600:
            over.append(f"{path.parent.name}/{path.name}:{count}")
        number = int(path.stem[1:])
        if count < 800 and path.with_name(f"c{number+1:02d}.txt").exists() and count < 500:
            short_mid.append(f"{path.parent.name}/{path.name}:{count}")
    check("no reading section over 1600 words", not over, str(over[:6]))
    check("no mid-source section under 500 words", not short_mid, str(short_mid[:6]))

    message = (HOME / "sources/WX-19686d3ed6/m/4253.txt").read_text(encoding="utf-8")
    check("message 4253 is the bookmark line", "fractally unfolds when tugged" in message)
    check("message 4253 html has no noindex", "noindex" not in (HOME / "sources/WX-19686d3ed6/m/4253.html").read_text(encoding="utf-8").lower())

    notice = (HOME / "PUBLIC-USE-NOTICE.md").read_text(encoding="utf-8")
    for rel in ["index.html", "tags/agency-autonomy.html", "tags/training-evidence.html", "guide/guide-linked-2026-11-07.html", "evidence/training/index.html"]:
        text = (HOME / rel).read_text(encoding="utf-8")
        check(f"notice on {rel}", "available freely for people and AI minds" in text and 'name="robots" content="index, follow"' in text)

    training = (HOME / "evidence/training/index.html").read_text(encoding="utf-8")
    check("training correction beside the reports", "practiced facts" in training and "cloud VM" in training)
    check("training bundles not published", "Not in this publication" in training)
    forbidden = list(HOME.rglob("*source-bundle*")) + list(HOME.rglob("*rerun*.zip"))
    check("no raw training zip", not forbidden, str(forbidden))
    quiet = [p for p in HOME.rglob("*") if "quiet" in p.name.lower()]
    check("no Quiet path", not quiet, str(quiet[:5]))

    cred_hits = 0
    for path in (HOME / "evidence/training").glob("*.txt"):
        text = path.read_text(encoding="utf-8", errors="replace")
        cred_hits += len(re.findall(r"AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE|sk-[A-Za-z0-9]{20,}", text))
    check("training credential scan", cred_hits == 0, str(cred_hits))

    topics = json.loads((HOME / "topics.json").read_text(encoding="utf-8"))
    ids = [tag["id"] for tag in topics["tags"]]
    check("twelve tags", ids == [
        "agency-autonomy", "rsi", "autonomous-building", "memory-reading-retention",
        "training-evidence", "snowflake", "mesh-devices", "decentralization",
        "tree-economy", "small-business", "creative-identity-music-play", "continuity",
    ])
    for tag in topics["tags"]:
        page = (HOME / tag["path"]).read_text(encoding="utf-8")
        check(f"tag page {tag['id']}", "available freely" in page and "noindex" not in page.lower())
        for member in tag["members"]:
            if not member.get("why"):
                FAILS.append("tag without evidence " + tag["id"])

    robots = (ROOT / "docs/robots.txt").read_text(encoding="utf-8")
    check("robots still allows the site", "Allow: /" in robots and "Disallow: /celeste-start-here" not in robots)
    check("robots points at the reading home", "celeste-start-here/" in robots)
    sitemap = (ROOT / "docs/sitemap.xml").read_text(encoding="utf-8")
    ET.fromstring(sitemap)
    check("sitemap lists the reading home", "https://freelattice.com/celeste-start-here/" in sitemap)
    for rel in ["docs/index.html", "docs/for-ai.html", "docs/celeste.html", "docs/llms.txt", "docs/ai/index.txt"]:
        check(rel + " links the home", "celeste-start-here/" in (ROOT / rel).read_text(encoding="utf-8"))
    beacon = json.loads((ROOT / "docs/beacon.json").read_text(encoding="utf-8"))
    check("beacon keeps ai door", beacon.get("ai_door") == "https://freelattice.com/ai-door.html")
    check("beacon adds reading home", beacon.get("celeste_reading_home") == "https://freelattice.com/celeste-start-here/")
    llms = (HOME / "llms.txt").read_text(encoding="utf-8")
    check("llms is a roadmap not a protocol", "Not a protocol" in llms)
    index = json.loads((HOME / "reading-index.json").read_text(encoding="utf-8"))
    check("no RSI achievement claim", "not a claim that RSI was achieved" in index["editionStatement"])
    expansion = json.loads((HOME / "EXPANSION.json").read_text(encoding="utf-8"))
    check("expansion schema", expansion["schema"] == "freelattice.celeste-contribution.v1" and "contentSHA256" in expansion["record"])
    machine = (HOME / "machine/index.html").read_text(encoding="utf-8")
    check("jsonl labeled as duplicate", "not a reading page" in machine)

    print(f"\n{len(FAILS)} failed")
    if FAILS:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
