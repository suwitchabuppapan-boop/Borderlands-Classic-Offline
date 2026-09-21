@echo off
setlocal
cd /d "%~dp0"
echo Borderlands Classic - Divine Pride Importer (Internet required for import only)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\import-divine-pride.ps1"
if errorlevel 1 (
  echo Import stopped. Game is still playable offline.
) else (
  echo Import script completed. Reload index.html and open Codex.
)
pause
