#!/usr/bin/env python3
"""
Merge entries from verified_links.json into mapping.json.
Creates mapping keys from titles (slugified) and avoids duplicates.
Run: python merge_verified_to_mapping.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING_PATH = ROOT / "mapping.json"
VERIFIED_PATH = ROOT / "verified_links.json"


def slugify(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    if not s:
        s = "link"
    return s


def main():
    if not VERIFIED_PATH.exists():
        print(f"Verified links not found: {VERIFIED_PATH}")
        return
    if not MAPPING_PATH.exists():
        print(f"Mapping file not found, creating new one: {MAPPING_PATH}")
        mapping = {}
    else:
        mapping = json.loads(MAPPING_PATH.read_text(encoding="utf-8"))

    verified = json.loads(VERIFIED_PATH.read_text(encoding="utf-8"))
    links = verified.get("links", [])

    existing_urls = set(v.lower() for v in mapping.values())

    added = 0
    for link in links:
        url = link.get("url")
        title = link.get("title") or url
        if not url:
            continue
        if url.lower() in existing_urls:
            continue

        base = slugify(title)
        key = f"{base}.txt"
        suffix = 1
        while key in mapping:
            suffix += 1
            key = f"{base}-{suffix}.txt"

        mapping[key] = url
        existing_urls.add(url.lower())
        added += 1

    if added:
        MAPPING_PATH.write_text(json.dumps(mapping, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Added {added} entries to {MAPPING_PATH}")
    else:
        print("No new entries to add.")


if __name__ == "__main__":
    main()
