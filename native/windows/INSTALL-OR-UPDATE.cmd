@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL-OR-UPDATE.ps1"
if errorlevel 1 (
  echo CAP NHAT THAT BAI. Vui long kiem tra thong bao phia tren.
  pause
  exit /b 1
)
echo Hoan tat cap nhat.
exit /b 0
