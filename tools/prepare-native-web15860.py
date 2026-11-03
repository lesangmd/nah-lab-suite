#!/usr/bin/env python3
"""Source-only staging of NAH LabSuite native clients against exact deployed Web 1.58.60.
Fail closed: hashes below are from the user-supplied canonical Web 1.58.60 ZIP.
This does not modify application databases, sign binaries, or publish updates.
"""
from pathlib import Path
import hashlib
import json
import urllib.request
import sys

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://www.sachyhoc.com/wp-content/plugins/nah-iso15189-suite_/assets/'
DIGESTS = {
    'app.js': '75b87f4014bae853e34915df98a0329c62479e1d638e93ea53755ace0ea0ebc8',
    'app.css': '1ad375c7ccaa8bbb59fc0b89a7dc8229e6cb5cddc1f4bac5fe73d4e1faba7d6f',
    'service-worker.js': 'e6ba5451fa1dd1a57858b2e201b190a3f4ff1e6c333bb599647c63d43abd89b1',
}

def replace_checked(path, old, new, required=True):
    path = ROOT / path
    s = path.read_text(encoding='utf-8-sig')
    if old not in s:
        if required and new not in s:
            raise RuntimeError(f'Expected old/new token missing in {path}: {old}')
        return
    path.write_text(s.replace(old, new), encoding='utf-8', newline='\n')

def main():
    health_url = 'https://www.sachyhoc.com/wp-json/nah-iso15189/v1/health'
    with urllib.request.urlopen(health_url, timeout=35) as resp:
        health = json.load(resp)
    if not health.get('ok') or health.get('version') != '1.58.60':
        raise RuntimeError('Live server is no longer Web v1.58.60; hold build')

    assets = {}
    for name, expected in DIGESTS.items():
        with urllib.request.urlopen(URL + name, timeout=65) as resp:
            body = resp.read()
        digest = hashlib.sha256(body).hexdigest()
        if digest != expected:
            raise RuntimeError(f'Live asset mismatch {name}: {digest} not {expected}')
        assets[name] = body

    for plat in (
        'webapp/nah-iso15189-suite/assets',
        'native/windows',
        'native/windows/offline/assets',
        'app/src/main/assets/offline/assets',
    ):
        for name in ('app.js', 'app.css'):
            dest = ROOT / plat / name
            if not dest.is_file():
                raise RuntimeError(f'Native mirror missing: {dest}')
            dest.write_bytes(assets[name])
    for plat in ('webapp/nah-iso15189-suite/assets',
                 'native/windows/offline/assets',
                 'app/src/main/assets/offline/assets'):
        (ROOT / plat / 'service-worker.js').write_bytes(assets['service-worker.js'])

    # Offline HTML and Android's URL-to-bundled-file allow-list must point
    # to the new local assets; preserve package ID and all user storage.
    android_html = 'app/src/main/assets/offline/index.html'
    replace_checked(android_html, '1.58.56', '1.58.60')
    replace_checked(android_html, 'Android v1.1.15', 'Android v1.1.16')
    replace_checked('app/src/main/java/vn/nah/iso15189suite/FactoryShell.java',
                    '1.58.56', '1.58.60')
    replace_checked('app/build.gradle', "versionCode 11015", "versionCode 11016")
    replace_checked('app/build.gradle', "versionName '1.1.15'", "versionName '1.1.16'")

    # Desktop retains the exact WebView2 persistence, update trust policy,
    # read-only offline mirror and account/device-scoped IndexedDB names.
    for html in ('native/windows/offline/index.html',
                 'native/windows/offline-index.html'):
        replace_checked(html, '1.58.56', '1.58.60')
        replace_checked(html, 'Windows v1.3.27', 'Windows v1.3.29')
    for js in ('native/windows/desktop-mirror.js',
               'native/windows/offline/desktop-mirror.js'):
        replace_checked(js, '1.3.25', '1.3.29')
        replace_checked(js, '1.58.52', '1.58.60', required=False)
        replace_checked(js, '1.58.56', '1.58.60', required=False)
        if "version:'1.58.60'" not in (ROOT / js).read_text(encoding='utf-8'):
            raise RuntimeError('Desktop mirror version not updated: '+js)
    replace_checked('native/windows/offline/service-worker.js',
                    'nah-lab-suite-desktop-v1.3.20-activityfix',
                    'nah-lab-suite-desktop-v1.3.29-web-v1.58.60')
    replace_checked('native/windows/native_webview2.c', '1.3.27', '1.3.29')
    replace_checked('native/windows/MAKE-RESOURCES.py', '1.3.27', '1.3.29')
    replace_checked('native/windows/MAKE-RESOURCES.py', '(27<<16)', '(29<<16)')
    replace_checked('native/windows/NAH-UPDATE.ps1', '1.3.27', '1.3.29')
    signer_path = ROOT / 'native/windows/signer-baseline.json'
    signer = json.loads(signer_path.read_text(encoding='utf-8-sig'))
    if signer['certificateThumbprintSha1'] != '77EFA11665FC70E54D392A3582AFB2C2F484230E':
        raise RuntimeError('Windows signer changed')
    if signer.get('releaseReady') is not False or signer.get('publiclyTrusted') is not False:
        raise RuntimeError('Windows release gate cannot be opened')
    signer['version'] = '1.3.29'
    signer['webVersion'] = '1.58.60'
    signer_path.write_text(json.dumps(signer, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

    if "applicationId 'vn.nah.iso15189suite'" not in (ROOT / 'app/build.gradle').read_text():
        raise RuntimeError('Android package ID changed')
    for path in ('webapp/nah-iso15189-suite/assets/app.js',
                 'native/windows/offline/assets/app.js',
                 'app/src/main/assets/offline/assets/app.js'):
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest() != DIGESTS['app.js']:
            raise RuntimeError('Web JS mirror mismatch: '+path)
    for name in ('app.js', 'app.css'):
        if hashlib.sha256((ROOT/'native/windows/offline/assets'/name).read_bytes()).hexdigest()!=DIGESTS[name]:
            raise RuntimeError('Desktop asset mismatch '+name)
    if 'webThemeProbe' not in (ROOT/'app/src/main/java/vn/nah/iso15189suite/MainActivity.java').read_text():
        raise RuntimeError('Android native adaptive theme patch missing')
    print('PASS: Web v1.58.60 exact JS/CSS/SW digests; mirrored native source; Android 1.1.16 / Windows 1.3.29')
    print('HOLD: publication and real-device usability require separate UAT')

if __name__ == '__main__':
    main()
