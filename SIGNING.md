# Android 1.1.6 new permanent signing baseline

The owner authorized a new signing key and uninstall/reinstall migration on 2026-10-10. The old signing identity is retired for this release stream.

Locked identity: package vn.nah.iso15189suite, baseline versionName 1.1.6, versionCode 11006. Public certificate SHA256: 6b33b13104b53c124e5b675c10223306dcbdefbd05674a86be94793473b6790d

Keep the separate private backup securely. It contains the JKS and credentials required for every future in-place update. Never regenerate the key, commit the backup, or distribute it with the APK. Increase versionCode for each future APK.

To configure future builds, restore the five existing Actions secret names from this new backup: NAH_ANDROID_KEYSTORE_B64, NAH_ANDROID_KEY_ALIAS, NAH_ANDROID_KEYSTORE_PASSWORD, NAH_ANDROID_KEY_PASSWORD, NAH_ANDROID_CERT_SHA256. tools/CONFIGURE-BASELINE-v1.1.6.ps1 reads the backup on the owner's trusted Windows computer, validates the expected certificate, and configures these secrets. It never generates a replacement key.

The workflow rejects a certificate that differs from signing-baseline.json. Run Build signed Android release on the current candidate branch with version 1.1.6 and code 11006, or use the same secrets for later releases. The delivered baseline APK was signed locally; Actions signing requires these secrets to be configured separately.

Before initial installation, synchronize local-only data, uninstall the old app, install the signed baseline APK, log in and let account data synchronize again. Future versions signed with this new key can update in place.
