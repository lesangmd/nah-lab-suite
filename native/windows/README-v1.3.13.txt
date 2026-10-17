NAH LAB SUITE Windows Native v1.3.13 / Web v1.58.29

Background Sync UX (non-blocking login)
- After authenticated login: go directly into workspace after live bootstrap; full mirror runs asynchronously.
- Main workspace only shows a 30px inline status strip while dataset manifest/full mirror is being fetched, and brief success indication.
- First successful full mirror is durably written to IndexedDB; subsequent sessions reuse this snapshot for offline read-only access.
- The background process refreshes at startup/reconnect/window focus and polls every minute, fetching the full mirror when dataset changes or its age threshold is reached.
- When mirror fetch fails, preserve prior account-scoped snapshot; no popup or automatic logout. A small retry link appears.
- Online APIs are server-first, offline writes are forbidden, and login always requires validated server authentication.
- Preserve all branding, Taskbar shortcut identity, stable install location, and WebApp v1.58.29 logic.

IMPORTANT: First login without a previously persisted snapshot cannot access offline modules until full hydration succeeds. On a poor connection, online pages can still use live REST requests; errors in missing offline data are reported honestly.

Windows 10/11 WebView2 integration tests remain necessary before a production rollout. EXE is unsigned.
