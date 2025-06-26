@echo off
echo 🚀 Iniciando ArteRápida em Modo Produção...
echo.

echo 🔧 Configurando variáveis de ambiente...
set NODE_ENV=production
set PORT=4000

echo 📡 Iniciando servidor de produção na porta %PORT%...
echo.
echo ✅ Servidor rodando! Acesse: http://localhost:%PORT%
echo 🎯 Para parar o servidor, pressione Ctrl+C
echo 📊 Frontend e Backend integrados
echo.

cd backend
node src/index.js 