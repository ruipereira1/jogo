@echo off
start cmd /k "cd backend && npm run dev"
start cmd /k "cd frontend && npm run dev"
echo Servidores backend e frontend iniciados em terminais separados.
pause 