const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Importar banco de palavras
const { WORDS_FACIL, WORDS_MEDIO, WORDS_DIFICIL, getRandomWord } = require('./words');

const app = express();
const server = http.createServer(app);

// Configuração de CORS mais robusta
const corsOptions = {
  origin: function (origin, callback) {
    // Em desenvolvimento, permite qualquer origem para localhost
    if (!origin) return callback(null, true);
    
    // Lista de origens permitidas
    const allowedOrigins = [
      'https://desenharapido.netlify.app',
      'https://jogo-0vuq.onrender.com', 
      'https://arte-rapida.onrender.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000'
    ];
    
    // Verificar se a origem está permitida
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Em desenvolvimento, permite localhost com qualquer porta
    if (process.env.NODE_ENV !== 'production' && origin && origin.includes('localhost')) {
      console.log('CORS - Origem localhost permitida em desenvolvimento:', origin);
      return callback(null, true);
    }
    
    // Log da origem para debug apenas em desenvolvimento
    if (process.env.NODE_ENV !== 'production') {
      console.log('CORS - Origem não permitida:', origin);
    }
    
    return callback(new Error('Não permitido pelo CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
};

const io = socketIo(server, {
  cors: corsOptions,
  // Configurações para melhorar a conexão
  pingTimeout: 60000, // 60 segundos
  pingInterval: 25000, // 25 segundos
  transports: ['websocket', 'polling'], // Permite fallback para polling se websocket falhar
  allowEIO3: true, // Compatibilidade com versões anteriores
  // Configurações de reconexão
  connectionStateRecovery: {
    // Duração máxima para tentar recuperar a conexão
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutos
    // Permitir recuperação se o cliente se desconectar e reconectar rapidamente
    skipMiddlewares: true,
  }
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Log middleware para debug
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
  next();
});

// Rota de health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Servidor ArteRápida funcionando!',
    cors: 'enabled'
  });
});

// Servir arquivos estáticos em produção
if (process.env.NODE_ENV === 'production') {
  // Servir arquivos estáticos do React
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  
  // Todas as rotas que não são da API devem retornar o index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist', 'index.html'));
  });
}

app.get('/', (req, res) => {
  res.json({ 
    message: 'Servidor ArteRápida a funcionar!',
    cors: 'enabled'
  });
});

// Armazenamento das salas (em memória, para simplificar)
const rooms = new Map();

// Limpeza automática de salas antigas a cada 30 minutos
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000; // 1 hora em ms
  
  rooms.forEach((room, roomCode) => {
    // Deletar salas vazias há mais de 1 hora
    if (room.players.length === 0 && room.emptyTime && (now - room.emptyTime) > oneHour) {
      if (room.deleteTimeout) {
        clearTimeout(room.deleteTimeout);
      }
      rooms.delete(roomCode);
      console.log(`Sala antiga ${roomCode} deletada na limpeza automática`);
    }
  });
}, 30 * 60 * 1000); // A cada 30 minutos

// NOTA: Em uma atualização futura, podemos implementar seleção de idioma com:
// 1. Um novo parâmetro no create-room: { language: 'pt_BR' ou 'pt_PT' }
// 2. Manter duas listas de palavras (Brasil/Portugal)
// 3. Escolher a lista adequada ao iniciar o jogo

// NOTA: Implementação futura - Categorias temáticas:
// Podemos adicionar palavras por categorias como:
// const CATEGORIES = {
//   ANIMAIS: ['cão', 'gato', 'pássaro', 'peixe', 'cavalo', 'coelho', ...],
//   COMIDA: ['pão', 'queijo', 'bacalhau', 'francesinha', 'pastel', ...],
//   DESPORTO: ['futebol', 'ténis', 'basquetebol', 'natação', 'ciclismo', ...],
//   PAÍSES: ['Portugal', 'Espanha', 'França', 'Alemanha', 'Brasil', ...]
// }
// E adicionar opção no create-room: { category: 'ANIMAIS' ou 'RANDOM' para misturar todas }

// Listas de palavras são importadas do ficheiro words.js
// As listas incluem agora centenas de palavras organizadas por categoria!

// Função para gerar código aleatório de 6 caracteres
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Função para normalizar texto removendo acentos e caracteres especiais
function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' '); // Normaliza espaços
}

// Função para iniciar uma nova ronda
function startRound(room, io) {
  // Verificar se a sala ainda existe e tem jogadores
  if (!room || !room.players || room.players.length === 0) {
    console.error('Tentativa de iniciar ronda em sala inválida ou vazia');
    return;
  }

  // Countdown antes de começar a ronda
  let countdown = 3;
  io.to(room.id).emit('countdown', { value: countdown, round: room.round, maxRounds: room.maxRounds });
  const countdownInterval = setInterval(() => {
    countdown--;
    io.to(room.id).emit('countdown', { value: countdown, round: room.round, maxRounds: room.maxRounds });
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      
      // Verificar novamente se ainda há jogadores na sala
      if (!room.players || room.players.length === 0) {
        console.error('Sala ficou vazia durante countdown');
        return;
      }
      
      // Limpar o canvas para todos
      io.to(room.id).emit('clear-canvas');
      // Sorteia o desenhista (evitar repetir o anterior se possível)
      let possibleDrawers = room.players.map(p => p.id);
      if (room.currentDrawer && room.players.length > 1) {
        possibleDrawers = possibleDrawers.filter(id => id !== room.currentDrawer);
      }
      
      if (possibleDrawers.length === 0) {
        console.error('Nenhum drawer disponível');
        return;
      }
      
      const drawerId = possibleDrawers[Math.floor(Math.random() * possibleDrawers.length)];
      const drawer = room.players.find(p => p.id === drawerId);
      
      // Verificar se o drawer foi encontrado
      if (!drawer) {
        console.error('Drawer não encontrado:', drawerId);
        return;
      }
      
      room.currentDrawer = drawer.id;
      // Sorteia a palavra conforme dificuldade usando o novo sistema
      const word = getRandomWord(room.difficulty || 'facil');
      room.currentWord = word;
      
      // Adicionar palavra ao histórico
      if (!room.wordHistory) room.wordHistory = [];
      room.wordHistory.push({
        round: room.round,
        word: word,
        drawer: drawer.name,
        guessedBy: []
      });
      
      // Notifica todos os jogadores
      room.players.forEach(player => {
        if (player.id === drawer.id) {
          io.to(player.id).emit('round-start', { isDrawer: true, word });
        } else {
          io.to(player.id).emit('round-start', { isDrawer: false });
        }
      });
      // Enviar atualização de jogadores para todos
      io.to(room.id).emit('players-update', {
        players: room.players,
        drawerId: drawer.id,
        round: room.round,
        maxRounds: room.maxRounds
      });
      io.to(room.id).emit('game-started');
      // TEMPORIZADOR DE RONDA
      let timeLeft = room.timePerRound || 60;
      room._lastTimeLeft = timeLeft;
      io.to(room.id).emit('timer-update', { timeLeft });
      if (room.timerInterval) clearInterval(room.timerInterval);
      
      // Sistema de dicas progressivas
      let hintsGiven = 0;
      const maxHints = 3;
      
      room.timerInterval = setInterval(() => {
        // Verificar se a sala ainda existe
        if (!room || !room.players || room.players.length === 0) {
          clearInterval(room.timerInterval);
          return;
        }
        
        timeLeft--;
        room._lastTimeLeft = timeLeft;
        io.to(room.id).emit('timer-update', { timeLeft });
        
        // Sistema de dicas: dar dicas quando restam 40s, 25s e 10s
        if (timeLeft === 40 && hintsGiven === 0) {
          const hint = `Dica 1: A palavra tem ${word.length} letras: ${word.replace(/./g, '_ ')}`;
          io.to(room.id).emit('hint', { hint, type: 'letters' });
          hintsGiven++;
        } else if (timeLeft === 25 && hintsGiven === 1) {
          const hint = `Dica 2: Primeira letra: ${word[0].toUpperCase()}${word.slice(1).replace(/./g, ' _')}`;
          io.to(room.id).emit('hint', { hint, type: 'first-letter' });
          hintsGiven++;
        } else if (timeLeft === 10 && hintsGiven === 2) {
          // Mostrar uma letra aleatória no meio
          const randomIndex = Math.floor(Math.random() * (word.length - 2)) + 1;
          let hintWord = word.split('').map((char, i) => {
            if (i === 0 || i === randomIndex) return char.toUpperCase();
            return '_';
          }).join(' ');
          const hint = `Dica 3: ${hintWord}`;
          io.to(room.id).emit('hint', { hint, type: 'random-letter' });
          hintsGiven++;
        }
        
        if (timeLeft <= 0) {
          clearInterval(room.timerInterval);
          // Revelar a palavra quando o tempo acabar
          io.to(room.id).emit('word-reveal', { word: word });
          io.to(room.id).emit('round-ended', { reason: 'timeout' });
          nextRoundOrEnd(room, io);
        }
      }, 1000);
    }
  }, 1000);
}

// Função para avançar ronda ou terminar
function nextRoundOrEnd(room, io) {
  // Verificar se a sala ainda existe e tem jogadores
  if (!room || !room.players || room.players.length === 0) {
    console.error('Tentativa de avançar ronda em sala inválida ou vazia');
    return;
  }

  if (room.round < room.maxRounds) {
    room.round++;
    setTimeout(() => {
      // Verificar novamente se a sala ainda existe antes de iniciar nova ronda
      if (room && room.players && room.players.length > 0) {
        startRound(room, io);
      } else {
        console.error('Sala não existe mais para iniciar nova ronda');
      }
    }, 5000); // Espera 5s antes de nova ronda
  } else {
    room.status = 'finished';
    io.to(room.id).emit('game-ended', { players: room.players });
  }
}

// Função para limpar todos os timers de uma sala
function clearRoomTimers(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  if (room.deleteTimeout) {
    clearTimeout(room.deleteTimeout);
    room.deleteTimeout = null;
  }
  if (room.reconnectTimeouts) {
    room.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    room.reconnectTimeouts = [];
  }
}

// Função para lidar com remoção de jogadores
function handlePlayerRemoval(roomCode, socketId, userName, room, io) {
  // Remover jogador da sala
  room.players = room.players.filter(player => player.id !== socketId);
  
  console.log(`${userName || socketId} saiu da sala ${roomCode}`);
  
  // Se não sobrou ninguém, marcar para deletar após 10 minutos
  if (room.players.length === 0) {
    console.log(`Sala ${roomCode} ficou vazia. Será deletada em 10 minutos se ninguém entrar.`);
    
    // Limpar todos os timers da sala
    clearRoomTimers(room);
    
    // Marcar sala como vazia e definir timeout para deleção
    room.isEmpty = true;
    room.emptyTime = Date.now();
    room.deleteTimeout = setTimeout(() => {
      if (rooms.has(roomCode) && room.players.length === 0) {
        // Limpar todos os timers antes de deletar
        clearRoomTimers(room);
        rooms.delete(roomCode);
        console.log(`Sala ${roomCode} deletada após 10 minutos vazia`);
        io.emit('room-deleted', { roomCode });
      }
    }, 10 * 60 * 1000); // 10 minutos
    
    return;
  }
  
  // Se alguém voltou para a sala, cancelar a deleção
  if (room.deleteTimeout) {
    clearTimeout(room.deleteTimeout);
    room.deleteTimeout = null;
    room.isEmpty = false;
    console.log(`Sala ${roomCode} não está mais vazia. Deleção cancelada.`);
  }
  
  // Se o host saiu, passar o controle para outro jogador
  if (room.host === socketId) {
    if (room.players.length > 0) {
      room.host = room.players[0].id;
      room.players[0].isHost = true;
      console.log(`Novo host da sala ${roomCode}: ${room.players[0].name}`);
    } else {
      console.log(`Sala ${roomCode} ficou sem jogadores após saída do host`);
    }
  }
  
  // Se o desenhista atual saiu durante uma ronda ativa, terminar a ronda
  if (room.currentDrawer === socketId && room.status === 'playing') {
    console.log(`Desenhista ${userName} saiu durante a ronda. Terminando ronda automaticamente.`);
    
    // Limpar o timer da ronda atual
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    
    // Notificar que a ronda terminou por saída do desenhista
    io.to(roomCode).emit('round-ended', { 
      reason: 'drawer-left',
      message: `${userName} (desenhista) saiu da sala. Avançando para próxima ronda...`
    });
    
    // Resetar currentDrawer e currentWord
    room.currentDrawer = null;
    room.currentWord = null;
    
    // Avançar para próxima ronda após 3 segundos
    setTimeout(() => nextRoundOrEnd(room, io), 3000);
  }
  
  // Notificar os jogadores restantes
  io.to(roomCode).emit('player-left', {
    playerId: socketId,
    players: room.players
  });
}

io.on('connection', (socket) => {
  console.log('Novo usuário conectado:', socket.id);
  
  // Verificar se o usuário está tentando acessar uma URL de sala diretamente
  if (socket.handshake.headers.referer) {
    const referer = socket.handshake.headers.referer;
    if (referer.includes('/sala/')) {
      try {
        const roomCode = referer.split('/sala/')[1];
        if (roomCode && !rooms.has(roomCode)) {
          // Enviar evento informando que a sala não existe
          socket.emit('room-not-found', { roomCode });
        }
      } catch (error) {
        console.error('Erro ao verificar sala:', error);
      }
    }
  }

  // Criar sala
  socket.on('create-room', ({ userName, rounds, difficulty }, callback) => {
    try {
      const roomCode = generateRoomCode();
      
      // Validar número de rondas
      const validRounds = rounds && rounds >= 1 && rounds <= 10 ? rounds : 3;
      
      // Criar objeto da sala
      rooms.set(roomCode, {
        id: roomCode,
        host: socket.id,
        players: [{
          id: socket.id,
          name: userName,
          score: 0,
          isHost: true
        }],
        status: 'waiting', // waiting, playing, finished
        currentDrawer: null,
        currentWord: null,
        round: 0,
        maxRounds: validRounds,
        timePerRound: 60,
        difficulty: difficulty || 'facil'
      });
      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = userName;
      console.log(`Sala ${roomCode} criada por ${userName} com ${validRounds} rondas`);
      callback({ success: true, roomCode });
    } catch (error) {
      console.error('Erro ao criar sala:', error);
      callback({ success: false, error: 'Erro ao criar sala' });
    }
  });

  // Entrar em sala
  socket.on('join-room', ({ userName, roomCode }, callback) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        io.emit('room-not-found', { roomCode });
        return callback({ success: false, error: 'Sala não encontrada' });
      }

      if (room.status !== 'waiting') {
        return callback({ success: false, error: 'Jogo já iniciado' });
      }

      // Se a sala estava vazia e marcada para deleção, cancelar
      if (room.deleteTimeout) {
        clearTimeout(room.deleteTimeout);
        room.deleteTimeout = null;
        room.isEmpty = false;
        console.log(`Sala ${roomCode} reativada por ${userName}. Deleção cancelada.`);
      }

      // Verificar se é uma reconexão (jogador já existe mas está desconectado temporariamente)
      let existingPlayer = room.players.find(p => p.name === userName && p.isTemporarilyDisconnected);
      
      if (existingPlayer) {
        // Reconexão - atualizar socket ID e limpar flag de desconexão
        existingPlayer.id = socket.id;
        existingPlayer.isTemporarilyDisconnected = false;
        delete existingPlayer.disconnectTime;
        
        // Remover timeout de reconexão específico deste jogador se existir
        if (room.reconnectTimeouts) {
          room.reconnectTimeouts = room.reconnectTimeouts.filter(timeoutId => {
            // Tentar cancelar o timeout (pode já ter expirado)
            try {
              clearTimeout(timeoutId);
              return false; // Remove da lista
            } catch (e) {
              return false; // Remove da lista mesmo se já expirou
            }
          });
        }
        
        console.log(`${userName} reconectou à sala ${roomCode}`);
        
        // Notificar que o jogador reconectou
        io.to(roomCode).emit('player-reconnected', {
          playerId: socket.id,
          playerName: userName,
          players: room.players
        });
      } else {
        // Determinar se será o host (se sala estava vazia)
        const isHost = room.players.length === 0;

        // Adicionar jogador à sala
        room.players.push({
          id: socket.id,
          name: userName,
          score: 0,
          isHost: isHost
        });

        // Se for o host, definir como tal
        if (isHost) {
          room.host = socket.id;
        }

        console.log(`${userName} entrou na sala ${roomCode}${isHost ? ' como novo host' : ''}`);
        
        // Notificar todos na sala sobre o novo jogador
        io.to(roomCode).emit('player-joined', {
          playerId: socket.id,
          playerName: userName,
          players: room.players
        });
      }

      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = userName;

      callback({ success: true });
    } catch (error) {
      console.error('Erro ao entrar na sala:', error);
      callback({ success: false, error: 'Erro ao entrar na sala' });
    }
  });

  // Reconectar à sala (para casos especiais de reconexão automática)
  socket.on('reconnect-to-room', ({ userName, roomCode }, callback) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        return callback({ success: false, error: 'Sala não encontrada' });
      }

      // Procurar jogador desconectado temporariamente
      const existingPlayer = room.players.find(p => p.name === userName && p.isTemporarilyDisconnected);
      
      if (existingPlayer) {
        // Reconexão bem-sucedida
        existingPlayer.id = socket.id;
        existingPlayer.isTemporarilyDisconnected = false;
        delete existingPlayer.disconnectTime;
        
        // Remover timeout de reconexão específico deste jogador se existir
        if (room.reconnectTimeouts) {
          room.reconnectTimeouts = room.reconnectTimeouts.filter(timeoutId => {
            // Tentar cancelar o timeout (pode já ter expirado)
            try {
              clearTimeout(timeoutId);
              return false; // Remove da lista
            } catch (e) {
              return false; // Remove da lista mesmo se já expirou
            }
          });
        }
        
        // Associar o socket à sala
        socket.join(roomCode);
        socket.data.roomCode = roomCode;
        socket.data.userName = userName;
        
        console.log(`${userName} reconectou automaticamente à sala ${roomCode}`);
        
        // Notificar que o jogador reconectou
        io.to(roomCode).emit('player-reconnected', {
          playerId: socket.id,
          playerName: userName,
          players: room.players
        });
        
        callback({ 
          success: true, 
          gameState: {
            status: room.status,
            round: room.round,
            maxRounds: room.maxRounds,
            currentDrawer: room.currentDrawer,
            isDrawer: room.currentDrawer === socket.id,
            timeLeft: room._lastTimeLeft || 0
          }
        });
      } else {
        callback({ success: false, error: 'Jogador não encontrado para reconexão' });
      }
    } catch (error) {
      console.error('Erro ao reconectar à sala:', error);
      callback({ success: false, error: 'Erro ao reconectar à sala' });
    }
  });

  // Quando um jogador se desconecta
  socket.on('disconnect', (reason) => {
    try {
      const roomCode = socket.data.roomCode;
      const userName = socket.data.userName;

      console.log(`${userName || socket.id} desconectou da sala ${roomCode} - Motivo: ${reason}`);

      if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        
        // Encontrar o jogador
        const player = room.players.find(p => p.id === socket.id);
        
        if (!player) {
          console.log(`Jogador ${socket.id} não encontrado na sala ${roomCode}`);
          return;
        }

        // Se a desconexão foi por fechar a janela/aba, dar um tempo para reconexão
        if (reason === 'client namespace disconnect' || reason === 'transport close' || reason === 'transport error') {
          console.log(`${userName} desconectou temporariamente. Aguardando reconexão...`);
          
          // Marcar jogador como desconectado temporariamente
          player.isTemporarilyDisconnected = true;
          player.disconnectTime = Date.now();
          
          // Notificar outros jogadores que alguém desconectou temporariamente
          io.to(roomCode).emit('player-temporarily-disconnected', {
            playerId: socket.id,
            playerName: userName
          });
          
          // Aguardar 30 segundos para reconexão antes de remover definitivamente
          const timeoutId = setTimeout(() => {
            if (rooms.has(roomCode) && player.isTemporarilyDisconnected) {
              console.log(`${userName} não reconectou em 30 segundos. Removendo da sala.`);
              handlePlayerRemoval(roomCode, socket.id, userName, room, io);
            }
          }, 30000); // 30 segundos
          
          // Adicionar timeout à lista para limpeza posterior
          if (!room.reconnectTimeouts) room.reconnectTimeouts = [];
          room.reconnectTimeouts.push(timeoutId);
          
          return;
        }
        
        // Para outros tipos de desconexão, remover imediatamente
        handlePlayerRemoval(roomCode, socket.id, userName, room, io);
      }
      
      console.log('Usuário desconectado:', socket.id);
    } catch (error) {
      console.error('Erro ao lidar com desconexão:', error);
    }
  });

  // Iniciar o jogo
  socket.on('start-game', ({ roomCode }) => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.status = 'playing';
    room.round = 1;
    room.id = roomCode; // garantir que room tem id
    startRound(room, io);
  });

  // Receber traço do desenhista e repassar para a sala
  socket.on('draw-line', ({ roomCode, line }) => {
    if (!roomCode || !line) return;
    // Enviar para todos, exceto quem desenhou
    socket.to(roomCode).emit('draw-line', line);
  });

  // Palpites dos jogadores
  socket.on('guess', ({ roomCode, text }) => {
    if (!roomCode || !text) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;
    const userName = socket.data.userName;
    const normalizedGuess = normalizeText(text);
    const normalizedWord = normalizeText(room.currentWord || '');
    const isCorrect = normalizedGuess === normalizedWord;
    io.to(roomCode).emit('guess', {
      name: userName,
      text,
      correct: isCorrect
    });
    // Lógica de pontuação dinâmica
    if (isCorrect) {
      // Adicionar ao histórico quem acertou
      if (room.wordHistory && room.wordHistory.length > 0) {
        const currentRoundHistory = room.wordHistory[room.wordHistory.length - 1];
        if (currentRoundHistory && !currentRoundHistory.guessedBy.includes(userName)) {
          currentRoundHistory.guessedBy.push(userName);
        }
      }
      
      // Calcular pontos com base no tempo restante
      let timeLeft = 0;
      if (room.timerInterval && room.timePerRound) {
        // Encontrar o tempo restante do último timer-update enviado
        // Como não guardamos o timeLeft, vamos estimar pelo tempoPerRound e pelo round
        // Melhor: guardar timeLeft no room a cada timer-update
        // (Implementação rápida: guardar timeLeft no room)
      }
      // Se não existir, usar 0
      timeLeft = room._lastTimeLeft || 0;
      // Pontuação: 10 + (tempoRestante / 5) para quem acerta
      const playerPoints = 10 + Math.floor(timeLeft / 5);
      const drawerPoints = 5;
      // Jogador que acertou ganha pontos proporcionais ao tempo
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.score += playerPoints;
      // Desenhista ganha sempre 5 pontos fixos
      const drawer = room.players.find(p => p.id === room.currentDrawer);
      if (drawer) {
        drawer.score += drawerPoints;
      } else {
        console.warn('Drawer não encontrado para adicionar pontos');
      }
      // Atualizar todos os jogadores com a nova lista de pontuações
      io.to(roomCode).emit('players-update', {
        players: room.players,
        drawerId: room.currentDrawer,
        round: room.round,
        maxRounds: room.maxRounds
      });
      console.log(`${userName} acertou a palavra! (+${playerPoints} pontos) | Desenhista (+${drawerPoints} pontos)`);
      // Avançar para próxima ronda ou terminar
      if (room.timerInterval) clearInterval(room.timerInterval);
      io.to(roomCode).emit('round-ended', { reason: 'guessed' });
      setTimeout(() => nextRoundOrEnd(room, io), 5000); // Espera 5s antes de nova ronda
    }
  });

  // Sistema de chat durante o jogo
  socket.on('chat-message', ({ roomCode, message }) => {
    if (!roomCode || !message || !message.trim()) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    const userName = socket.data.userName;
    
    // Verificar se a mensagem não é um palpite (para evitar spoilers)
    const normalizedMessage = normalizeText(message);
    const normalizedWord = normalizeText(room.currentWord || '');
    const isWordGuess = room.status === 'playing' && normalizedMessage === normalizedWord;
    
    if (!isWordGuess) {
      io.to(roomCode).emit('chat-message', {
        name: userName,
        message: message.trim(),
        timestamp: Date.now()
      });
    }
  });

  // Obter histórico de palavras
  socket.on('get-word-history', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) {
      return callback({ success: false, error: 'Sala não encontrada' });
    }
    callback({ 
      success: true, 
      history: room.wordHistory || [] 
    });
  });

  // Limpar o canvas
  socket.on('clear-canvas', ({ roomCode }) => {
    if (!roomCode) return;
    socket.to(roomCode).emit('clear-canvas');
  });

  // Reiniciar partida
  socket.on('restart-game', ({ roomCode, rounds }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Validar número de rondas
    const validRounds = rounds && rounds >= 1 && rounds <= 10 ? rounds : 3;
    
    // Resetar scores e estado
    room.players.forEach(p => p.score = 0);
    room.round = 1;
    room.maxRounds = validRounds;
    room.status = 'playing';
    room.id = roomCode;
    
    console.log(`Partida reiniciada na sala ${roomCode} com ${validRounds} rondas`);
    io.to(roomCode).emit('game-restarted');
    startRound(room, io);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
}); 