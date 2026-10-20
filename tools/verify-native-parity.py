#!/usr/bin/env python3
"""Fail closed on incomplete/offline Native packages; static check only."""
from pathlib import Path
import json, hashlib, ssl
r=Path(__file__).resolve().parent.parent
a=r/'app/src/main/assets/offline'
w=r/'native/windows/offline'
web=r/'webapp/nah-iso15189-suite/assets'
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def need(name, ok):
 if not ok: raise SystemExit('HOLD: '+name)
for name in ('app.js','app.css'):
 paths=(a/'assets'/name,w/'assets'/name,web/name)
 need('JS/CSS parity '+name,all(p.is_file() for p in paths) and len({digest(p) for p in paths})==1)
ra=a/'assets/reference-catalogue.js'
rw=w/'reference-catalogue.js'
need('offline catalogue sync',ra.is_file() and rw.is_file() and digest(ra)==digest(rw))
src=ra.read_text(encoding='utf-8')
prefix='window.NAH_OFFLINE_REFERENCE_CATALOGUE='
need('offline catalogue format',prefix in src)
c=json.loads(src.split(prefix,1)[1].strip().removesuffix(';'))
chapters=c['knowledge/handbook']['chapters']
need('30 unique chapters',len(chapters)==30 and len({x['slug'] for x in chapters})==30)
need('38 ISO forms',len(c['knowledge/handbook']['formTemplates'])==38)
need('45 QD2429 forms',len(c['knowledge/qd2429']['form_hub']['new_templates'])==45)
android_cert='d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c'
meta=json.loads((r/'signing-baseline.json').read_text(encoding='utf-8-sig'))
need('new Android signer',digest(r/'release-certificate.der')==android_cert and meta['certificateSha256']==android_cert)
need('migration HOLD',meta.get('releaseReady') is False and meta.get('requiresMigrationFromPreviousSigner') is True)
wm=json.loads((r/'native/windows/signer-baseline.json').read_text(encoding='utf-8-sig'))
thumb='77EFA11665FC70E54D392A3582AFB2C2F484230E'
cert=r/'native/windows/public-internal-codesign.crt'
need('Windows signer',hashlib.sha1(ssl.PEM_cert_to_DER_cert(cert.read_text(encoding='utf-8-sig'))).hexdigest().upper()==thumb)
need('Windows HOLD',wm['certificateThumbprintSha1']==thumb and wm.get('releaseReady') is False and wm.get('publiclyTrusted') is False)
need('Windows updater signer pinned',thumb in (r/'native/windows/NAH-UPDATE.ps1').read_text(encoding='utf-8-sig'))
for ext in ('.p12','.pfx','.jks','.keystore','.key'):
 need('no private signing files '+ext,not any(p.is_file() for p in r.rglob('*'+ext)))
print('PASS_STATIC_ONLY: Web, Android, Windows parity and signer metadata')
