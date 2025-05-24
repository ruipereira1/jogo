# ArteRápida Backend

Backend do jogo de desenho online ArteRápida, construído com Node.js, Express e Socket.IO.

## 🚀 Funcionalidades

- **WebSocket em tempo real** com Socket.IO
- **Sistema de salas** com códigos únicos
- **Gestão de jogadores** e pontuações
- **Sistema de rondas** personalizável
- **Rate limiting** para prevenir spam
- **Limpeza automática** de salas vazias
- **Logging estruturado** para monitorização

## 📁 Estrutura do Projeto

```
src/
├── index.js          # Servidor principal
├── gameController.js # Lógica do jogo
├── gameData.js       # Palavras e dados do jogo
├── utils.js          # Funções utilitárias
├── middleware.js     # Middleware de validação
└── logger.js         # Sistema de logging
```

## 🔧 Instalação

```bash
npm install
cp env.example .env  # Configure as variáveis de ambiente
npm run dev          # Desenvolvimento
npm start           # Produção
```

## 🌐 API WebSocket

### Eventos do Cliente

- `create-room` - Criar nova sala
- `join-room` - Entrar numa sala
- `start-game` - Iniciar o jogo
- `draw-line` - Enviar traço de desenho
- `guess` - Enviar palpite
- `chat-message` - Enviar mensagem de chat
- `clear-canvas` - Limpar canvas

### Eventos do Servidor

- `player-joined` - Jogador entrou
- `round-start` - Ronda iniciada
- `timer-update` - Atualização do timer
- `hint` - Dica progressiva
- `word-reveal` - Revelar palavra
- `game-ended` - Jogo terminado

## 🔒 Segurança

- Rate limiting por socket
- Validação de dados de entrada
- Sanitização de mensagens
- CORS configurado
- Helmet para headers de segurança

## 📊 Monitorização

O sistema inclui logging estruturado e estatísticas do servidor em tempo real. 