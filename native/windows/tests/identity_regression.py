"""Static regression checks for WebApp branding and Windows native Taskbar ID.
Run from the root of NAH-LAB-SUITE-Windows-Source with python tests/identity_regression.py.
"""
import hashlib
from pathlib import Path

base=Path(__file__).resolve().parents[1]
expected={
    'app-logo.png':'0898e5b0b3b7e0e653ad',
    'icon-512.png':'5dbecdfb30e7df48a2f6',
    'icon-192.png':'30212a7d7291a747d8',
    'icon.ico':'1fd6bd7feffa605a40',
}
for filename,sha in expected.items():
    path=base/'offline'/'assets'/filename
    got=hashlib.sha256(path.read_bytes()).hexdigest()
    assert got.startswith(sha), (filename,got)
    print('PASS original WebApp asset',filename)
assert (base/'icon.ico').read_bytes()!=(base/'offline/assets/icon.ico').read_bytes()
from PIL import Image
assert Image.open(base/'icon.ico').convert('RGBA').getextrema()[3]==(255,255)
assert Image.open(base/'offline/assets/app-logo.png').getextrema()[3][0]<255
html=(base/'offline/index.html').read_text()
assert html.count('src="assets/app-logo.png"')>=4
assert 'src="assets/icon-512.png"' not in html
assert '"appIconUrl": "assets/app-logo.png"' in html
print('PASS Splash, Login, Mobile Login, Header original brand URLs')
source=(base/'native_webview2.c').read_text()
installer=(base/'INSTALL-OR-UPDATE.ps1').read_text(encoding='utf-8-sig')
assert 'SHGetPropertyStoreForWindow(window,' not in source
assert 'SetCurrentProcessExplicitAppUserModelID(APP_ID)' not in source
assert 'set_window_taskbar_identity(g_hwnd)' not in source
assert 'No per-window AppUserModelID' in source
assert 'WS_OVERLAPPEDWINDOW|WS_CLIPCHILDREN|WS_VISIBLE' not in source
assert 'FindWindowW(APP_CLASS,0)' in source and 'SetForegroundWindow(existing)' in source
assert 'ClearShortcutAppId($shortcutPath)' in installer
assert 'ClearShortcutAppId($item.FullName)' in installer
assert 'SetShortcutAppId(' not in installer
assert 'RefreshShellShortcut' in installer
assert 'fullSync' in (base/'offline/desktop-mirror.js').read_text()
print('PASS Taskbar implicit process/window identity; EXE path pin; reuse existing HWND')
