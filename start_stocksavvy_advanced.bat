@echo off
setlocal enabledelayedexpansion

echo Starting StockSavvy...

:: Get the current directory
set "CURRENT_DIR=%~dp0"
echo Current directory: %CURRENT_DIR%

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python and try again
    pause
    exit /b 1
)

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js and try again
    pause
    exit /b 1
)

:: Check if required directories exist
if not exist "%CURRENT_DIR%backend" (
    echo Error: Backend directory not found at: %CURRENT_DIR%backend
    echo Please make sure this batch file is in the root directory of your project
    echo Expected directory structure:
    echo StockSavvy\
    echo ├── backend\
    echo ├── frontend\
    echo └── start_stocksavvy_advanced.bat
    pause
    exit /b 1
)

if not exist "%CURRENT_DIR%frontend" (
    echo Error: Frontend directory not found at: %CURRENT_DIR%frontend
    echo Please make sure this batch file is in the root directory of your project
    pause
    exit /b 1
)

:: Start the backend server
echo Starting backend server...
start cmd /k "cd /d %CURRENT_DIR%backend && python manage.py runserver"

:: Start the frontend server
echo Starting frontend server...
start cmd /k "cd /d %CURRENT_DIR%frontend && npm run dev"

:: Wait for servers to start
echo Waiting for servers to start...
timeout /t 5

:: Open the browser
echo Opening browser...
start http://localhost:5173

echo.
echo StockSavvy is starting up...
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:5173
echo.
echo Please wait for both servers to fully start...
echo Press any key to exit this window...
pause >nul 