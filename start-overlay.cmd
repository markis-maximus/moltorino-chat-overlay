@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is needed only for the optional local URL server.
  echo The HTML files in dist work directly as an OBS Browser Local file without Node.js.
  pause
  exit /b 1
)
node server.mjs
pause
