# NAH LAB SUITE Android 1.1.6 — NEW SIGNING BASELINE

Web UI 1.58.12; package vn.nah.iso15189suite; versionCode 11006; Android 8+.

This is the first release signed with the new permanent baseline key authorized on 2026-10-10. Uninstall the old app before installing this release. Synchronize any local-only data before uninstalling; Android removes the app vault during uninstall. Future updates must retain this package ID and baseline signing certificate and increment versionCode.

The signed APK passed apksigner verification (v2/v3), certificate identity and zip alignment checks. Compiled payload matches successful CI run 38051253727. No physical Android installation test has been performed.

UI matches Web 1.58.12. Bundled public shell replaces older UI caches and preserves newer ones. UI refresh also runs when the account dataset is unchanged. No test account or mock operational data is included.

Build with JDK17, Gradle8.9 and SDK35: gradle :app:assembleRelease. See SIGNING.md for the locked certificate and future signing setup. Private key material belongs only in the separate owner backup and Actions secrets, never in Git.
