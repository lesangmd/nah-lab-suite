# NAH LabSuite Android — Permanent signing baseline (14 October 2026)

**Application ID:** `vn.nah.iso15189suite`  
**New baseline:** Android `1.1.12` / `versionCode 11012`  
**Signing keystore:** PKCS12, alias `nah-labsuite-release`  
**Certificate SHA-256:** `76a2a3289bd26bc255caa3465f609a1b83992b3f4fe0b44813e67296e01d52ac`

The new signer supersedes Android 1.1.11's previous certificate. **Uninstall Android 1.1.11 or earlier before installing this new baseline; preserve server-side data first.** Future releases must use the **same** PKCS12 keystore and certificate and increase `versionCode`. Never generate another routine signing key or silently change the package ID or fingerprint.

The release keystore and all passwords are private and **must never be committed into this public repository, an APK, or the WordPress plugin**. The user owns an encrypted PKCS12 backup and must configure these GitHub Actions repository secrets locally using authenticated GitHub CLI:

- `NAH_ANDROID_KEYSTORE_B64` — base64 of the PKCS12 bytes (single line).
- `NAH_ANDROID_KEY_ALIAS` — `nah-labsuite-release`.
- `NAH_ANDROID_KEYSTORE_PASSWORD` — keystore password.
- `NAH_ANDROID_KEY_PASSWORD` — same password for this PKCS12 entry.
- `NAH_ANDROID_CERT_SHA256` — the exact fingerprint above without colons.

Use the private `CAI-DAT-GITHUB-SECRETS.cmd` from the protected owner recovery kit (downloaded separately; not stored in GitHub). This performs `gh secret set -f - --repo lesangmd/nah-lab-suite` and transmits the values to GitHub Actions Secrets; only the secret names can be listed afterward. These secrets **have not been configured by ChatGPT** because the GitHub connector lacks the needed API permission.

Run the GitHub Actions `build-signed-release.yml` workflow on `release/android-v1.1.12-nah-labsuite`. Require successful compilation, zipalign, `apksigner verify --print-certs`, the pinned certificate check, checksum and an install test on an Android device before declaring production. Release candidate WebApp v1.58.32 is not production until these checks and user acceptance pass.

**Windows Native baseline is locked at v1.3.20 Taskbar behavior.** Do not change its process/window identification while working on Android releases.
