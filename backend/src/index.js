import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const FRONTEND_URL = 'https://desenharapido.netlify.app';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

app.use(cors({
  origin: [FRONTEND_URL],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// Middleware para garantir os headers de CORS em todas as respostas
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', FRONTEND_URL);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

app.get('/', (req, res) => {
  res.send('Servidor ArteRápida rodando!');
});

// Armazenamento das salas (em memória, para simplificar)
const rooms = new Map();

// Listas de palavras por dificuldade
const WORDS_FACIL = [
  'cachorro', 'gato', 'carro', 'casa', 'árvore', 'livro', 'bola', 'pato', 'copo', 'flor', 'sol', 'lua', 'estrela', 'fogo', 'pato', 'mesa', 'porta', 'sapato', 'peixe', 'pão'
];
const WORDS_MEDIO = [
  'computador', 'bicicleta', 'telefone', 'avião', 'montanha', 'foguete', 'janela', 'escada', 'cachoeira', 'baleia', 'tartaruga', 'girassol', 'travesseiro', 'escorrega', 'buzina', 'barraca', 'escorpião', 'bule', 'biscoito', 'bateria'
];
const WORDS_DIFICIL = [
  'microscópio', 'paralelepípedo', 'ornitorrinco', 'helicóptero', 'canguru', 'escaravelho', 'anfíbio', 'estetoscópio', 'circuito', 'criptografia', 'maracujá', 'turbilhão', 'girassol', 'crocodilo', 'escafandro', 'bumerangue', 'trombone', 'saxofone', 'candelabro', 'ampulheta'
];

// Função para gerar código aleatório de 6 caracteres
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
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
      if (!drawer) {
        console.error('Erro: Não foi possível encontrar um desenhista válido para a sala', room.id);
        io.to(room.id).emit('round-ended', { reason: 'sem-desenhista' });
        return;
      }
      room.currentDrawer = drawer.id;
      // Sorteia a palavra conforme dificuldade
      let wordList = WORDS_FACIL;
      if (room.difficulty === 'medio') wordList = WORDS_MEDIO;
      if (room.difficulty === 'dificil') wordList = WORDS_DIFICIL;
      const word = wordList[Math.floor(Math.random() * wordList.length)];
      room.currentWord = word;
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
        players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
          id, playerId, name, score, isHost, online
        })),
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
      room.timerInterval = setInterval(() => {
        timeLeft--;
        io.to(room.id).emit('timer-update', { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(room.timerInterval);
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
    setTimeout(() => startRound(room, io), 2000); // Espera 2s antes de nova ronda
  } else {
    room.status = 'finished';
    io.to(room.id).emit('game-ended', {
      players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
        id, playerId, name, score, isHost, online
      }))
    });
  }
}

io.on('connection', (socket) => {
  console.log('Novo usuário conectado:', socket.id);

  // Criar sala
  socket.on('create-room', ({ userName, rounds, difficulty }, callback) => {
    try {
      const roomCode = generateRoomCode();
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
        maxRounds: rounds || 3,
        timePerRound: 60,
        difficulty: difficulty || 'facil',
        lines: [] // Guardar linhas desenhadas
      });
      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = userName;
      console.log(`Sala ${roomCode} criada por ${userName}`);
      callback({ success: true, roomCode });
    } catch (error) {
      console.error('Erro ao criar sala:', error);
      callback({ success: false, error: 'Erro ao criar sala' });
    }
  });

  // Entrar em sala
  socket.on('join-room', ({ userName, roomCode, playerId }, callback) => {
    try {
      const room = rooms.get(roomCode);
      
      if (!room) {
        return callback({ success: false, error: 'Sala não encontrada' });
      }

      // Verificar se já existe jogador com este playerId
      let existingPlayer = null;
      if (playerId) {
        existingPlayer = room.players.find(p => p.playerId === playerId);
      }

      // Se o jogo já começou, só permitir reentrada de quem já estava na sala
      if (room.status !== 'waiting' && !existingPlayer) {
        return callback({ success: false, error: 'Jogo já iniciado' });
      }

      if (existingPlayer) {
        // Jogador está a reentrar: atualizar socket.id, nome e marcar como online
        existingPlayer.id = socket.id;
        existingPlayer.name = userName;
        existingPlayer.online = true;
        // Cancelar timeout de remoção se existir
        if (existingPlayer._removeTimeout) {
          clearTimeout(existingPlayer._removeTimeout);
          delete existingPlayer._removeTimeout;
        }
      } else {
        // Impedir duplicidade de playerId
        if (playerId && room.players.some(p => p.playerId === playerId)) {
          return callback({ success: false, error: 'Já existe um jogador com este ID na sala.' });
        }
        // Adicionar novo jogador
        room.players.push({
          id: socket.id,
          playerId: playerId || socket.id,
          name: userName,
          score: 0,
          isHost: false,
          online: true
        });
      }

      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = userName;
      socket.data.playerId = playerId || socket.id;

      console.log(`${userName} entrou/reentrou na sala ${roomCode}`);
      
      // Notificar todos na sala sobre o novo jogador
      console.log('player-joined emitido para sala', roomCode, room.players.map(p => p.name));
      io.to(roomCode).emit('player-joined', {
        playerId: socket.data.playerId,
        playerName: userName,
        players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
          id, playerId, name, score, isHost, online
        }))
      });

      callback({ success: true });

      // Enviar estado completo da sala apenas para o jogador que entrou/reentrou
      socket.emit('room-state', {
        players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
          id, playerId, name, score, isHost, online
        })),
        drawerId: room.currentDrawer,
        round: room.round,
        maxRounds: room.maxRounds,
        status: room.status,
        word: room.currentWord,
        lines: room.lines,
        timer: room._lastTimeLeft || 0,
        podium: room.status === 'finished' ? [...room.players].sort((a, b) => b.score - a.score) : null
      });
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
      const playerId = socket.data.playerId;

      if (roomCode && rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        // Encontrar jogador pelo playerId
        const player = room.players.find(p => p.playerId === playerId);
        if (player) {
          // Marcar jogador como offline
          player.online = false;
          // Se o jogador era o desenhista, notificar a sala
          if (room.currentDrawer === player.id) {
            io.to(roomCode).emit('drawer-left', {
              drawerId: player.id,
              drawerName: player.name
            });
          }
          // Emitir evento de jogador offline imediatamente
          io.to(roomCode).emit('player-offline', {
            playerId: playerId,
            players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
              id, playerId, name, score, isHost, online
            }))
          });
          // Timeout de 120s para remoção definitiva
          player._removeTimeout = setTimeout(() => {
            // Remover jogador da sala
            room.players = room.players.filter(p => p.playerId !== playerId);
            // Notificar o jogador removido, se possível
            io.to(player.id).emit('removed-by-timeout');
            console.log(`${userName || socket.id} removido da sala ${roomCode} por timeout de reconexão`);
            // Se não sobrou ninguém, deletar a sala
            if (room.players.length === 0) {
              rooms.delete(roomCode);
              console.log(`Sala ${roomCode} deletada pois ficou vazia`);
              return;
            }
            // Se o host saiu, passar o controle para outro jogador
            if (room.host === socket.id) {
              room.host = room.players[0].id;
              room.players[0].isHost = true;
              console.log(`Novo host da sala ${roomCode}: ${room.players[0].name}`);
              // Notificar todos que houve mudança de host
              io.to(roomCode).emit('host-left', {
                newHostId: room.players[0].id,
                newHostName: room.players[0].name
              });
            }
            // Notificar os jogadores restantes
            io.to(roomCode).emit('player-left', {
              playerId: playerId,
              players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
                id, playerId, name, score, isHost, online
              }))
            });
            // Emitir também o estado atualizado da lista de jogadores
            io.to(roomCode).emit('players-update', {
              players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
                id, playerId, name, score, isHost, online
              })),
              drawerId: room.currentDrawer,
              round: room.round,
              maxRounds: room.maxRounds
            });
          }, 120000); // 120 segundos
        }
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
  socket.on('draw-line', ({ roomCode, line, point }) => {
    if (!roomCode || (!line && !point)) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    if (line) {
      room.lines.push(line);
      socket.to(roomCode).emit('draw-line', line);
    } else if (point) {
      // Adicionar ponto à última linha
      if (room.lines.length === 0) return;
      room.lines[room.lines.length - 1].points.push(point);
      socket.to(roomCode).emit('draw-line', { point });
    }
  });

  // Palpites dos jogadores
  socket.on('guess', ({ roomCode, text }) => {
    if (!roomCode || !text) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;
    const userName = socket.data.userName;
    const isCorrect = text.trim().toLowerCase() === (room.currentWord || '').toLowerCase();
    io.to(roomCode).emit('guess', {
      name: userName,
      text,
      correct: isCorrect
    });
    // Lógica de pontuação dinâmica melhorada
    if (isCorrect) {
      // Calcular pontos com base no tempo restante
      let timeLeft = room._lastTimeLeft || 0;
      // Verificar se já houve acertos nesta ronda
      if (!room._correctPlayers) room._correctPlayers = [];
      const isFirstCorrect = room._correctPlayers.length === 0;
      // Adicionar este jogador à lista de quem acertou
      if (!room._correctPlayers.includes(socket.id)) {
        room._correctPlayers.push(socket.id);
      }
      // Pontuação para quem acerta: base 20 + bónus pelo tempo + bónus se for o primeiro
      const basePoints = 20;
      const timeBonus = Math.floor(timeLeft * 0.5); // mais rápido, mais pontos
      const firstBonus = isFirstCorrect ? 5 : 0;
      const playerPoints = Math.max(10, Math.min(50, basePoints + timeBonus + firstBonus));
      // Pontuação para o desenhista: 5 pontos por cada jogador que acertou
      const drawerPoints = 5 * room._correctPlayers.length;
      // Jogador que acertou ganha pontos
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.score += playerPoints;
      // Desenhista ganha pontos
      const drawer = room.players.find(p => p.id === room.currentDrawer);
      if (drawer) drawer.score = drawerPoints;
      // Atualizar todos os jogadores com a nova lista de pontuações
      io.to(roomCode).emit('players-update', {
        players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
          id, playerId, name, score, isHost, online
        })),
        drawerId: room.currentDrawer,
        round: room.round,
        maxRounds: room.maxRounds
      });
      console.log(`${userName} acertou a palavra! (+${playerPoints} pontos) | Desenhista (+${drawerPoints} pontos)`);
      // Se todos os jogadores (exceto o desenhista) já acertaram, termina a ronda
      const totalPlayers = room.players.filter(p => p.id !== room.currentDrawer && p.online !== false).length;
      if (room._correctPlayers.length >= totalPlayers) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      io.to(roomCode).emit('round-ended', { reason: 'guessed' });
      setTimeout(() => nextRoundOrEnd(room, io), 5000); // Espera 5s antes de nova ronda
      }
    }
  });

  // Limpar o canvas
  socket.on('clear-canvas', ({ roomCode }) => {
    if (!roomCode) return;
    const room = rooms.get(roomCode);
    if (!room) return;
    room.lines = [];
    socket.to(roomCode).emit('clear-canvas');
  });

  // Reiniciar partida
  socket.on('restart-game', ({ roomCode, rounds }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    // Resetar scores e estado
    room.players.forEach(p => p.score = 0);
    room.round = 1;
    room.maxRounds = rounds || 3;
    room.status = 'playing';
    room.id = roomCode;
    io.to(roomCode).emit('game-restarted');
    startRound(room, io);
  });

  // Sincronização total do estado ao reconectar
  socket.on('request-room-state', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    // Enviar estado completo apenas para o socket que pediu
    socket.emit('room-state', {
      players: room.players,
      drawerId: room.currentDrawer,
      round: room.round,
      maxRounds: room.maxRounds,
      status: room.status,
      word: room.currentWord,
      lines: room.lines,
      timer: room._lastTimeLeft || 0,
      podium: room.status === 'finished' ? [...room.players].sort((a, b) => b.score - a.score) : null
    });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
}); 