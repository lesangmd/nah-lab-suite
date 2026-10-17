NAH LAB SUITE Windows Native v1.3.14 / Web v1.58.29

Corrective release: Restore canonical WebApp identity and repair native Taskbar grouping.

1. WEBAPP LOGO RESTORED EXACTLY
   - Restore original app-logo.png (1024x1024) and the bundled icon series,
     icon.ico, SVG and ICNS from the unmodified WebApp v1.58.29 package.
   - Splash, login, mobile login and main header load assets/app-logo.png.
   - Windows executable and shortcuts use WebApp-provided icon.ico.
   - No change to the deployed WordPress WebApp/Android code or its backend.

2. TASKBAR FIX
   - Use the same explicit AppUserModelID NAH.LAB.SUITE on native process,
     top-level HWND (IPropertyStore), and Start Menu / native Taskbar .lnk.
   - Set HWND identity before first ShowWindow: avoid transient separate group.
   - Set per-window relaunch command and native icon resource.
   - Installer verifies .lnk AppID and notifies Explorer when changing it.
   - Clicking the launcher again activates the existing native HWND, instead
     of creating a separate already-running message box.

3. NO FUNCTIONAL REGRESSION INTENDED
   - Preserve Web v1.58.29 content, v1.3.13 non-blocking login, inline 30px
     background-sync status, account-bound IndexedDB mirror and user profile.
   - Windows x64 compile, JS smoke tests and ZIP integrity verified.

INSTALL
   Close app fully. Extract all contents, run INSTALL-OR-UPDATE.cmd.
   Installation path: %LOCALAPPDATA%\Programs\NAH LAB SUITE.
   No previous WebView2 profile is removed.

CAVEAT
   On Windows, Taskbar pins created by an older PWA or Windows-cached pin may
   continue to reference a different application identity. Once upgraded,
   if there are still two Taskbar buttons, unpin only the obsolete NAH LAB
   icon and pin the launched native window again. Do not unpin other apps.
   Windows 10/11 shell + WebView2 UI integration must be verified on device.
   Executable is not Authenticode-signed.
