import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://desenharapido.netlify.app", "http://localhost:3000", "http://localhost:5173"],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: ["https://desenharapido.netlify.app", "http://localhost:3000", "http://localhost:5173"],
  credentials: true
}));
app.get('/', (req, res) => {
  res.send('Servidor ArteRápida a funcionar!');
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

// Listas de palavras em português de Portugal por dificuldade
const WORDS_FACIL = [
  'cão', 'gato', 'carro', 'casa', 'árvore', 'livro', 'bola', 'pato', 'copo', 'flor', 'sol', 'lua', 'estrela', 'fogo', 'mesa', 'porta', 'sapato', 'peixe', 'pão', 'cadeira', 'telemóvel', 'metro', 'autocarro', 'comboio', 'praia', 'pastel', 'mota', 'café', 'bica', 'chuva', 'elétrico', 'óculos', 'gelo', 'passeio', 'rua'
];
const WORDS_MEDIO = [
  'computador', 'bicicleta', 'telefone', 'avião', 'montanha', 'foguetão', 'janela', 'escada', 'cascata', 'baleia', 'tartaruga', 'girassol', 'almofada', 'escorrega', 'buzina', 'tenda', 'escorpião', 'bule', 'bolacha', 'bateria', 'pequeno-almoço', 'frigorífico', 'autocarro', 'passadeira', 'farmácia', 'eléctrico', 'império', 'francesinha', 'bacalhau', 'azulejo', 'portagem', 'gasolineira', 'talho', 'autocarro', 'camioneta', 'bicharoco'
];
const WORDS_DIFICIL = [
  'microscópio', 'paralelepípedo', 'ornitorrinco', 'helicóptero', 'canguru', 'escaravelho', 'anfíbio', 'estetoscópio', 'circuito', 'criptografia', 'maracujá', 'turbilhão', 'girassol', 'crocodilo', 'escafandro', 'bumerangue', 'trombone', 'saxofone', 'candelabro', 'ampulheta', 'otorrinolaringologista', 'eletrocardiograma', 'descodificador', 'pneumoultramicroscopicossilicovulcanoconiótico', 'hipopotomonstrosesquipedaliofobia', 'descentralização', 'constitucionalidade', 'multidisciplinaridade', 'fotossensibilidade', 'inconstitucionalissimamente'
];

// NOTA: Implementação futura - Sistema de dicas:
// Quando o tempo estiver a acabar, podemos mostrar parte da palavra:
// 1. Quando faltar 30s: mostrar o número de letras (ex: _ _ _ _ _ _)
// 2. Quando faltar 20s: mostrar a primeira letra (ex: C _ _ _ _ _)
// 3. Quando faltar 10s: mostrar mais uma letra aleatória (ex: C _ Ç _ _ _)

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
  // Countdown antes de começar a ronda
  let countdown = 3;
  io.to(room.id).emit('countdown', { value: countdown, round: room.round, maxRounds: room.maxRounds });
  const countdownInterval = setInterval(() => {
    countdown--;
    io.to(room.id).emit('countdown', { value: countdown, round: room.round, maxRounds: room.maxRounds });
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      // Limpar o canvas para todos
      io.to(room.id).emit('clear-canvas');
      // Sorteia o desenhista (evitar repetir o anterior se possível)
      let possibleDrawers = room.players.map(p => p.id);
      if (room.currentDrawer && room.players.length > 1) {
        possibleDrawers = possibleDrawers.filter(id => id !== room.currentDrawer);
      }
      const drawerId = possibleDrawers[Math.floor(Math.random() * possibleDrawers.length)];
      const drawer = room.players.find(p => p.id === drawerId);
      room.currentDrawer = drawer.id;
      // Sorteia a palavra conforme dificuldade
      let wordList = WORDS_FACIL;
      if (room.difficulty === 'medio') wordList = WORDS_MEDIO;
      if (room.difficulty === 'dificil') wordList = WORDS_DIFICIL;
      const word = wordList[Math.floor(Math.random() * wordList.length)];
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
  if (room.round < room.maxRounds) {
    room.round++;
    setTimeout(() => startRound(room, io), 5000); // Espera 5s antes de nova ronda
  } else {
    room.status = 'finished';
    io.to(room.id).emit('game-ended', { players: room.players });
  }
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

      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = userName;

      console.log(`${userName} entrou na sala ${roomCode}${isHost ? ' como novo host' : ''}`);
      
      // Notificar todos na sala sobre o novo jogador
      io.to(roomCode).emit('player-joined', {
        playerId: socket.id,
        playerName: userName,
        players: room.players
      });

      callback({ success: true });
    } catch (error) {
      console.error('Erro ao entrar na sala:', error);
      callback({ success: false, error: 'Erro ao entrar na sala' });
    }
  });

  // Quando um jogador se desconecta
  socket.on('disconnect', () => {
    try {
      const roomCode = socket.data.roomCode;
      const userName = socket.data.userName;

      if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        
        // Remover jogador da sala
        room.players = room.players.filter(player => player.id !== socket.id);
        
        console.log(`${userName || socket.id} saiu da sala ${roomCode}`);
        
        // Se não sobrou ninguém, marcar para deletar após 10 minutos
        if (room.players.length === 0) {
          console.log(`Sala ${roomCode} ficou vazia. Será deletada em 10 minutos se ninguém entrar.`);
          
          // Cancelar timeout anterior se existir
          if (room.deleteTimeout) {
            clearTimeout(room.deleteTimeout);
          }
          
          // Marcar sala como vazia e definir timeout para deleção
          room.isEmpty = true;
          room.emptyTime = Date.now();
          room.deleteTimeout = setTimeout(() => {
            if (rooms.has(roomCode) && room.players.length === 0) {
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
        if (room.host === socket.id) {
          room.host = room.players[0].id;
          room.players[0].isHost = true;
          console.log(`Novo host da sala ${roomCode}: ${room.players[0].name}`);
        }
        
        // Se o desenhista atual saiu durante uma ronda ativa, terminar a ronda
        if (room.currentDrawer === socket.id && room.status === 'playing') {
          console.log(`Desenhista ${userName} saiu durante a ronda. Terminando ronda automaticamente.`);
          
          // Parar o timer da ronda atual
          if (room.timerInterval) {
            clearInterval(room.timerInterval);
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
          playerId: socket.id,
          players: room.players
        });
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
      if (drawer) drawer.score += drawerPoints;
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