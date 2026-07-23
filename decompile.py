#!/usr/bin/env python3
"""
Decompile the Chargebee JS bundle from its public webpack source maps.

Steps:
  1. Download the entry bundle (chargebee.js) and its .map.
  2. Extract the original sources embedded in the map's `sourcesContent`.
  3. Parse the webpack bootstrap in the minified bundle to recover:
       - the public path  (e.g. /assets/cbjs-2026.07.22-07.07/v2/)
       - the chunk manifest  ({chunkId: contentHash, ...})
  4. Rebuild every async chunk URL, download each chunk's .map and extract
     its `sourcesContent` too.
  5. Everything is written into a single reconstructed source tree.

The same script is used locally and by the weekly GitHub Actions workflow.
"""

import concurrent.futures
import json
import os
import re
import shutil
import sys
import urllib.request
import urllib.error

# --- configuration ----------------------------------------------------------

HOST = "https://js.chargebee.com"
ENTRY_JS = f"{HOST}/v2/chargebee.js"
ENTRY_MAP = f"{HOST}/v2/chargebee.js.map"

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(REPO_ROOT, "unminified")   # reconstructed source tree
RAW_DIR = os.path.join(REPO_ROOT, "dist")         # raw entry bundle + map

MAX_WORKERS = 16
USER_AGENT = "chargebee-source-decompiler/1.0 (+https://github.com/uukelele/chargebee-source-code)"


# --- helpers -----------------------------------------------------------------

def fetch(url, binary=False):
    """Fetch a URL, returning bytes (binary=True) or str. None on 404."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    return data if binary else data.decode("utf-8", "replace")


def source_to_path(src):
    """Turn a webpack source id into a safe relative file path."""
    path = re.sub(r"^webpack://", "", src)
    path = path.lstrip("/")            # drop leading /// -> ''
    path = path.replace("://", "/")    # any remaining scheme separators
    path = path.replace("..", "__")    # avoid escaping the output dir
    path = path.lstrip("./")
    return path or "unknown"


def extract_map(map_text, out_dir):
    """Write every non-null sourcesContent entry of a source map to disk.

    Returns (written, skipped)."""
    try:
        m = json.loads(map_text)
    except (json.JSONDecodeError, TypeError):
        return 0, 0
    sources = m.get("sources", [])
    contents = m.get("sourcesContent", [])
    written = skipped = 0
    for src, content in zip(sources, contents):
        if content is None:
            skipped += 1
            continue
        dest = os.path.join(out_dir, source_to_path(src))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(content)
        written += 1
    return written, skipped


def parse_bootstrap(js_text):
    """Extract the public path and chunk manifest from the minified bundle."""
    pub = re.search(r'\.p\s*=\s*"([^"]+)"', js_text)
    public_path = pub.group(1) if pub else "/"

    # The manifest is the object literal indexed by chunkId inside jsonpScriptSrc:
    #   ...+"-"+{0:"hash",1:"hash",...}[chunkId]+".js"
    manifest = {}
    for obj in re.findall(r'\+"-"\+(\{[^{}]+\})\[', js_text):
        try:
            # keys may be bare numbers -> quote them for JSON parsing
            normalized = re.sub(r'([{,])(\d+):', r'\1"\2":', obj)
            manifest.update(json.loads(normalized))
        except json.JSONDecodeError:
            continue
    return public_path, manifest


# --- main pipeline -----------------------------------------------------------

def main():
    print(f"[*] entry bundle: {ENTRY_JS}")
    js_text = fetch(ENTRY_JS)
    map_text = fetch(ENTRY_MAP)
    if js_text is None or map_text is None:
        sys.exit("!! failed to download entry bundle or its map")

    # keep a copy of the raw entry artefacts
    os.makedirs(RAW_DIR, exist_ok=True)
    with open(os.path.join(RAW_DIR, "chargebee.js"), "w", encoding="utf-8") as f:
        f.write(js_text)
    with open(os.path.join(RAW_DIR, "chargebee.js.map"), "w", encoding="utf-8") as f:
        f.write(map_text)

    # fresh reconstructed tree
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(OUT_DIR, exist_ok=True)

    w, s = extract_map(map_text, OUT_DIR)
    print(f"[+] entry map: {w} sources written ({s} without content)")

    public_path, manifest = parse_bootstrap(js_text)
    print(f"[*] public path : {public_path}")
    print(f"[*] chunks found: {len(manifest)}")
    if not manifest:
        print("[!] no chunk manifest found - only the entry bundle was extracted")
        return

    def do_chunk(item):
        chunk_id, chash = item
        url = f"{HOST}{public_path}{chunk_id}-{chash}.js.map"
        text = fetch(url)
        if text is None:
            return chunk_id, None, 0
        written, _ = extract_map(text, OUT_DIR)
        return chunk_id, url, written

    total_written = 0
    ok = missing = 0
    items = sorted(manifest.items(), key=lambda kv: int(kv[0]))
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        for chunk_id, url, written in ex.map(do_chunk, items):
            if url is None:
                missing += 1
            else:
                ok += 1
                total_written += written
    print(f"[+] chunks decompiled: {ok} ok, {missing} missing (404)")
    print(f"[+] total chunk sources written: {total_written}")
    print(f"[✓] reconstructed source tree -> {OUT_DIR}")


if __name__ == "__main__":
    main()
