Windows native 1.3.9 / Web 1.58.22
Build on Windows: BUILD-X64.cmd with Clang, lld-link and Python.
The packaged x64 executable was produced by patch_resources.py from the previously compiled v1.3.4 launcher: it replaces all icon, version and manifest resources in place and updates the user-agent version. The native host logic is otherwise unchanged. Requires Pillow for make_ico.py.
The same source can be compiled normally with BUILD-X64.cmd when a working toolchain is available. Keeps account profile and mirror schema. Desktop source remains outside GitHub.

INSTALL-OR-UPDATE.ps1 đặt bản chạy vào đường dẫn cố định cho taskbar và giữ WebView2 profile. desktop-mirror.js yêu cầu phiên đã xác thực trước khi cấp bootstrap tài khoản.

Bản v1.3.10 (13/10/2026): Offline Web 1.58.28, 5 mốc + giám sát tài liệu ISO, mirror online-first.

Windows 1.3.11 (14/10/2026): Full mirror mandatory on first login; no fake factory data; version-aware 60-second manifest sync, atomic authenticated snapshot. Web shell 1.58.29.

Branding and Taskbar identity v1.3.12: see README-v1.3.12.txt
