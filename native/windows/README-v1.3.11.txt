NAH LAB SUITE Windows Native v1.3.11 / Web v1.58.29

Server-first + persistent authenticated snapshot; no bundled factory business database.
- First login requires a successful full mirror download and atomic IndexedDB commit. A blocking progress popup is shown only during initial hydration.
- All API reads use live server first when network works; offline reads use only a completed snapshot belonging to the current account.
- Manifest checks every 60 seconds in foreground; full refresh when version changed or mirror >10 minutes old, on login/reconnect/mutation. Foreground focus triggers a check.
- Native exit preserves the WebView2 user data directory; logout still clears sensitive account records.
- If the process is entirely closed, no sync runs; freshness is revalidated at next startup.
- IMPORTANT: End-to-end Windows WebView2 verification and server integration tests are required before production release.
