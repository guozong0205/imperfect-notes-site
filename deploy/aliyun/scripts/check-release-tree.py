#!/usr/bin/env python3
"""Check a pinned Imperfect Notes tree before it is served.

The checker does not modify files. It confirms local links resolve, and that
/self and /ziwei are real pages rather than a synthetic 404.
"""

from __future__ import annotations

import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

EXTERNAL = []
MISSING = []
CHECKED = 0

SKIP_SCHEMES = ("http://", "https://", "mailto:", "data:", "javascript:", "tel:")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        for key in ("href", "src", "poster"):
            value = data.get(key)
            if value:
                self.refs.append(value)
        srcset = data.get("srcset")
        if srcset:
            for part in srcset.split(","):
                token = part.strip().split()
                if token:
                    self.refs.append(token[0])


def local_target(page: Path, root: Path, ref: str) -> Path | None:
    ref = ref.strip()
    if not ref or ref.startswith("#") or ref.startswith(SKIP_SCHEMES):
        if ref.startswith(("http://", "https://")):
            EXTERNAL.append(ref.split("#", 1)[0])
        return None
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    if not ref:
        return None
    if ref.startswith("/"):
        return root / ref.lstrip("/")
    return (page.parent / ref).resolve()


def expect_file(path: Path, root: Path, why: str) -> None:
    global CHECKED
    CHECKED += 1
    if path.is_dir():
        path = path / "index.html"
    try:
        path.relative_to(root)
    except ValueError:
        MISSING.append(f"{why}: escapes tree -> {path}")
        return
    if not path.is_file():
        MISSING.append(f"{why}: missing {path.relative_to(root)}")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check-release-tree.py ROOT", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    required = [
        "index.html",
        "style.css",
        "script.js",
        "robots.txt",
        "sitemap.xml",
        "data/episodes.json",
        "self/index.html",
        "self/self.css",
        "self/self.js",
        "self/engine/engine.mjs",
        "self/vendor/engine-libs.mjs",
        "self/start/index.html",
        "self/r/index.html",
        "self/sample/index.html",
        "ziwei/index.html",
        "shop/index.html",
        "privacy/index.html",
        "refund/index.html",
        "terms/index.html",
        "assets/beian/ghs.png",
        "assets/logo/favicon.svg",
    ]
    for rel in required:
        expect_file(root / rel, root, rel)

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".html", ".css"}:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        refs: list[str] = []
        if path.suffix.lower() == ".html":
            parser = LinkParser()
            parser.feed(text)
            refs.extend(parser.refs)
        for raw in re.findall(r"url\(\s*([^)]+)\)", text):
            refs.append(raw.strip().strip("'\""))
        for ref in refs:
            target = local_target(path, root, ref)
            if target is not None:
                expect_file(target, root, f"{path.relative_to(root)} -> {ref}")

    episodes = json.loads((root / "data/episodes.json").read_text(encoding="utf-8"))
    sized = {"ep09", "ep10", "ep11", "ep17", "ep26"}
    for episode in episodes["episodes"]:
        cover = episode["cover"]
        expect_file(root / cover, root, f"episode {episode['ep']} cover")
        stem = Path(cover).stem
        expect_file(root / f"assets/covers/sm/{stem}.jpg", root, f"episode {episode['ep']} sm jpg")
        expect_file(root / f"assets/covers/sm/{stem}.webp", root, f"episode {episode['ep']} sm webp")
        if stem in sized:
            expect_file(root / f"assets/covers/md/{stem}.jpg", root, f"episode {episode['ep']} md jpg")
            expect_file(root / f"assets/covers/md/{stem}.webp", root, f"episode {episode['ep']} md webp")
        for key in ("mp3Url", "wallpaperUrl", "youtubeUrl"):
            value = episode.get(key, "")
            if value.startswith(("http://", "https://")):
                EXTERNAL.append(value)

    self_html = (root / "self/index.html").read_text(encoding="utf-8")
    ziwei_html = (root / "ziwei/index.html").read_text(encoding="utf-8")
    home = (root / "index.html").read_text(encoding="utf-8")
    if 'location.replace("/")' not in self_html:
        MISSING.append("self/index.html lost its client redirect to /")
    if "ziwei-interpreter.imperfectnotes.workers.dev" not in ziwei_html:
        MISSING.append("ziwei/index.html lost the worker endpoint")
    if "辽ICP备2026023787号-1" not in home:
        MISSING.append("homepage lost the ICP number")
    if (root / "CNAME").exists() or (root / ".gitignore").exists():
        MISSING.append("release contains CNAME or .gitignore, which GitHub Pages does not serve")
    if (root / "assets/pay/alipay-qr.png").exists():
        MISSING.append("release contains a payment QR; current main does not")

    print(f"checked_local_refs {CHECKED}")
    print(f"external_urls {len(set(EXTERNAL))}")
    if MISSING:
        print("MISSING")
        for item in MISSING:
            print(item)
        return 1
    print("release_tree_ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
