#!/usr/bin/env python3
"""Fail closed: release requires correct Android assets, signer and migration QA."""
from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent.parent
assets={'app/src/main/assets/offline/assets/app.js':'cae4b9c9bfac2ce2bcf39e63c31bf447115e91bb2f8c40232b510499f52fd287','app/src/main/assets/offline/assets/app.css':'875cfc55da8e9252354b5848827e5b86e28510f1d4707786648742cd810f92ff'}
for rel,want in assets.items():
 p=r/rel
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=want: raise SystemExit('HOLD: stale or absent '+rel)
cert='d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c'
if hashlib.sha256((r/'release-certificate.der').read_bytes()).hexdigest()!=cert: raise SystemExit('HOLD: Android certificate mismatch')
s=json.loads((r/'signing-baseline.json').read_text())
for k,want in {'certificateSha256':cert,'baselineVersion':'1.1.15','releaseVersion':'1.1.15','releaseVersionCode':11015,'webVersion':'1.58.56','requiresMigrationFromPreviousSigner':True,'releaseReady':False}.items():
 if s.get(k)!=want: raise SystemExit('HOLD: wrong signing metadata '+k)
gradle=(r/'app/build.gradle').read_text()
for token in ["applicationId 'vn.nah.iso15189suite'","versionName '1.1.15'",'versionCode 11015']:
 if token not in gradle: raise SystemExit('HOLD: wrong Android version '+token)
factory=(r/'app/src/main/java/vn/nah/iso15189suite/FactoryShell.java').read_text()
if 'static final String VERSION = "1.58.56"' not in factory or 'native-shell-v1.58.56/assets/' not in factory: raise SystemExit('HOLD: stale Android factory shell')
update=(r/'app/src/main/java/vn/nah/iso15189suite/UpdateManager.java').read_text()
if cert not in update: raise SystemExit('HOLD: updater lacks pinned new certificate')
html=(r/'app/src/main/assets/offline/index.html').read_text()
if '"version": "1.58.56"' not in html or 'native-shell-v1.58.56/assets/' not in html: raise SystemExit('HOLD: stale offline index')
main=(r/'app/src/main/java/vn/nah/iso15189suite/MainActivity.java').read_text()
if 'android-v1.1.15-web-v1.58.56' not in main: raise SystemExit('HOLD: stale MainActivity')
print('PASS: source/signer integrity; release still HOLD until device migration QA')
