@echo off
rem Lantern Sea launcher: installs dependencies when missing, builds the current version, then serves the game and opens it in your browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules\peerjs ( echo Installing dependencies... & call npm install || (pause & exit /b 1) )
if not exist public\assets\manifest.json ( echo Downloading CC0 assets from Poly Haven... & call node scripts\fetch-assets.mjs )
echo Building... & call npm run build || (pause & exit /b 1)
echo Starting Lantern Sea at http://localhost:4173 ... close this window to stop the game server.
call npx vite preview --port 4173 --open
