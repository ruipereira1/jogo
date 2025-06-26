# Script PowerShell para iniciar ArteRápida completo
Write-Host "🎮 Iniciando ArteRápida - Sistema Completo" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Iniciando Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '📡 Backend rodando na porta 4000' -ForegroundColor Green; node src/index.js"

Write-Host "⏳ Aguardando 3 segundos..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "🎨 Iniciando Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '🌐 Frontend rodando na porta 5173' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "✅ Ambos os servidores foram iniciados!" -ForegroundColor Green
Write-Host "📡 Backend: http://localhost:4000" -ForegroundColor Cyan
Write-Host "🌐 Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Para parar os servidores, feche as janelas do PowerShell" -ForegroundColor Yellow 