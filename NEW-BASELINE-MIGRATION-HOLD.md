# Android v1.1.15 — new signer (candidate only)

Package ID stays `vn.nah.iso15189suite` and release certificate SHA-256 is `d528e789425c8914d5034c98c00aff8b1f407fee4fdd5584683cbfe81218752c`.

**HIGH-RISK MIGRATION:** Apps signed with prior certificate `76a2a3289bd26bc255caa3465f609a1b83992b3f4fe0b44813e67296e01d52ac` cannot be overwritten by this new-signer APK on Android. Installation fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`; do NOT bypass with uninstall on a device holding unsynced data. Back up/sync all data, verify server receipt, then only with user consent change installations. Offline AES/account data and WebView storage are likely deleted by uninstall. Alternative: preserve old signer or create a separate new package ID for side-by-side migration (outside scope).

This baseline is not publicly released. GitHub Secrets and physical device QA required. Manifest Android `releaseReady=false`, `available=false`. **Do not enable auto-update across a signer change.**
