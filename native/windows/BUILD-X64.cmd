@echo off
setlocal
cd /d "%~dp0"
where clang.exe >nul 2>nul || (echo clang.exe not found & exit /b 2)
where lld-link.exe >nul 2>nul || (echo lld-link.exe not found & exit /b 2)
if not exist app.res (
  where python.exe >nul 2>nul || (echo app.res missing and python.exe not found & exit /b 2)
  python.exe MAKE-RESOURCES.py || exit /b 2
)
for %%D in (kernel32 user32 gdi32 shell32 ole32) do (
  lld-link /lib /machine:x64 /def:%%D.def /out:%%D.lib || exit /b 3
)
clang --target=x86_64-pc-windows-msvc -D_WIN64 -fno-stack-protector -ffreestanding -fno-builtin -fno-asynchronous-unwind-tables -mno-stack-arg-probe -Wall -Wextra -c native_webview2.c -o native_webview2.obj || exit /b 4
lld-link /machine:x64 /subsystem:windows /entry:wWinMainCRTStartup /nodefaultlib /timestamp:0 /out:NAH-LAB-SUITE.exe native_webview2.obj app.res kernel32.lib user32.lib gdi32.lib shell32.lib ole32.lib || exit /b 5
echo Build PASS: NAH-LAB-SUITE.exe
