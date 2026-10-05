# NAH LAB SUITE Android v1.1.5 — Instant Local Shell Startup

- Parent: v1.1.4 Login Update UX Hotfix.
- Source-only candidate: no production APK is released until a persistent NAH Android release keystore is locked.
- Preserves the last-known-good WebApp shell across routine native upgrades instead of deleting it.
- Loads the cached HTML shell directly with the canonical HTTPS base URL before any refresh.
- Lets the native Activity render one frame before WebView initialization to shorten the system splash phase.
- When logged out, reveals the login form as soon as the local document is committed instead of waiting for startup network checks to finish.
- Moves Core Hydration, Deep Hydration, shell refresh, JobScheduler and update checks behind the first visible UI.
- Core synchronization begins after the UI is visible; Deep Hydration is delayed for 60 seconds.
- Shell refresh occurs only after successful core reconciliation and never blocks first paint.
- Persistent Offline Vault, account isolation, silent sync and in-app updater behavior are retained.

# NAH LAB SUITE Android v1.1.4 — Login Update UX Hotfix

- Parent: v1.1.3 Persistent Offline Vault & In-App Updater.
- Removes native injection of “Kiểm tra cập nhật” from the login form.
- Background update check remains silent after app start; popup is shown only when a newer Android version is available.
- No update-control text is rendered on the login screen.
- Shell contract moves to android-v1.1.4-web-v1.50 so stale cached login assets are invalidated once.
- Persistent Offline Vault, dataset-aware sync, deep hydration and in-app installer logic are otherwise unchanged.

# NAH LAB SUITE Android v1.1.3 — Persistent Offline Vault & In-App Updater

- Parent: v1.1.2 Fast Core Hydration.
- Requires Web v1.47.
- Logout/session expiry revokes offline authorization but retains encrypted hydrated data and forms.
- Same account re-login reuses the vault immediately after online identity validation.
- Different account login clears the previous account vault before new hydration.
- Core sync checks dataset manifest first and skips mirror download when datasetVersion is unchanged.
- Full/deep hydration remains silent and persistent.
- Automatic update check uses Web v1.47 app/update-manifest.
- Update APK is downloaded in-app, SHA-256 verified, then handed to Android Package Installer.
- Android still requires user approval for package installation; stable in-place upgrades require one persistent NAH release signing key.

# NAH LAB SUITE Android v1.1.2 — Fast Core Hydration & Deferred Deep Sync

- Parent: v1.1.1.
- Requires Web v1.46 for compact scope=core hydration.
- Immediate post-login/startup hydration stores Dashboard, bootstrap, module lists and common overview/knowledge data first.
- Full deep hydration is deferred until after initial UI use, then refreshed on a 12-hour cadence.
- 5-minute foreground and 15-minute background refreshes use the compact core mirror rather than rebuilding the full mirror.
- Static content bundle refresh is limited to a 24-hour cadence.
- Core rows merge into SQLite so deep detail cache is preserved.
- Retains AES/GCM Android Keystore encryption, 30-day validated offline reads, server-canonical writes, original approved launcher logo and silent synchronization.

# NAH LAB SUITE Android v1.1.0 — Full Offline Hydration & Silent Delta Sync

Parent: Android v1.0.11 clean-build / visual identity hotfix.

Architecture
- First login still requires Internet.
- After an authenticated session is available, the app silently downloads the account-visible read model from `/desktop/mirror/full`.
- The mirror is decomposed into endpoint-shaped entries and stored in encrypted SQLite.
- The current WebApp HTML/CSS/JS/image shell is also cached locally after the first online run.
- Subsequent WebView GET requests are served local-first from the encrypted endpoint cache, so modules can open without waiting for repeated server reads.
- Server remains canonical. Foreground sync runs every 5 minutes; Android JobScheduler performs periodic network-constrained background refreshes.
- Sync is silent: no online/offline/sync audit badge is added to user UI.
- Explicit Logout clears account-sensitive offline endpoint data.
- Cached account data is eligible for offline reading for up to 30 days from the last successful server validation.
- Large Drive/evidence binary files are not bulk-downloaded; metadata is hydrated and binaries continue to use the existing download/cache-on-use path.

Security
- Offline database rows and cached shell resources are encrypted with an AES/GCM key stored in Android Keystore.
- Passwords are never persisted by this layer.
- SSL errors remain fail-closed.
- No JavaScript bridge is introduced.

Write policy
- v1.1.0 prioritizes full offline READ hydration.
- Server-confirmed business mutations continue to require network; this avoids falsely acknowledging controlled QMS writes while disconnected.

Identity
- package: `vn.nah.iso15189suite`
- versionCode: 11000
- versionName: 1.1.0
- User-Agent: `NAHISOAndroid/1.1.0`
- endpoint: `https://sachyhoc.com/nah-lab-iso/`
