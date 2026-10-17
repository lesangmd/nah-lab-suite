#!/usr/bin/env python3
"""Fail closed on stale offline assets, signing identity or version metadata."""
from pathlib import Path
import hashlib, json
root=Path(__file__).resolve().parent.parent
expected={'app/src/main/assets/offline/assets/app.js':'cae4b9c9bfac2ce2bcf39e63c31bf447115e91bb2f8c40232b510499f52fd287',
'app/src/main/assets/offline/assets/app.css':'875cfc55da8e9252354b5848827e5b86e28510f1d4707786648742cd810f92ff'}
for name, digest in expected.items():
 p=root/name
 if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=digest: raise SystemExit('HOLD: outdated '+name)
cert='76a2a3289bd26bc255caa3465f609a1b83992b3f4fe0b44813e67296e01d52ac'
p=root/'release-certificate.der'
if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=cert: raise SystemExit('HOLD: signer changed')
s=json.loads((root/'signing-baseline.json').read_text())
if s.get('certificateSha256')!=cert or s.get('releaseVersionCode')!=11015 or s.get('webVersion')!='1.58.56': raise SystemExit('HOLD: metadata mismatch')
gradle=(root/'app/build.gradle').read_text()
for token in ["applicationId 'vn.nah.iso15189suite'",'versionCode 11015',"versionName '1.1.15'"]:
 if token not in gradle: raise SystemExit('HOLD: missing '+token)
f=(root/'app/src/main/java/vn/nah/iso15189suite/FactoryShell.java').read_text()
if 'static final String VERSION = "1.58.56"' not in f: raise SystemExit('HOLD: FactoryShell outdated')
h=(root/'app/src/main/assets/offline/index.html').read_text()
if '"version": "1.58.56"' not in h: raise SystemExit('HOLD: index outdated')
print('SOURCE GATE PASS')
