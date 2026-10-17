NAH LAB SUITE Windows Native v1.3.12 / Web v1.58.29

Desktop branding + Taskbar identity regression remediation
- Replace old white ISO 15189 mark in splash/login/mobile/header with the already-bundled canonical green microscope icon-512.png, matching application icon and Android branding.
- Keep native process explicit AppUserModelID NAH.LAB.SUITE (unchanged); set and verify this same ID in Start Menu shortcuts via ShellLink IPropertyStore.
- Repair NAH-LAB-SUITE.exe shortcuts under the current user's TaskBar pinned folder, including outdated executable paths, without touching unrelated pinned applications.
- Install to stable %LOCALAPPDATA%\Programs\NAH LAB SUITE so pinned and running Windows identities resolve to the same executable.
- Preserve WebView2 profile, IndexedDB dataset and existing online-first synchronization flow from v1.3.11.
- Installer does not restart Windows Explorer, unpin unrelated apps or erase user data. Cached legacy Windows pins may need one manual re-pin.

Build: clang x86_64-pc-windows-msvc and lld-link; MAKE-RESOURCES.py embeds canonical icon and updates PE resources to 1.3.12.
NOTE: Actual Windows 10/11 Taskbar and WebView2 device testing is still required. The installer contains a readback check for the persisted shortcut AppID.
