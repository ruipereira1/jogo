const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

// Importar sistemas melhorados
const { WORDS_FACIL, WORDS_MEDIO, WORDS_DIFICIL, getRandomWord } = require('./words');
const gameManager = require('./gameLogic');
const moderationSystem = require('./moderation');
const rateLimitManager = require('./rateLimiter');
const RoomManager = require('./roomManager');

// Inicializar gerenciador de salas melhorado
const roomManager = new RoomManager();

const app = express();
const server = http.createServer(app);

// Middleware de segurança e performance
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitar CSP para desenvolvimento
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

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
app.use(express.json({ limit: '10mb' }));

// Rate limiting para rotas Express
app.use('/api/', rateLimitManager.createExpressMiddleware('globalIP'));

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
    message: 'Servidor ArteRápida v2.5 funcionando!',
    cors: 'enabled',
    features: {
      gameManager: true,
      moderation: true,
      rateLimiting: true,
      cache: true
    }
  });
});

// Rota para estatísticas do servidor
app.get('/api/stats', (req, res) => {
  res.json({
    rooms: gameManager.getRoomStats(),
    moderation: moderationSystem.getModerationReport(),
    rateLimiting: rateLimitManager.getActivityReport(),
    globalStats: roomManager.getGlobalStats()
  });
});

// Rota para listar salas públicas
app.get('/api/public-rooms', (req, res) => {
  try {
    const publicRooms = roomManager.getPublicRooms();
    res.json({
      success: true,
      rooms: publicRooms,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Erro ao buscar salas públicas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Rota para estatísticas de uma sala específica
app.get('/api/room/:roomCode/stats', (req, res) => {
  try {
    const { roomCode } = req.params;
    const stats = roomManager.getRoomStats(roomCode);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada'
      });
    }
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas da sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Rota para criar sala com configurações avançadas
app.post('/api/create-room-advanced', (req, res) => {
  try {
    const {
      difficulty = 'facil',
      rounds = 3,
      category = 'all',
      isPrivate = false,
      password = null,
      maxPlayers = 8,
      allowSpectators = true,
      customWords = [],
      settings = {}
    } = req.body;

    // Validações básicas
    if (isPrivate && !password) {
      return res.status(400).json({
        success: false,
        error: 'Sala privada requer senha'
      });
    }

    if (maxPlayers < 2 || maxPlayers > 12) {
      return res.status(400).json({
        success: false,
        error: 'Número de jogadores deve ser entre 2 e 12'
      });
    }

    const roomData = {
      difficulty,
      rounds,
      category,
      isPrivate,
      password,
      maxPlayers,
      allowSpectators,
      customWords,
      ...settings
    };

    const room = roomManager.createRoom('temp-host-id', roomData);

    res.json({
      success: true,
      roomCode: room.id,
      room: {
        code: room.id,
        difficulty: room.difficulty,
        rounds: room.maxRounds,
        category: room.category,
        isPrivate: room.isPrivate,
        maxPlayers: room.maxPlayers,
        settings: room.settings
      }
    });
  } catch (error) {
    console.error('Erro ao criar sala avançada:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
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

// Armazenamento das salas (mantido para compatibilidade - usando RoomManager já inicializado)
const rooms = roomManager.rooms;

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
  socket.on('create-room', async ({ userName, rounds, difficulty, category }, callback) => {
    try {
      // Rate limiting
      const rateLimitCheck = await rateLimitManager.checkSocketRateLimit(socket, 'createRoom');
      if (!rateLimitCheck.allowed) {
        return callback({ success: false, error: rateLimitCheck.message });
      }

      // Validações de entrada
      if (!userName || typeof userName !== 'string') {
        return callback({ success: false, error: 'Nome de utilizador inválido' });
      }

      const trimmedUserName = userName.trim();
      
      // Moderação do nome de usuário
      const usernameModeration = moderationSystem.moderateUsername(trimmedUserName);
      if (!usernameModeration.isAllowed) {
        return callback({ 
          success: false, 
          error: usernameModeration.reason,
          suggestedName: usernameModeration.suggestedName 
        });
      }

      // Validar número de rondas
      let validRounds = 3; // valor padrão
      if (rounds !== undefined) {
        if (typeof rounds !== 'number' || !Number.isInteger(rounds)) {
          return callback({ success: false, error: 'Número de rondas deve ser um número inteiro' });
        }
        if (rounds < 1 || rounds > 10) {
          return callback({ success: false, error: 'Número de rondas deve estar entre 1 e 10' });
        }
        validRounds = rounds;
      }

      // Validar dificuldade
      const validDifficulties = ['facil', 'medio', 'dificil'];
      const validDifficulty = difficulty && validDifficulties.includes(difficulty) ? difficulty : 'facil';

      // Gerar código único para a sala
      let roomCode;
      let attempts = 0;
      do {
        roomCode = generateRoomCode();
        attempts++;
        if (attempts > 100) {
          return callback({ success: false, error: 'Erro interno: não foi possível gerar código único' });
        }
      } while (rooms.has(roomCode));
      
      // Usar GameManager para criar sala
      const player = {
        id: socket.id,
        name: trimmedUserName,
        score: 0,
        isHost: true
      };

      const roomData = {
        rounds: validRounds,
        difficulty: validDifficulty,
        category: category || 'all',
        isPrivate: false, // Salas padrão são públicas
        maxPlayers: 8
      };

      const room = gameManager.createRoom(roomCode, socket.id, roomData);
      gameManager.addPlayerToRoom(roomCode, player);
      
      // Registrar no RoomManager para funcionalidades avançadas
      roomManager.rooms.set(roomCode, {
        ...room,
        id: roomCode,
        isPrivate: false,
        password: null,
        settings: {
          allowChat: true,
          allowHints: true,
          autoStart: false,
          drawingTimeout: 60,
          guessTimeout: 15,
          showWordLength: true,
          allowSkip: true,
          competitiveMode: false
        }
      });
      
      // Manter compatibilidade com código existente
      rooms.set(roomCode, room);
      
      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = trimmedUserName;
      
      console.log(`Sala ${roomCode} criada por ${trimmedUserName} com ${validRounds} rondas (dificuldade: ${validDifficulty})`);
      callback({ success: true, roomCode });
    } catch (error) {
      console.error('Erro ao criar sala:', error);
      callback({ success: false, error: 'Erro interno ao criar sala' });
    }
  });

  // Entrar em sala
  socket.on('join-room', ({ userName, roomCode }, callback) => {
    try {
      // Verificar se callback foi fornecido
      const hasCallback = typeof callback === 'function';
      
      // Validações de entrada
      if (!userName || typeof userName !== 'string') {
        if (hasCallback) return callback({ success: false, error: 'Nome de utilizador inválido' });
        return;
      }

      if (!roomCode || typeof roomCode !== 'string') {
        if (hasCallback) return callback({ success: false, error: 'Código da sala inválido' });
        return;
      }

      const trimmedUserName = userName.trim();
      if (trimmedUserName.length < 2 || trimmedUserName.length > 20) {
        if (hasCallback) return callback({ success: false, error: 'Nome deve ter entre 2 e 20 caracteres' });
        return;
      }

      const trimmedRoomCode = roomCode.trim().toUpperCase();
      if (trimmedRoomCode.length !== 6) {
        if (hasCallback) return callback({ success: false, error: 'Código da sala deve ter 6 caracteres' });
        return;
      }

      const room = rooms.get(trimmedRoomCode);
      
      if (!room) {
        io.emit('room-not-found', { roomCode: trimmedRoomCode });
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      if (room.status !== 'waiting') {
        if (hasCallback) return callback({ success: false, error: 'Jogo já iniciado' });
        return;
      }

      // Verificar se já existe um jogador com o mesmo nome (exceto se for reconexão)
      const existingActivePlayer = room.players.find(p => p.name === trimmedUserName && !p.isTemporarilyDisconnected);
      if (existingActivePlayer) {
        if (hasCallback) return callback({ success: false, error: 'Já existe um jogador com esse nome na sala' });
        return;
      }

      // Se a sala estava vazia e marcada para deleção, cancelar
      if (room.deleteTimeout) {
        clearTimeout(room.deleteTimeout);
        room.deleteTimeout = null;
        room.isEmpty = false;
        console.log(`Sala ${roomCode} reativada por ${userName}. Deleção cancelada.`);
      }

      // Verificar se é uma reconexão (jogador já existe mas está desconectado temporariamente)
      let existingPlayer = room.players.find(p => p.name === trimmedUserName && p.isTemporarilyDisconnected);
      
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
        
        console.log(`${trimmedUserName} reconectou à sala ${trimmedRoomCode}`);
        
        // Notificar que o jogador reconectou
        io.to(trimmedRoomCode).emit('player-reconnected', {
          playerId: socket.id,
          playerName: trimmedUserName,
          players: room.players
        });
      } else {
        // Determinar se será o host (se sala estava vazia)
        const isHost = room.players.length === 0;

        // Adicionar jogador à sala
        room.players.push({
          id: socket.id,
          name: trimmedUserName,
          score: 0,
          isHost: isHost
        });

        // Se for o host, definir como tal
        if (isHost) {
          room.host = socket.id;
        }

        console.log(`${trimmedUserName} entrou na sala ${trimmedRoomCode}${isHost ? ' como novo host' : ''}`);
        
        // Notificar todos na sala sobre o novo jogador
        io.to(trimmedRoomCode).emit('player-joined', {
          playerId: socket.id,
          playerName: trimmedUserName,
          players: room.players
        });
      }

      // Associar o socket à sala
      socket.join(trimmedRoomCode);
      socket.data.roomCode = trimmedRoomCode;
      socket.data.userName = trimmedUserName;

      if (hasCallback) callback({ success: true });
    } catch (error) {
      console.error('Erro ao entrar na sala:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro ao entrar na sala' });
    }
  });

  // Reconectar à sala (para casos especiais de reconexão automática)
  socket.on('reconnect-to-room', ({ userName, roomCode }, callback) => {
    try {
      // Verificar se callback foi fornecido
      const hasCallback = typeof callback === 'function';
      
      const room = rooms.get(roomCode);
      
      if (!room) {
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      // Procurar jogador desconectado temporariamente
      const existingPlayer = room.players.find(p => p.name === userName && p.isTemporarilyDisconnected);
      
      if (existingPlayer) {
        // Reconexão bem-sucedida
        existingPlayer.id = socket.id;
        existingPlayer.isTemporarilyDisconnected = false;
        delete existingPlayer.disconnectTime;
        
        // Remover timeout de reconexão específico deste jogador se existir
        if (room.reconnectTimeouts && existingPlayer.reconnectTimeoutId) {
          const timeoutIndex = room.reconnectTimeouts.indexOf(existingPlayer.reconnectTimeoutId);
          if (timeoutIndex > -1) {
            clearTimeout(existingPlayer.reconnectTimeoutId);
            room.reconnectTimeouts.splice(timeoutIndex, 1);
            delete existingPlayer.reconnectTimeoutId;
          }
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
        
        if (hasCallback) callback({ 
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
        if (hasCallback) callback({ success: false, error: 'Jogador não encontrado para reconexão' });
      }
    } catch (error) {
      console.error('Erro ao reconectar à sala:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro ao reconectar à sala' });
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
          
          // Guardar o timeoutId no jogador para poder cancelar depois
          player.reconnectTimeoutId = timeoutId;
          
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
  socket.on('draw-line', async ({ roomCode, line }) => {
    try {
      // Rate limiting para desenhos
      const rateLimitCheck = await rateLimitManager.checkSocketRateLimit(socket, 'drawing');
      if (!rateLimitCheck.allowed) return;

      if (!roomCode || !line) return;
      
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') return;
      
      // Verificar se é realmente o desenhista
      if (socket.id !== room.currentDrawer) return;

      // Enviar para todos, exceto quem desenhou
      socket.to(roomCode).emit('draw-line', line);
    } catch (error) {
      console.error('Erro ao processar desenho:', error);
    }
  });

  // Palpites dos jogadores
  socket.on('guess', async ({ roomCode, text }) => {
    try {
      // Rate limiting
      const rateLimitCheck = await rateLimitManager.checkSocketRateLimit(socket, 'guess');
      if (!rateLimitCheck.allowed) {
        socket.emit('rate-limit-warning', { message: rateLimitCheck.message });
        return;
      }

      // Validações de entrada
      if (!roomCode || typeof roomCode !== 'string') return;
      if (!text || typeof text !== 'string') return;
      
      const trimmedText = text.trim();
      if (trimmedText.length === 0 || trimmedText.length > 100) return;
      
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') return;
      
      const userName = socket.data.userName;
      if (!userName) return;
      
      // Verificar se é o desenhista (desenhista não pode dar palpites)
      if (socket.id === room.currentDrawer) return;
      
      // Sanitizar texto para evitar HTML/scripts
      const sanitizedText = trimmedText
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
      
      const normalizedGuess = normalizeText(trimmedText);
      const normalizedWord = normalizeText(room.currentWord || '');
      const isCorrect = normalizedGuess === normalizedWord;
      
      io.to(roomCode).emit('guess', {
        name: userName,
        text: sanitizedText,
        correct: isCorrect
      });
    // Lógica de pontuação dinâmica
    if (isCorrect) {
      // Verificar se há drawer ativo antes de continuar
      if (!room.currentDrawer || room.status !== 'playing') {
        console.warn('Palpite correto ignorado: não há drawer ativo ou jogo não está ativo');
        return;
      }

      // Adicionar ao histórico quem acertou
      if (room.wordHistory && room.wordHistory.length > 0) {
        const currentRoundHistory = room.wordHistory[room.wordHistory.length - 1];
        if (currentRoundHistory && !currentRoundHistory.guessedBy.includes(userName)) {
          currentRoundHistory.guessedBy.push(userName);
        }
      }
      
      // Calcular pontos com base no tempo restante
      const timeLeft = room._lastTimeLeft || 45;
      
      // Pontuação: 10 + (tempoRestante / 5) para quem acerta
      const playerPoints = 10 + Math.floor(timeLeft / 5);
      const drawerPoints = 5;
      
      // Jogador que acertou ganha pontos proporcionais ao tempo
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.score += playerPoints;
      } else {
        console.warn('Jogador não encontrado para adicionar pontos');
        return;
      }
      
      // Desenhista ganha sempre 5 pontos fixos
      const drawer = room.players.find(p => p.id === room.currentDrawer);
      if (drawer) {
        drawer.score += drawerPoints;
      } else {
        console.warn('Drawer não encontrado para adicionar pontos - Round pode estar corrompido');
        return;
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
    } catch (error) {
      console.error('Erro ao processar palpite:', error);
    }
  });

  // Sistema de chat durante o jogo
  socket.on('chat-message', async ({ roomCode, message }) => {
    try {
      // Rate limiting
      const rateLimitCheck = await rateLimitManager.checkSocketRateLimit(socket, 'chatMessage');
      if (!rateLimitCheck.allowed) {
        socket.emit('rate-limit-warning', { message: rateLimitCheck.message });
        return;
      }

      // Validações de entrada
      if (!roomCode || typeof roomCode !== 'string') return;
      if (!message || typeof message !== 'string') return;
      
      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0 || trimmedMessage.length > 200) return;
      
      const room = rooms.get(roomCode);
      if (!room) return;
      
      const userName = socket.data.userName;
      if (!userName) return;

      // Moderação da mensagem
      const moderation = moderationSystem.moderateMessage(
        socket.id, 
        userName, 
        trimmedMessage
      );

      if (!moderation.isAllowed) {
        socket.emit('moderation-warning', { 
          message: moderation.warning,
          action: moderation.action 
        });
        
        if (moderation.action === 'temporary_ban') {
          socket.emit('temporary-ban', { 
            duration: 300000, // 5 minutos
            reason: 'Múltiplas violações de conduta' 
          });
          socket.disconnect();
        }
        return;
      }

      // Verificar spoiler apenas se o jogo estiver ativo
      if (room.status === 'playing' && room.currentWord) {
        const spoilerCheck = moderationSystem.checkWordSpoiler(trimmedMessage, room.currentWord);
        if (spoilerCheck.isSpoiler) {
          socket.emit('spoiler-warning', { 
            message: 'Tentativa de revelar a palavra detectada!' 
          });
          return;
        }
      }

      // Enviar mensagem moderada
      const chatData = {
        name: userName,
        message: moderation.filteredMessage,
        timestamp: Date.now(),
        isSystem: false
      };

             io.to(roomCode).emit('chat-message', chatData);
    } catch (error) {
      console.error('Erro ao processar mensagem de chat:', error);
    }
  });

  // Obter histórico de palavras
  socket.on('get-word-history', ({ roomCode }, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      
      const room = rooms.get(roomCode);
      if (!room) {
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }
      
      if (hasCallback) callback({ 
        success: true, 
        history: room.wordHistory || [] 
      });
    } catch (error) {
      console.error('Erro ao obter histórico:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno' });
    }
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

  // === EVENTOS PARA FUNCIONALIDADES AVANÇADAS ===

  // Criar sala com configurações avançadas
  socket.on('create-room-advanced', async (data, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      const { userName, ...roomData } = data;
      
      // Rate limiting
      const rateLimitCheck = await rateLimitManager.checkSocketRateLimit(socket, 'createRoom');
      if (!rateLimitCheck.allowed) {
        if (hasCallback) return callback({ success: false, error: rateLimitCheck.message });
        return;
      }

      // Validações
      if (!userName || typeof userName !== 'string') {
        if (hasCallback) return callback({ success: false, error: 'Nome de utilizador inválido' });
        return;
      }

      const trimmedUserName = userName.trim();
      
      // Moderação do nome de usuário
      const usernameModeration = moderationSystem.moderateUsername(trimmedUserName);
      if (!usernameModeration.isAllowed) {
        return callback({ 
          success: false, 
          error: usernameModeration.reason,
          suggestedName: usernameModeration.suggestedName 
        });
      }

      // Usar RoomManager para criar sala avançada
      const room = roomManager.createRoom(socket.id, {
        difficulty: roomData.difficulty || 'facil',
        rounds: roomData.rounds || 3,
        category: roomData.category || 'all',
        isPrivate: roomData.isPrivate || false,
        password: roomData.password || null,
        maxPlayers: roomData.maxPlayers || 8,
        allowSpectators: roomData.allowSpectators !== false,
        customWords: roomData.customWords || [],
        settings: {
          allowChat: roomData.settings?.allowChat !== false,
          allowHints: roomData.settings?.allowHints !== false,
          autoStart: roomData.settings?.autoStart || false,
          drawingTimeout: roomData.settings?.drawingTimeout || 60,
          guessTimeout: roomData.settings?.guessTimeout || 15,
          showWordLength: roomData.settings?.showWordLength !== false,
          allowSkip: roomData.settings?.allowSkip !== false,
          competitiveMode: roomData.settings?.competitiveMode || false,
          ...roomData.settings
        }
      });

      // Adicionar host como jogador
      const hostPlayer = {
        id: socket.id,
        name: trimmedUserName,
        score: 0,
        isHost: true
      };

      roomManager.addPlayer(room.id, hostPlayer);

      // Manter compatibilidade com sistema existente
      const compatibleRoom = {
        ...room,
        players: [hostPlayer],
        currentDrawer: null,
        currentWord: '',
        timerInterval: null,
        wordHistory: []
      };

      rooms.set(room.id, compatibleRoom);

      socket.join(room.id);
      socket.data.roomCode = room.id;
      socket.data.userName = trimmedUserName;

      console.log(`Sala avançada ${room.id} criada por ${trimmedUserName}`);
      if (hasCallback) callback({ success: true, roomCode: room.id, room });
      
    } catch (error) {
      console.error('Erro ao criar sala avançada:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno ao criar sala' });
    }
  });

  // Entrar em sala privada (com senha)
  socket.on('join-private-room', async ({ userName, roomCode, password }, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      
      if (!userName || !roomCode) {
        if (hasCallback) return callback({ success: false, error: 'Dados incompletos' });
        return;
      }

      const room = rooms.get(roomCode.toUpperCase());
      
      if (!room) {
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      const roomManagerData = roomManager.rooms.get(roomCode.toUpperCase());
      
      if (roomManagerData?.isPrivate && roomManagerData.password !== password) {
        if (hasCallback) return callback({ success: false, error: 'Senha incorreta' });
        return;
      }

      // Usar lógica existente de join-room
      socket.emit('join-room', { userName, roomCode }, callback);

    } catch (error) {
      console.error('Erro ao entrar em sala privada:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno' });
    }
  });

  // Atualizar configurações da sala (host only)
  socket.on('update-room-settings', ({ roomCode, settings }, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      
      const room = rooms.get(roomCode);
      
      if (!room) {
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      
      if (!player || !player.isHost) {
        if (hasCallback) return callback({ success: false, error: 'Apenas o host pode alterar configurações' });
        return;
      }

      // Atualizar no RoomManager
      const roomManagerData = roomManager.rooms.get(roomCode);
      if (roomManagerData) {
        Object.assign(roomManagerData.settings, settings);
      }

      // Notificar jogadores
      io.to(roomCode).emit('room-settings-updated', { settings });
      
      if (hasCallback) callback({ success: true });
      
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno' });
    }
  });

  // Banir jogador (host only)
  socket.on('ban-player', ({ roomCode, playerId, reason }, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      
      const room = rooms.get(roomCode);
      
      if (!room) {
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      const host = room.players.find(p => p.id === socket.id);
      
      if (!host || !host.isHost) {
        if (hasCallback) return callback({ success: false, error: 'Apenas o host pode banir jogadores' });
        return;
      }

      const targetPlayer = room.players.find(p => p.id === playerId);
      
      if (!targetPlayer) {
        if (hasCallback) return callback({ success: false, error: 'Jogador não encontrado' });
        return;
      }

      // Usar sistema de moderação
      moderationSystem.banUser(playerId, targetPlayer.name, reason || 'Banido pelo host');

      // Remover jogador
      const targetSocket = io.sockets.sockets.get(playerId);
      if (targetSocket) {
        targetSocket.emit('banned', { reason });
        targetSocket.leave(roomCode);
      }

      room.players = room.players.filter(p => p.id !== playerId);

      io.to(roomCode).emit('player-banned', {
        playerId,
        playerName: targetPlayer.name,
        reason,
        players: room.players
      });

      if (hasCallback) callback({ success: true });
      
    } catch (error) {
      console.error('Erro ao banir jogador:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno' });
    }
  });

  // Adicionar palavra personalizada
  socket.on('add-custom-word', ({ roomCode, word }, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      
      const room = rooms.get(roomCode);
      
      if (!room) {
        if (hasCallback) return callback({ success: false, error: 'Sala não encontrada' });
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      
      if (!player || !player.isHost) {
        if (hasCallback) return callback({ success: false, error: 'Apenas o host pode adicionar palavras' });
        return;
      }

      if (!word || typeof word !== 'string' || word.trim().length < 2) {
        if (hasCallback) return callback({ success: false, error: 'Palavra inválida' });
        return;
      }

      const trimmedWord = word.trim().toLowerCase();

      // Moderação da palavra
      const moderation = moderationSystem.moderateMessage(socket.id, player.name, trimmedWord);
      
      if (!moderation.isAllowed) {
        if (hasCallback) return callback({ success: false, error: 'Palavra não permitida' });
        return;
      }

      const roomManagerData = roomManager.rooms.get(roomCode);
      if (roomManagerData) {
        if (!roomManagerData.customWords) {
          roomManagerData.customWords = [];
        }
        
        if (roomManagerData.customWords.length >= 100) {
          if (hasCallback) return callback({ success: false, error: 'Máximo de 100 palavras personalizadas' });
          return;
        }
        
        if (!roomManagerData.customWords.includes(trimmedWord)) {
          roomManagerData.customWords.push(trimmedWord);
        }
      }

      if (hasCallback) callback({ success: true });
      
    } catch (error) {
      console.error('Erro ao adicionar palavra personalizada:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno' });
    }
  });

  // Obter estatísticas da sala
  socket.on('get-room-stats', ({ roomCode }, callback) => {
    try {
      const hasCallback = typeof callback === 'function';
      
      const stats = roomManager.getRoomStats(roomCode);
      if (hasCallback) callback({ success: true, stats });
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      if (typeof callback === 'function') callback({ success: false, error: 'Erro interno' });
    }
  });
});

// Sistema de limpeza automática de salas inativas
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000); // 1 hora

  rooms.forEach((room, roomCode) => {
    const roomCreatedAt = new Date(room.createdAt).getTime();
    
    // Remover salas vazias por mais de 5 minutos
    if (room.players.length === 0 && roomCreatedAt < (now - 5 * 60 * 1000)) {
      console.log(`Limpeza automática: Removendo sala vazia ${roomCode}`);
      gameManager.deleteRoom(roomCode);
      rooms.delete(roomCode);
    }
    
    // Remover salas inativas por mais de 1 hora
    else if (roomCreatedAt < oneHourAgo) {
      console.log(`Limpeza automática: Removendo sala inativa ${roomCode}`);
      
      // Notificar jogadores antes de remover
      io.to(roomCode).emit('room-cleanup', { 
        message: 'Sala removida por inatividade prolongada' 
      });
      
      gameManager.deleteRoom(roomCode);
      rooms.delete(roomCode);
    }
  });
}, 5 * 60 * 1000); // Executar a cada 5 minutos

// Log de estatísticas a cada hora
setInterval(() => {
  console.log('📊 Estatísticas do servidor:');
  console.log(`- Salas ativas: ${rooms.size}`);
  console.log(`- Total de conexões: ${io.engine.clientsCount}`);
  console.log(`- Cache stats:`, gameManager.getCacheStats());
  console.log(`- Moderação:`, moderationSystem.getModerationReport());
}, 60 * 60 * 1000); // A cada hora

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor ArteRápida v2.5 iniciado na porta ${PORT}`);
  console.log(`🎮 Funcionalidades ativas:`);
  console.log(`  - Sistema de Cache: ✅`);
  console.log(`  - Rate Limiting: ✅`);
  console.log(`  - Moderação Automática: ✅`);
  console.log(`  - Limpeza Automática: ✅`);
}); 