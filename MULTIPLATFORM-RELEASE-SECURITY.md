# NAH LabSuite v1.58.56 — Multi-platform source and signing policy

Android source is at repository root; Windows sources are under `native/windows/`; macOS arm64 under `native/macos/`; WordPress code subset under `webapp/nah-iso15189-suite/`.

Public repository caution: generated APK, EXE, private signing keys, passwords, the WebApp operational JSON data directory, internal PDFs and bundled earlier installation archives are deliberately excluded. The WebApp folder is a **source subset**, not a WordPress installation ZIP. Use the separately provided verified WordPress package for deployment.

## Android

- Application ID: `vn.nah.iso15189suite`
- Version: `1.1.15` / versionCode `11015`; Web asset baseline: `1.58.56`
- Last confirmed install-over signer baseline: Android v1.1.12
- Signer certificate SHA-256: `76a2a3289bd26bc255caa3465f609a1b83992b3f4fe0b44813e67296e01d52ac`
- GitHub Secrets needed in repository (never push these values): `NAH_ANDROID_KEYSTORE_B64`, `NAH_ANDROID_KEY_ALIAS`, `NAH_ANDROID_KEYSTORE_PASSWORD`, `NAH_ANDROID_KEY_PASSWORD`, `NAH_ANDROID_CERT_SHA256`.
- The signing workflow is **manual-only**; failed source checks or mismatched signer MUST stop release.
- Before publishing: `apksigner verify --print-certs`, `aapt dump badging`, SHA-256, `adb install -r` over the previous version on a consented device, verify offline drafts and encrypted local data remain available.

## Windows

- Version `1.3.27` / Web `1.58.56` source and unsigned test package.
- No trusted Authenticode publisher identity is currently supplied, so **no signed release can be made here**. Have the owner procure/import a long-term code-signing certificate in a secure Windows signing machine/CI vault.
- Never silently replace unsigned EXEs. Require successful `Get-AuthenticodeSignature`, matching publisher certificate thumbprint, a pinned SHA-256 manifest and rollback tests; only then allow in-place updates.
- Keep Windows user WebView2 profile outside the install directory, and preserve pending offline draft queues before changing files.

## macOS

- Apple Silicon arm64 source only. Developer ID Application certificate and Apple notarization are needed for signed distribution.

## Current release gate

All platforms remain **HOLD / RC** until release signing and install-over/data-preservation QA on physical devices. Do not set server update manifest `releaseReady=true` until the exact signed artifacts have been tested.
