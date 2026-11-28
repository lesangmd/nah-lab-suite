#!/usr/bin/env python3
"""Stage Android v1.1.17 with exact, SHA-256-pinned NAH Web v1.58.94 assets.
Build-only: no credentials, user data, app ID or existing signing certificate changed.
"""
import hashlib
from pathlib import Path
import urllib.request

R=Path(__file__).resolve().parents[1]
WEB="1.58.94"
BASE="https://www.sachyhoc.com/wp-content/plugins/nah-iso15189-suite_/assets/"
DIGESTS={
    "app.js":"55a876c327ba381fa0737e463eceb93b373e0dacfc757853e5b7ab701ec2a998",
    "app.css":"8c2a025a1d0cdcce9762b38ee449d245b4c7c1e6933e2996cfe73dda105d40a7",
    "service-worker.js":"cbe864407abeec6245e7bafe4e3d029219c0f0c7167c2081dc5ea98735c6fd63"
}
CERT="d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c"
def checked_replace(path,old,new):
    path=R/path
    data=path.read_text(encoding="utf-8-sig")
    if old not in data and new not in data:
        raise RuntimeError("Unrecognized source baseline: "+str(path)+" missing "+old)
    path.write_text(data.replace(old,new),encoding="utf-8",newline="\n")

def main():
    if hashlib.sha256((R/"release-certificate.der").read_bytes()).hexdigest()!=CERT:
        raise RuntimeError("Android original signer certificate changed")
    import json
    m=json.loads((R/"signing-baseline.json").read_text())
    if m["certificateSha256"]!=CERT or m["applicationId"]!="vn.nah.iso15189suite":
        raise RuntimeError("Signer/package mismatch")
    for name,expected in DIGESTS.items():
        req=urllib.request.Request(BASE+name,headers={"User-Agent":"NAH-LabSuite/1.1.16","Accept":"application/javascript,text/css,*/*","Cache-Control":"no-cache"})
        with urllib.request.urlopen(req,timeout=90) as src:
            body=src.read()
        found=hashlib.sha256(body).hexdigest()
        if found!=expected:
            raise RuntimeError(f"Live Web asset {name} SHA256 mismatch: {found} != {expected}; refuse build")
        (R/"app/src/main/assets/offline/assets"/name).write_bytes(body)
        print(f"PINNED_WEB_{name}: {len(body)} bytes, {found}")
    checked_replace("app/build.gradle","versionCode 11015","versionCode 11017")
    checked_replace("app/build.gradle","versionName '1.1.15'","versionName '1.1.17'")
    checked_replace("app/src/main/java/vn/nah/iso15189suite/FactoryShell.java","1.58.56",WEB)
    checked_replace("app/src/main/assets/offline/index.html","1.58.56",WEB)
    checked_replace("app/src/main/assets/offline/index.html","Android v1.1.15","Android v1.1.17")
    activity=R/"app/src/main/java/vn/nah/iso15189suite/MainActivity.java"
    s=activity.read_text(encoding="utf-8-sig")
    before="final int backdrop = dark ? Color.rgb(14, 33, 27) : Color.rgb(243, 251, 247);"
    after="final int backdrop = dark ? Color.rgb(14, 29, 45) : Color.WHITE;"
    if before not in s and after not in s: raise RuntimeError("Unknown Android window baseline")
    s=s.replace(before,after)
    before_insets="""                    return insets;
                });
            }
        } else {"""
    after_insets="""                    // Native root has already reserved the status/navigation and cutout insets.
                    // Do not pass them again to WebView CSS safe-area calculations.
                    return new WindowInsets.Builder(insets)
                            .setInsets(WindowInsets.Type.systemBars()
                                    | WindowInsets.Type.displayCutout(),
                                    android.graphics.Insets.NONE)
                            .build();
                });
            }
        } else {"""
    if before_insets not in s and after_insets not in s: raise RuntimeError("Unknown Android insets baseline")
    s=s.replace(before_insets,after_insets)
    activity.write_text(s,encoding="utf-8",newline="\n")
    gradle=(R/"app/build.gradle").read_text()
    if "versionCode 11017" not in gradle or "versionName '1.1.17'" not in gradle or "applicationId 'vn.nah.iso15189suite'" not in gradle:
        raise RuntimeError("Android versionName/versionCode/applicationId mismatch")
    if after not in s or after_insets not in s: raise RuntimeError("Edge-to-edge patch not applied")
    for name,expected in DIGESTS.items():
        if hashlib.sha256((R/"app/src/main/assets/offline/assets"/name).read_bytes()).hexdigest()!=expected: raise RuntimeError("Final asset mismatch")
    print("PASS: Android 1.1.17, signer baseline preserved, Web 1.58.94 pinned, inset patch applied")
if __name__=="__main__":
    main()
