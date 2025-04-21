@echo off
echo Starting StockSavvy...

:: Start the backend server
start cmd /k "cd backend && python manage.py runserver"

:: Start the frontend server
start cmd /k "cd frontend && npm run dev"

:: Wait a few seconds for servers to start
timeout /t 5

:: Open the browser
start http://localhost:5173

echo StockSavvy is starting up...
echo Backend will be available at: http://localhost:8000
echo Frontend will be available at: http://localhost:5173
echo Please wait for both servers to fully start... 