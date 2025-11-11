@echo off
echo Multiplayer Game Server (SECURE WSS) Startup
echo ==============================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found

REM Install dependencies if needed
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting Secure Game server on port 8443...
echo.
node ActionNetServerSSL.js 8443 -1
pause