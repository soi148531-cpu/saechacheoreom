@echo off
chcp 65001 > nul
echo.
echo ====================================
echo   Rev_1 롤백 시작
echo   (날짜버그+성능최적화+실외실내분리
echo    +원원버그수정+입금완료필터)
echo ====================================
echo.

set ROOT="%~dp0..\.."

echo [1/5] app\(admin)\dashboard\page.tsx 복원 중...
copy /Y "%~dp0app\(admin)\dashboard\page.tsx" "%ROOT%\app\(admin)\dashboard\page.tsx"

echo [2/5] app\staff\page.tsx 복원 중...
copy /Y "%~dp0app\staff\page.tsx" "%ROOT%\app\staff\page.tsx"

echo [3/5] app\(admin)\billing\page.tsx 복원 중...
copy /Y "%~dp0app\(admin)\billing\page.tsx" "%ROOT%\app\(admin)\billing\page.tsx"

echo [4/5] lib\services\messageService.ts 복원 중...
copy /Y "%~dp0lib\services\messageService.ts" "%ROOT%\lib\services\messageService.ts"

echo [5/5] types\index.ts 복원 중...
copy /Y "%~dp0types\index.ts" "%ROOT%\types\index.ts"

echo.
echo ====================================
echo   완료! Rev_1 롤백 성공
echo ====================================
echo.
pause
