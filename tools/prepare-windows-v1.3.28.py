#!/usr/bin/env python3
"""Prepare deterministic Windows Native v1.3.28 / Web v1.58.58; HOLD for internal QA.

The patch was generated against the supplied canonical v1.58.58 Web package.
It checks source and target SHA-256, leaves Android source/keys untouched, and
never manipulates user-specific WebView2 data.
"""
import argparse
import base64
import hashlib
import json
import zlib
from pathlib import Path

BASE = "1.3.27"
RELEASE = "1.3.28"
WEB_OLD = "1.58.56"
WEB_NEW = "1.58.58"
TEMPLATE_BASE = "https://sachyhoc.com/wp-admin/admin-post.php?action=nah_iso15189_template_download&kind="


def sha256(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def checked_replace(s, old, new, label, count=None):
    n = s.count(old)
    if n == 0 or (count is not None and n != count):
        raise RuntimeError(f"{label}: expected {count or 'one or more'} occurrences of {old!r}, got {n}")
    return s.replace(old, new)


def write_if_different(path, content):
    if not path.is_file():
        raise RuntimeError(f"Missing required source: {path}")
    if path.read_text(encoding="utf-8-sig") != content:
        path.write_text(content, encoding="utf-8", newline="\n")


def patch_asset(src, spec):
    digest = sha256(src)
    if digest == spec["new"]:
        return src
    if digest != spec["old"]:
        raise RuntimeError(f"Asset baseline mismatch: {digest} (not expected v1.58.56 source)")
    pos, buf = 0, []
    for start, end, replacement in spec["ops"]:
        if start < pos or end < start or end > len(src):
            raise RuntimeError("Invalid patch position")
        buf.extend((src[pos:start], replacement))
        pos = end
    buf.append(src[pos:])
    target = "".join(buf)
    if sha256(target) != spec["new"]:
        raise RuntimeError("Web v1.58.58 target SHA-256 mismatch")
    return target


def main(root):
    win = root / "native/windows"
    if not (win / "native_webview2.c").is_file():
        raise RuntimeError("Expected complete GitHub Native Windows source checkout")
    patch_file = Path(__file__).with_name("windows-v1.3.28-webdiff.b64")
    specs = json.loads(zlib.decompress(base64.b64decode(patch_file.read_text(encoding="ascii").strip())).decode("utf-8"))
    assets = {}
    for name, spec in specs.items():
        path = win / "offline/assets" / name
        content = patch_asset(path.read_text(encoding="utf-8"), spec)
        write_if_different(path, content)
        assets[name] = spec["new"]
        if name in ("app.js", "app.css"):
            write_if_different(win / name, content)

    for name in ["native_webview2.c", "NAH-UPDATE.ps1"]:
        p = win / name
        s = p.read_text(encoding="utf-8-sig")
        if BASE in s:
            s = checked_replace(s, BASE, RELEASE, name)
        elif RELEASE not in s:
            raise RuntimeError(f"{name}: cannot find Windows version")
        write_if_different(p, s)

    res = win / "MAKE-RESOURCES.py"
    s = res.read_text(encoding="utf-8-sig")
    if BASE in s:
        s = s.replace(BASE, RELEASE).replace("(27<<16)", "(28<<16)")
    if RELEASE not in s or "(27<<16)" in s:
        raise RuntimeError("Win32 manifest version mismatch")
    write_if_different(res, s)

    for name in ["desktop-mirror.js", "offline/desktop-mirror.js"]:
        p = win / name
        s = p.read_text(encoding="utf-8-sig")
        s = s.replace("const VERSION='1.3.25'", f"const VERSION='{RELEASE}'")
        s = s.replace("Windows Native v1.3.25", "Windows Native v" + RELEASE)
        s = s.replace('1.58.52', WEB_NEW).replace(WEB_OLD, WEB_NEW)
        if f"const VERSION='{RELEASE}'" not in s or "version:'1.58.58'" not in s:
            raise RuntimeError(f"{name}: cannot update mirror version")
        write_if_different(p, s)

    for name in ["offline/index.html", "offline-index.html"]:
        p = win / name
        s = p.read_text(encoding="utf-8-sig")
        s = s.replace(BASE, RELEASE).replace(WEB_OLD, WEB_NEW)
        marker = '"appIconUrl": "assets/app-logo.png"'
        if '"dataTemplateBaseUrl"' not in s:
            inject = (
                marker + ', "csvTemplateBaseUrl": "' + TEMPLATE_BASE +
                '", "dataTemplateBaseUrl": "' + TEMPLATE_BASE +
                '", "importTemplateUrl": "' + TEMPLATE_BASE + 'bulk-xlsx"'
            )
            s = checked_replace(s, marker, inject, name, 1)
        if '"version": "1.58.58"' not in s or "Windows v1.3.28" not in s or '"dataTemplateBaseUrl"' not in s:
            raise RuntimeError(f"{name}: HTML version/template config invalid")
        write_if_different(p, s)

    p = win / "offline/service-worker.js"
    s = p.read_text(encoding="utf-8-sig")
    if WEB_OLD in s:
        s = s.replace(WEB_OLD, WEB_NEW)
    write_if_different(p, s)

    p = win / "signer-baseline.json"
    meta = json.loads(p.read_text(encoding="utf-8-sig"))
    meta["version"] = RELEASE
    meta["webVersion"] = WEB_NEW
    if meta.get("releaseReady") is not False or meta.get("publiclyTrusted") is not False:
        raise RuntimeError("Signing release gates must stay internal/HOLD")
    write_if_different(p, json.dumps(meta, ensure_ascii=False, indent=2) + "\n")

    for name, expected in assets.items():
        actual = sha256((win / "offline/assets" / name).read_text(encoding="utf-8"))
        if actual != expected:
            raise RuntimeError(f"Post-write SHA-256 mismatch: {name}")
    c = (win / "native_webview2.c").read_text(encoding="utf-8")
    if "NAHISONative/1.3.28" not in c or "NAHLABDesktop/1.3.28" not in c:
        raise RuntimeError("Native EXE user-agent version mismatch")
    print("PASS: Windows v1.3.28 / Web v1.58.58 canonical asset SHA-256")
    print("PASS: Desktop template URLs configured; WebView2 data unchanged")
    print("HOLD: Internal signer only; Android v1.1.15 still targets Web v1.58.56")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    main(args.repo_root.resolve())
