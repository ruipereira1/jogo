@echo off
echo Iniciando projeto Jogo de Desenho...

echo Abrindo terminal para o backend...
start cmd /k "cd backend && npm run dev"

echo Abrindo terminal para o frontend...
start cmd /k "cd frontend && npm run dev"

echo Todos os componentes iniciados!
echo Use Ctrl+C para encerrar cada terminal individualmente. 