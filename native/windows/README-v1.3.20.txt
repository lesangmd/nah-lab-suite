NAH LAB SUITE Windows Native v1.3.20 — Taskbar implicit identity experiment
Baseline: Windows v1.3.19 + WebApp v1.58.30.

- Removes SetCurrentProcessExplicitAppUserModelID. The native window uses Windows' normal executable-path grouping.
- Installer recreates the Start Menu shortcut with a stable target and removes older explicit AppUserModelID values from native pinned shortcuts, preserving browser/PWA pins.
- Keeps logo, WebView2 profile, app content, business logic, session and sync unchanged.
- Installer logs warnings on native shortcut repairs that fail. Inspect install-taskbar-diagnostics.txt and taskbar-check.txt.
- Requires real Windows Explorer pin/group regression testing. Compilation alone cannot prove Taskbar grouping.
- Do not remove WebView2 user data or reset the app to diagnose this fault.
