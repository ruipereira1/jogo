import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// URL do frontend - atualizar se necessário
const FRONTEND_URL = 'https://desenharapido.netlify.app';

// Tempo em milissegundos para remover jogadores desconectados
const PLAYER_TIMEOUT = 120000; // 2 minutos  

// Tempo em milissegundos para verificar e limpar salas vazias
const ROOM_CLEANUP_INTERVAL = 300000; // 5 minutos

const app = express();
const server = http.createServer(app);

// Configuração do Socket.IO com CORS ampliado
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir qualquer origem para desenv/debug - em produção seria FRONTEND_URL específico
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
    credentials: true
  },
  pingTimeout: 60000,    // Aumentado para 60 segundos
  pingInterval: 25000,   // Aumentado para 25 segundos
  transports: ['websocket', 'polling'] // Garantir uso de websocket e polling como fallback
});

// Configuração de CORS para o Express
app.use(cors({
  origin: "*", // Permitir qualquer origem para desenv/debug
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  credentials: true
}));

// Middleware para garantir cabeçalhos CORS em todas as respostas
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Permitir qualquer origem
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Tratamento especial para requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Rota de diagnóstico
app.get('/', (req, res) => {
  res.send(`Servidor ArteRápida rodando! CORS configurado para: ${FRONTEND_URL} (e temporariamente *)
    <br>Socket.IO disponível
    <br>Salas ativas: ${rooms.size}
  `);
});

// Rota de verificação CORS
app.get('/cors-test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'CORS configurado corretamente!',
    origin: req.headers.origin || 'desconhecido',
    timestamp: new Date().toISOString()
  });
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

// Buffer de pontos pendentes por sala
const pendingPointsByRoom = new Map();

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
  console.log(`Avaliando próxima rodada: atual=${room.round}, máxima=${room.maxRounds}`);
  
  if (room.round < room.maxRounds) {
    room.round++;
    console.log(`Avançando para rodada ${room.round}/${room.maxRounds}`);
    setTimeout(() => startRound(room, io), 2000); // Espera 2s antes de nova ronda
  } else {
    console.log(`Jogo finalizado após ${room.round}/${room.maxRounds} rodadas`);
    room.status = 'finished';
    io.to(room.id).emit('game-ended', {
      players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
        id, playerId, name, score, isHost, online
      }))
    });
  }
}

// Função para limpar salas vazias ou inativas
function cleanupRooms() {
  console.log(`Iniciando limpeza de salas vazias. Total de salas: ${rooms.size}`);
  let roomsRemoved = 0;
  
  for (const [code, room] of rooms.entries()) {
    // Verificar se a sala está vazia (não tem jogadores ou todos estão offline)
    const hasActivePlayers = room.players.some(p => p.online !== false);
    
    // Verificar se a sala está inativa há muito tempo
    const isInactive = room.status === 'waiting' && 
                      room.lastActivity && 
                      (Date.now() - room.lastActivity > 3600000); // 1 hora sem atividade
    
    if (!hasActivePlayers || isInactive) {
      console.log(`Removendo sala ${code}: ${!hasActivePlayers ? 'sem jogadores online' : 'inativa'}`);
      rooms.delete(code);
      pendingPointsByRoom.delete(code);
      roomsRemoved++;
    }
  }
  
  console.log(`Limpeza concluída. ${roomsRemoved} salas removidas. Restantes: ${rooms.size}`);
}

// Iniciar o limpador de salas a cada intervalo definido
setInterval(cleanupRooms, ROOM_CLEANUP_INTERVAL);

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
        lines: [], // Guardar linhas desenhadas
        points: [], // Adicionado para armazenar pontos individuais
        guessedPlayers: [],
        wordOptions: [],
        lastActivity: Date.now()
      });
      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = userName;
      console.log(`Sala ${roomCode} criada por ${userName}`);
      pendingPointsByRoom.set(roomCode, []);
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
      
      // Registrar atividade na sala
      room.lastActivity = Date.now();
      
      console.log(`Tentativa de entrada na sala ${roomCode} - Nome: ${userName}, PlayerId: ${playerId || 'não fornecido'}`);

      // ETAPA 1: Tentar encontrar jogador existente por playerId (mais confiável)
      let existingPlayer = null;
      if (playerId) {
        existingPlayer = room.players.find(p => p.playerId === playerId);
        if (existingPlayer) {
          console.log(`Jogador encontrado pelo playerId: ${existingPlayer.name}`);
        }
      }
      
      // ETAPA 2: Se não encontrou por playerId, tentar por nome exato e qualquer status
      if (!existingPlayer) {
        // Verificar se há jogador com o mesmo nome exato (online ou offline)
        const playerWithSameName = room.players.find(p => p.name === userName);
        if (playerWithSameName) {
          existingPlayer = playerWithSameName;
          console.log(`Jogador encontrado pelo nome exato: ${playerWithSameName.name}`);
        }
      }
      
      // Se o jogo já começou, só permitir reentrada de quem já estava na sala
      if (room.status !== 'waiting' && !existingPlayer) {
        return callback({ success: false, error: 'Jogo já iniciado' });
      }

      // CASO 1: Jogador está retornando à sala
      if (existingPlayer) {
        console.log(`${userName} reconectando à sala ${roomCode}`);
        
        // Atualizar dados essenciais
        existingPlayer.id = socket.id;
        existingPlayer.online = true;
        
        // Manter o mesmo playerId para consistência
        // Se não tinha playerId antes, atribuir o atual
        if (!existingPlayer.playerId) {
          existingPlayer.playerId = playerId || socket.id;
        }
        
        // Cancelar timeout de remoção se existir
        if (existingPlayer._removeTimeout) {
          clearTimeout(existingPlayer._removeTimeout);
          delete existingPlayer._removeTimeout;
        }
      } 
      // CASO 2: Novo jogador entrando na sala
      else {
        console.log(`Novo jogador ${userName} entrando na sala ${roomCode}`);
        
        // Verificar duplicação de nome com jogadores ONLINE
        const onlinePlayerWithSimilarName = room.players.find(p => 
          p.name.replace(/\s*\(\d+\)$/, '') === userName && 
          p.online !== false
        );
        
        let finalUserName = userName;
        
        if (onlinePlayerWithSimilarName) {
          // Nome base já existe com um jogador online, precisamos adicionar sufixo
          // Procurar o maior sufixo já existente para este nome
          const baseNamePattern = new RegExp(`^${userName}\\s*\\((\\d+)\\)$`);
          let highestSuffix = 0;
          
          room.players.forEach(p => {
            const match = p.name.match(baseNamePattern);
            if (match && parseInt(match[1]) > highestSuffix) {
              highestSuffix = parseInt(match[1]);
            }
          });
          
          // Incrementar o maior sufixo encontrado
          finalUserName = `${userName} (${highestSuffix + 1})`;
          console.log(`Nome duplicado, alterado para: ${finalUserName}`);
        }
        
        // Adicionar novo jogador
        room.players.push({
          id: socket.id,
          playerId: playerId || socket.id,
          name: finalUserName,
          score: 0,
          isHost: room.players.length === 0, // Primeiro jogador é host
          online: true
        });
      }

      // Associar o socket à sala
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userName = existingPlayer ? existingPlayer.name : userName;
      socket.data.playerId = existingPlayer ? existingPlayer.playerId : (playerId || socket.id);

      // Limpar jogadores desconectados com mesmo nome base
      const currentPlayer = room.players.find(p => p.id === socket.id);
      if (currentPlayer) {
        const baseNameCurrent = currentPlayer.name.replace(/\s*\(\d+\)$/, '');
        
        // Identificar jogadores offline com o mesmo nome base que podem ser removidos
        const staleOfflinePlayers = room.players.filter(p => 
          p.id !== socket.id && 
          p.online === false && 
          p.name.replace(/\s*\(\d+\)$/, '') === baseNameCurrent
        );
        
        if (staleOfflinePlayers.length > 0) {
          console.log(`Removendo ${staleOfflinePlayers.length} jogadores offline com nome base "${baseNameCurrent}"`);
          room.players = room.players.filter(p => 
            !(p.id !== socket.id && 
              p.online === false && 
              p.name.replace(/\s*\(\d+\)$/, '') === baseNameCurrent)
          );
        }
      }

      // Notificar todos na sala sobre o novo jogador/reconexão
      console.log(`Emitindo atualização para sala ${roomCode}, ${room.players.length} jogadores`);
      io.to(roomCode).emit('player-joined', {
        playerId: socket.data.playerId,
        playerName: socket.data.userName,
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
        points: room.points || [],
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
        
        // Registrar atividade na sala
        room.lastActivity = Date.now();
        
        // Encontrar jogador pelo playerId
        const player = room.players.find(p => p.playerId === playerId);
        if (player) {
          // Verificar se existem outros jogadores offline com o mesmo nome e removê-los
          // para evitar confusão na interface
          const otherOfflinePlayers = room.players.filter(p => 
            p.name === player.name && 
            p.online === false && 
            p.playerId !== player.playerId
          );
          
          if (otherOfflinePlayers.length > 0) {
            console.log(`Removendo ${otherOfflinePlayers.length} jogadores offline duplicados com nome "${player.name}"`);
            room.players = room.players.filter(p => 
              !(p.name === player.name && p.online === false && p.playerId !== player.playerId)
            );
          }
          
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
            
            // Contar jogadores online restantes
            const onlinePlayers = room.players.filter(p => p.online !== false);
            
            // Se não sobrou ninguém online, deletar a sala
            if (onlinePlayers.length === 0) {
              console.log(`Nenhum jogador online restante na sala ${roomCode}. Eliminando a sala.`);
              rooms.delete(roomCode);
              pendingPointsByRoom.delete(roomCode); // Limpa buffer de pontos pendentes
              console.log(`Sala ${roomCode} deletada pois ficou sem jogadores online`);
              return;
            }
            
            // Se o host saiu, passar o controle para outro jogador
            if (room.host === socket.id) {
              room.host = room.players[0].id;
              room.players.forEach((p, idx) => p.isHost = idx === 0); // Só o novo host tem isHost: true
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
    
    // Registrar atividade na sala
    room.lastActivity = Date.now();
    
    room.status = 'playing';
    room.round = 1;
    room.id = roomCode; // garantir que room tem id
    startRound(room, io);
  });

  // Receber traço do desenhista e repassar para a sala
  socket.on('draw-line', ({ roomCode, line, point, color, width }) => {
    if (!roomCode || (!line && !point)) return;
    const room = rooms.get(roomCode);
    if (!room) {
      console.log('Sala não encontrada:', roomCode);
      return;
    }
    
    console.log('Recebido draw-line:', { 
      roomCode, 
      temLine: !!line, 
      temPoint: !!point,
      color: color || 'default',
      width: width || 'default'
    });
    
    if (line) {
      // Recebemos uma linha completa - comportamento principal e preferido
      console.log('Recebida linha completa com ' + (line.points ? line.points.length : 0) + ' pontos');
      
      // Verificar se a linha tem pontos válidos
      if (!line.points || !Array.isArray(line.points) || line.points.length === 0) {
        console.log('Linha recebida sem pontos válidos, ignorando');
        return;
      }
      
      // Se houver pontos pendentes, adiciona-os à linha
      const pending = pendingPointsByRoom.get(roomCode) || [];
      if (pending.length > 0) {
        if (!line.points) line.points = [];
        line.points.push(...pending);
        pendingPointsByRoom.set(roomCode, []);
        console.log('Adicionados pontos pendentes à linha:', pending.length);
      }
      
      // Garantir que a linha tenha as propriedades color e width
      if (!line.color && color) line.color = color;
      if (!line.width && width) line.width = width;
      
      // Salvar linha e emitir para todos na sala
      room.lines.push(line);
      io.to(roomCode).emit('draw-line', { line });
      console.log('Linha completa enviada para todos os espectadores');
    } else if (point) {
      // Recebemos um ponto individual
      if (room.lines.length === 0) {
        // Se não temos linhas, criamos uma nova linha com este ponto
        const newLine = { 
          points: [point],
          color: color || '#222', 
          width: width || 3
        };
        room.lines.push(newLine);
        io.to(roomCode).emit('draw-line', { line: newLine });
        console.log('Criada nova linha com ponto inicial');
      } else {
        // Adicionamos o ponto à última linha
        const lastLine = room.lines[room.lines.length - 1];
        
        // Se não houver pontos na última linha, inicialize
        if (!lastLine.points) {
          lastLine.points = [];
        }
        
        // Garantir atributos de estilo na linha
        if (!lastLine.color && color) {
          lastLine.color = color;
        }
        if (!lastLine.width && width) {
          lastLine.width = width;
        }
        
        // Adicionar o ponto e enviar
        lastLine.points.push(point);
        io.to(roomCode).emit('draw-line', { 
          point, 
          color: lastLine.color || color || '#222', 
          width: lastLine.width || width || 3 
        });
        console.log('Ponto adicionado à linha existente e enviado');
      }
    }
  });

  // Palpites dos jogadores
  socket.on('guess', ({ roomCode, text }) => {
    if (!roomCode || !text) return;
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'playing') return;
    
    // Registrar atividade na sala
    room.lastActivity = Date.now();
    
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
      // Adicionar este jogador à lista de quem acertou (evitando duplicações)
      if (!room._correctPlayers.includes(socket.id)) {
        room._correctPlayers.push(socket.id);
      } else {
        // Jogador já acertou antes, não contar novamente
        console.log(`${userName} já tinha acertado, ignorando nova tentativa`);
        return;
      }
      
      // Pontuação para quem acerta: base 20 + bónus pelo tempo + bónus se for o primeiro
      const basePoints = 20;
      const timeBonus = Math.floor(timeLeft * 0.5); // mais rápido, mais pontos
      const firstBonus = isFirstCorrect ? 5 : 0;
      const playerPoints = Math.max(10, Math.min(50, basePoints + timeBonus + firstBonus));
      
      // Pontuação para o desenhista: 5 pontos por cada novo acerto
      const drawerPoints = 5; // 5 pontos por acerto
      
      // Jogador que acertou ganha pontos
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.score += playerPoints;
      
      // Desenhista ganha pontos (acumulando)
      const drawer = room.players.find(p => p.id === room.currentDrawer);
      if (drawer) drawer.score += drawerPoints; // BUG CORRIGIDO: agora soma-se 5 pontos a cada acerto
      
      console.log(`${userName} acertou a palavra! (+${playerPoints} pontos) | Desenhista (+${drawerPoints} pontos, total: ${drawer?.score || 0})`);
      
      // Atualizar todos os jogadores com a nova lista de pontuações
      io.to(roomCode).emit('players-update', {
        players: room.players.map(({ id, playerId, name, score, isHost, online }) => ({
          id, playerId, name, score, isHost, online
        })),
        drawerId: room.currentDrawer,
        round: room.round,
        maxRounds: room.maxRounds
      });
      
      // Se todos os jogadores (exceto o desenhista) já acertaram, termina a ronda
      const totalPlayers = room.players.filter(p => p.id !== room.currentDrawer && p.online !== false).length;
      if (totalPlayers > 0 && room._correctPlayers.length >= totalPlayers) {
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
    
    // Limpar os pontos e linhas
    room.lines = [];
    if (room.points) {
      room.points = [];
    }
    
    // Notificar todos na sala
    io.to(roomCode).emit('clear-canvas');
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

  // Manipulador para desenho por pontos (conectados em linhas)
  socket.on('draw-point', ({ roomCode, x, y, color, size, isStartOfLine, pressure }) => {
    if (!roomCode) {
      console.log('Erro: roomCode ausente');
      return;
    }
    
    const room = rooms.get(roomCode);
    if (!room) {
      console.log('Sala não encontrada:', roomCode);
      return;
    }
    
    // Dados completos do ponto
    const pointData = { 
      x, 
      y, 
      color, 
      size,
      pressure: pressure || 0.5,
      isStartOfLine,
      clientId: socket.id, // Identificar quem está desenhando
      timestamp: Date.now()
    };
    
    console.log(`BACKEND recebeu ponto de ${socket.id} para sala ${roomCode}`);
    
    // Armazenar o ponto
    if (!room.points) {
      room.points = [];
    }
    room.points.push(pointData);
    
    // Enviar para TODOS na sala, INCLUINDO o remetente (para confirmar visualmente)
    io.to(roomCode).emit('draw-point', pointData);
  });
  
  // Encerrar o jogo quando alguém acerta na última rodada
  socket.on('end-game', ({ roomCode }) => {
    console.log(`Recebido pedido para encerrar o jogo na sala ${roomCode}`);
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Limpar qualquer timer ativo
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
    }
    
    // Definir o status da sala como finalizado
    room.status = 'finished';
    
    // Ordenar jogadores por pontuação
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    
    // Enviar evento de fim de jogo com o pódio
    io.to(roomCode).emit('game-ended', {
      players: sortedPlayers.map(({ id, playerId, name, score, isHost, online }) => ({
        id, playerId, name, score, isHost, online
      }))
    });
    
    console.log(`Jogo encerrado na sala ${roomCode}. Pódio: ${sortedPlayers.map(p => p.name + ' (' + p.score + ')').join(', ')}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
}); 