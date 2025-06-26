@echo off
echo 🏗️ Fazendo Build do ArteRápida...
echo.

echo 📦 Instalando dependências do backend (produção)...
cd backend
call npm install --omit=dev
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências do backend
    pause
    exit /b 1
)

echo ✅ Backend pronto para produção!
echo.

echo 📦 Instalando dependências do frontend...
cd ../frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Erro ao instalar dependências do frontend
    pause
    exit /b 1
)

echo 🏗️ Fazendo build do frontend...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Erro no build do frontend
    pause
    exit /b 1
)

echo ✅ Frontend compilado para produção!
echo.

cd ..
echo 🎉 Build concluído com sucesso!
echo.
echo 📁 Arquivos gerados:
echo   - Backend: backend/src/
echo   - Frontend: frontend/dist/
echo.
echo 🚀 Para rodar em produção:
echo   1. Configure NODE_ENV=production
echo   2. Execute: node backend/src/index.js
echo   3. O frontend será servido automaticamente
echo.
pause 