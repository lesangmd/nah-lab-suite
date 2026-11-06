#!/usr/bin/env python3
"""Set Windows Native executable identity to 1.3.31 for exact Web 1.58.63 QA.
No changes to persistence paths, installer, credentials, users or server endpoints.
Only C host version, resource metadata, signed updater version and manifest metadata.
"""
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]
WIN=ROOT/'native/windows'
OLD='1.3.27'
NEW='1.3.31'
WEB='1.58.63'
THUMB='77EFA11665FC70E54D392A3582AFB2C2F484230E'

def bump(rel, special=None):
    p=WIN/rel
    x=p.read_text(encoding='utf-8-sig')
    if OLD not in x and NEW not in x:
        raise RuntimeError(f'Unexpected version baseline in {rel}')
    y=x.replace(OLD,NEW)
    if special:
        before, after=special
        if before in y:
            y=y.replace(before,after)
        if after not in y:
            raise RuntimeError(f'Version resource not correct in {rel}')
    if y != x:
        p.write_text(y,encoding='utf-8',newline='\n')
    return y

def main():
    host=bump('native_webview2.c')
    if 'NAHISONative/1.3.31 NAHLABDesktop/1.3.31' not in host:
        raise RuntimeError('Version in Windows native user agent not updated')
    res=bump('MAKE-RESOURCES.py', ('(27<<16)','(31<<16)'))
    if 'assemblyIdentity version="1.3.31.0"' not in res:
        raise RuntimeError('PE manifest still old')
    updater=bump('NAH-UPDATE.ps1')
    if THUMB not in updater or 'nah-iso15189-suite_?' not in updater:
        raise RuntimeError('Pinned original signer or plugin folder compatibility missing')
    p=WIN/'signer-baseline.json'
    m=json.loads(p.read_text(encoding='utf-8-sig'))
    if m['certificateThumbprintSha1'] != THUMB:
        raise RuntimeError('Signer identity drift')
    if m.get('releaseReady') is not False or m.get('publiclyTrusted') is not False:
        raise RuntimeError('Cannot promote internal QA to public release')
    m['version']=NEW
    m['webVersion']=WEB
    p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    for required in ('INSTALL-OR-UPDATE.ps1','INSTALL-OR-UPDATE.cmd','NAH-UPDATE.cmd','offline/index.html'):
        if not (WIN/required).is_file():
            raise RuntimeError('Missing installer/native resource: '+required)
    print('PASS: Windows Native 1.3.31 user agent, PE VERSIONINFO, PE manifest, updater version')
    print('PASS: retained original Windows signer; Web 1.58.63 target; QA HOLD')
if __name__=='__main__':
    main()
