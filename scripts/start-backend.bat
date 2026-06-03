@echo off
echo ====================================================
echo Starting FastAPI Backend (Python 3.11.5)...
echo ====================================================
cd ..\backend
C:\Users\nguye\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
pause
