# NAH LAB SUITE Android 1.1.7 — Version Label & Modern Hero

Web UI 1.58.13; package vn.nah.iso15189suite; versionCode 11007; Android 8+.

This update reuses the permanent baseline key established by 1.1.6 on 2026-10-10. Install over that signed baseline; uninstall only versions older than that signing baseline. Synchronize any local-only data before uninstalling; Android removes the app vault during uninstall. Future updates must retain this package ID and baseline signing certificate and increment versionCode.

The signed APK passed apksigner verification (v2/v3), certificate identity and zip alignment checks. Compiled payload matches successful the release validation CI run for this commit. No physical Android installation test has been performed.

UI matches Web 1.58.12. Bundled public shell replaces older UI caches and preserves newer ones. UI refresh also runs when the account dataset is unchanged. No test account or mock operational data is included.

Build with JDK17, Gradle8.9 and SDK35: gradle :app:assembleRelease. See SIGNING.md for the locked certificate and future signing setup. Private key material belongs only in the separate owner backup and Actions secrets, never in Git.

Login labels derive from the actual native User-Agent; the updater reads BuildConfig.VERSION_CODE and VERSION_NAME. The Hero uses a responsive brand gradient and preserves the full requested title.
