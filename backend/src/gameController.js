import { WORDS_FACIL, WORDS_MEDIO, WORDS_DIFICIL } from './gameData.js';
import { normalizeText } from './utils.js';

// Função para gerar código aleatório de 6 caracteres
export function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Função para iniciar uma nova ronda
export function startRound(room, io) {
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
export function nextRoundOrEnd(room, io) {
  if (room.round < room.maxRounds) {
    room.round++;
    setTimeout(() => startRound(room, io), 3000);
  } else {
    room.status = 'finished';
    io.to(room.id).emit('game-ended', { players: room.players });
  }
}

// Função para gerir saída de jogador durante o jogo
export function handlePlayerLeaveDuringGame(room, playerId, userName, io) {
  const isDrawer = room.currentDrawer === playerId;
  const isHost = room.host === playerId;
  
  // Se o desenhista saiu
  if (isDrawer && room.status === 'playing') {
    // Parar timer atual
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    
    // Notificar saída do desenhista
    io.to(room.id).emit('drawer-left', {
      drawerName: userName,
      message: `${userName} (desenhista) saiu da sala`
    });
    
    // Resetar estado da ronda atual
    room.currentDrawer = null;
    room.currentWord = null;
    
    // Se restam 2+ jogadores, continuar jogo
    if (room.players.length >= 2) {
      io.to(room.id).emit('round-ended', { 
        reason: 'drawer-left',
        message: `Avançando para próxima ronda em 3 segundos...`
      });
      setTimeout(() => nextRoundOrEnd(room, io), 3000);
    } else {
      // Pausar jogo se poucos jogadores
      pauseGame(room, io, 'Poucos jogadores. Aguardando mais jogadores...');
    }
  }
  
  // Se o host saiu, transferir para outro jogador
  if (isHost && room.players.length > 0) {
    const newHost = room.players[0];
    room.host = newHost.id;
    newHost.isHost = true;
    
    io.to(room.id).emit('host-changed', {
      newHostId: newHost.id,
      newHostName: newHost.name,
      message: `${newHost.name} é agora o anfitrião da sala`
    });
  }
  
  // Verificar se o jogo deve ser pausado
  if (room.status === 'playing' && room.players.length < 2) {
    pauseGame(room, io, 'Jogo pausado: mínimo 2 jogadores necessários');
  }
}

// Função para gerir entrada de jogador durante o jogo
export function handlePlayerJoinDuringGame(room, playerId, userName, io) {
  const newPlayer = {
    id: playerId,
    name: userName,
    score: 0,
    isHost: false,
    isSpectator: room.status === 'playing' // Se jogo em andamento, entrar como espectador
  };
  
  room.players.push(newPlayer);
  
  if (newPlayer.isSpectator) {
    // Notificar entrada como espectador
    io.to(room.id).emit('spectator-joined', {
      playerName: userName,
      message: `${userName} entrou como espectador`
    });
    
    // Enviar estado atual do jogo para o espectador
    io.to(playerId).emit('spectator-state', {
      isSpectator: true,
      currentWord: room.currentWord ? '?' : null, // Não revelar palavra
      round: room.round,
      maxRounds: room.maxRounds,
      drawerId: room.currentDrawer,
      timeLeft: room._lastTimeLeft || 0
    });
  } else {
    // Entrada normal (jogo não iniciado)
    io.to(room.id).emit('player-joined', {
      playerId: playerId,
      playerName: userName,
      players: room.players
    });
    
    // Se jogo estava pausado, verificar se pode retomar
    if (room.status === 'paused' && room.players.length >= 2) {
      resumeGame(room, io);
    }
  }
}

// Função para pausar o jogo
export function pauseGame(room, io, reason = 'Jogo pausado') {
  room.status = 'paused';
  room.pauseReason = reason;
  
  // Parar timer se ativo
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  
  io.to(room.id).emit('game-paused', {
    reason: reason,
    playersCount: room.players.length,
    minPlayers: 2
  });
}

// Função para retomar o jogo
export function resumeGame(room, io) {
  room.status = 'playing';
  delete room.pauseReason;
  
  io.to(room.id).emit('game-resumed', {
    message: 'Jogo retomado!',
    playersCount: room.players.length
  });
  
  // Se havia uma ronda em andamento, continuar
  if (room.currentWord && room.currentDrawer) {
    // Retomar timer
    let timeLeft = room._lastTimeLeft || 30; // Default 30s se não há tempo salvo
    room.timerInterval = setInterval(() => {
      timeLeft--;
      room._lastTimeLeft = timeLeft;
      io.to(room.id).emit('timer-update', { timeLeft });
      
      if (timeLeft <= 0) {
        clearInterval(room.timerInterval);
        io.to(room.id).emit('word-reveal', { word: room.currentWord });
        io.to(room.id).emit('round-ended', { reason: 'timeout' });
        nextRoundOrEnd(room, io);
      }
    }, 1000);
  } else {
    // Iniciar nova ronda
    setTimeout(() => startRound(room, io), 2000);
  }
}

// Função para promover espectador a jogador
export function promoteSpectatorToPlayer(room, playerId, io) {
  const player = room.players.find(p => p.id === playerId);
  if (player && player.isSpectator) {
    player.isSpectator = false;
    
    io.to(room.id).emit('spectator-promoted', {
      playerName: player.name,
      message: `${player.name} entrou no jogo!`
    });
    
    io.to(room.id).emit('players-update', {
      players: room.players,
      drawerId: room.currentDrawer,
      round: room.round,
      maxRounds: room.maxRounds
    });
    
    return true;
  }
  return false;
}

// Função para verificar se o jogo deve continuar
export function checkGameContinuity(room, io) {
  const activePlayers = room.players.filter(p => !p.isSpectator);
  
  if (activePlayers.length < 2 && room.status === 'playing') {
    pauseGame(room, io, 'Jogo pausado: mínimo 2 jogadores ativos necessários');
    return false;
  }
  
  return true;
} 