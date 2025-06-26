# 🏗️ Build e Produção - ArteRápida v2.5

## 📋 Pré-requisitos

- Node.js 16.0.0 ou superior
- npm instalado
- Git configurado

## 🔧 Build de Desenvolvimento

### Opção 1: Scripts Automáticos (Recomendado)
```bash
# Windows
.\iniciar_servidor.bat      # Backend apenas
.\iniciar_frontend.bat      # Frontend apenas
.\iniciar_completo.ps1      # Ambos automaticamente
```

### Opção 2: Manual
```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend  
cd frontend
npm install
npm run dev
```

## 🚀 Build de Produção

### Build Completo
```bash
# Windows
.\build.bat

# Manual
cd backend && npm install --omit=dev
cd frontend && npm install && npm run build
```

### Executar em Produção
```bash
# Windows
.\producao.bat

# Manual
set NODE_ENV=production
cd backend
node src/index.js
```

## 📊 Informações do Build

### Frontend Build
- **Arquivos gerados**: `frontend/dist/`
- **Tamanho total**: ~346 KB
- **Assets principais**:
  - `index.html` (6.7 KB)
  - `index-DMgKcIZ_.css` (50.5 KB) 
  - `index-BUcSCeMb.js` (88.7 KB)
  - `socket-TjCxX7sJ.js` (41.3 KB)
  - `vendor-CHzv1uSW.js` (159.5 KB)

### Backend Build
- **Arquivos**: `backend/src/`
- **Dependências**: Apenas produção instaladas
- **Porta**: 4000 (configurável via PORT env)

## 🌐 Deploy

### Modo Produção
Em produção, o backend serve automaticamente os arquivos do frontend:
- Backend API: `http://localhost:4000/api/*`
- Frontend: `http://localhost:4000/*`
- WebSocket: `http://localhost:4000/socket.io/`

### Variáveis de Ambiente
```bash
NODE_ENV=production        # Modo produção
PORT=4000                 # Porta do servidor (padrão: 4000)
```

### Estrutura de Deploy
```
backend/
├── src/                  # Código do servidor
├── package.json         # Dependências
└── node_modules/        # Módulos (apenas produção)

frontend/
└── dist/                # Build compilado
    ├── index.html       # Página principal
    ├── assets/          # JS/CSS compilados
    ├── manifest.json    # PWA manifest
    └── sw.js           # Service Worker
```

## 🔍 Verificação do Build

### Checklist de Qualidade
- ✅ TypeScript compila sem erros
- ✅ Vite build bem-sucedido  
- ✅ Todas as dependências instaladas
- ✅ Backend inicia sem erros
- ✅ APIs respondem corretamente
- ✅ WebSocket conecta
- ✅ Frontend carrega

### Testes Rápidos
```bash
# Verificar sintaxe backend
node -c backend/src/index.js

# Verificar build frontend
cd frontend && npm run build

# Testar servidor produção
NODE_ENV=production node backend/src/index.js
```

## 📈 Performance

### Otimizações Implementadas
- **Vite**: Build otimizado com tree-shaking
- **Compressão**: Gzip automático (52KB vendor)
- **Code Splitting**: Arquivos separados por funcionalidade
- **CSS**: Minificado e otimizado
- **Assets**: Cache busting com hash

### Métricas de Build
- **Tempo de build**: ~1.5s
- **Módulos transformados**: 75
- **Compression ratio**: ~65% (gzip)

## 🚨 Troubleshooting

### Problemas Comuns

**1. Erro de porta em uso**
```bash
# Verificar processo na porta 4000
netstat -ano | findstr :4000
# Matar processo se necessário
taskkill /PID <PID> /F
```

**2. Dependências não encontradas**
```bash
# Limpar e reinstalar
rm -rf node_modules package-lock.json
npm install
```

**3. Build falha**
```bash
# Verificar versão Node.js
node --version  # Deve ser 16+
# Limpar cache
npm cache clean --force
```

## 📞 Suporte

Em caso de problemas:
1. Verificar logs do console
2. Confirmar versões de Node.js e npm
3. Validar variáveis de ambiente
4. Testar em modo desenvolvimento primeiro

---
**ArteRápida v2.5** - Sistema completo de desenho multiplayer 🎨 