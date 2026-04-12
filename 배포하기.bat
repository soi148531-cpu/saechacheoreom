@echo off
cd /d "%~dp0"
if exist ".git\index.lock" del /f ".git\index.lock"
git add .
git commit -m "feat: implement Kakao message state"
git push
pause
