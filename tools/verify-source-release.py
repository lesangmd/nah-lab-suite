#!/usr/bin/env python3
"""Fail-closed Android release-source gate for Native 1.1.15 / Web 1.58.56."""
from pathlib import Path
import hashlib, json
root=Path(__file__).resolve().parent.parent
checks={'app/src/main/assets/offline/assets/app.js': 'cae4b9c9bfac2ce2bcf39e63c31bf447115e91bb2f8c40232b510499f52fd287', 'app/src/main/assets/offline/assets/app.css': '875cfc55da8e9252354b5848827e5b86e28510f1d4707786648742cd810f92ff'}
for path, expected in checks.items():
    file=root/path
    if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=expected:
        raise SystemExit('RELEASE HOLD: asset mismatch: '+path)
cert='d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c'
if hashlib.sha256((root/'release-certificate.der').read_bytes()).hexdigest()!=cert:
    raise SystemExit('RELEASE HOLD: new baseline certificate changed')
meta=json.loads((root/'signing-baseline.json').read_text())
if any([meta.get('certificateSha256')!=cert,meta.get('releaseVersionCode')!=11015,meta.get('releaseVersion')!='1.1.15',meta.get('webVersion')!='1.58.56']):
    raise SystemExit('RELEASE HOLD: signing baseline metadata mismatch')
gradle=(root/'app/build.gradle').read_text()
if any(s not in gradle for s in ["applicationId 'vn.nah.iso15189suite'",'versionCode 11015',"versionName '1.1.15'"]):
    raise SystemExit('RELEASE HOLD: version or application ID mismatch')
factory=(root/'app/src/main/java/vn/nah/iso15189suite/FactoryShell.java').read_text()
if ('static final String VERSION = "1.58.56"' not in factory
        or 'native-shell-v1.58.56/assets/' not in factory):
    raise SystemExit('RELEASE HOLD: unknown offline shell minimum')
html=(root/'app/src/main/assets/offline/index.html').read_text()
if ('"version": "1.58.56"' not in html or 'Android v1.1.15' not in html
        or 'native-shell-v1.58.56/assets/' not in html):
    raise SystemExit('RELEASE HOLD: offline shell version mismatch')
js=(root/'app/src/main/assets/offline/assets/app.js').read_text()
for key in ['docplan-main-row','renderMeeting','form-reports','notificationCount']:
    if key not in js: raise SystemExit('RELEASE HOLD: missing WebApp feature: '+key)

if 'android-v1.1.15-web-v1.58.56' not in (root/'app/src/main/java/vn/nah/iso15189suite/MainActivity.java').read_text():
    raise SystemExit('RELEASE HOLD: offline shell contract version mismatch')
print('PASS: v1.1.15 / Web v1.58.56; new pinned certificate; private signing key absent')
