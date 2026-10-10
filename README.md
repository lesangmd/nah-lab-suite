# NAH LAB SUITE Android 1.1.6 — Web 1.58.12

Package vn.nah.iso15189suite; versionCode 11006; Android 8+; target SDK 35.

Bundled public HTML/CSS/JS match Web 1.58.12. Existing account vault and signing identity are preserved. First UI renders before network sync. Older cached UI falls back to bundled 1.58.12; newer server UI is retained. UI refresh runs even when the account dataset has not changed. Authentication and operational data still use the server and encrypted account-scoped cache. No test credentials or mock operational data are bundled.

Build: Gradle 8.9, JDK 17, Android SDK 35, `gradle :app:assembleRelease`. The resulting unsigned APK is validation only. Use the existing permanent signing secrets and certificate fingerprint in SIGNING.md to produce an installable update. No new signing key is generated.

CI validates compilation and release identity. The isolated native-sync-web-1.58.12 branch also attempts the existing permanent-key signing workflow; it fails closed if secrets are missing.
