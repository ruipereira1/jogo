/**
 * Lógica Central do Jogo ArteRápida
 * Separação das responsabilidades para melhor manutenção
 */

const { gameCache } = require('./cache');
const { getRandomWord, getRandomWordFromCategory } = require('./words');
const EventEmitter = require('events');

class GameManager extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.gameTimers = new Map();
    this.cleanupInterval = null;
    this.startCleanupScheduler();
  }

  // Melhor gestão de salas
  createRoom(roomCode, hostSocketId, roomData) {
    const room = {
      id: roomCode,
      host: hostSocketId,
      players: [],
      status: 'waiting',
      currentDrawer: null,
      currentWord: null,
      round: 0,
      maxRounds: roomData.rounds || 3,
      timePerRound: 60,
      difficulty: roomData.difficulty || 'facil',
      category: roomData.category || 'all', // Nova funcionalidade: categorias
      createdAt: Date.now(),
      lastActivity: Date.now(),
      wordHistory: [],
      gameStats: {
        totalWords: 0,
        averageGuessTime: 0,
        fastestGuess: null,
        slowestGuess: null
      },
      settings: {
        allowChat: true,
        allowHints: true,
        customWords: [], // Nova funcionalidade: palavras personalizadas
        maxPlayers: 8,
        drawingTimeout: 60,
        guessTimeout: 10
      }
    };

    this.rooms.set(roomCode, room);
    this.emit('roomCreated', room);
    
    // Cache da sala para acesso rápido
    gameCache.set(`room:${roomCode}`, room, 3600000); // 1 hora
    
    return room;
  }

  addPlayerToRoom(roomCode, player) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // Verificar limite de jogadores
    if (room.players.length >= room.settings.maxPlayers) {
      return { error: 'Sala cheia' };
    }

    // Verificar nomes duplicados
    const existingPlayer = room.players.find(p => 
      p.name.toLowerCase() === player.name.toLowerCase() && !p.isTemporarilyDisconnected
    );
    
    if (existingPlayer) {
      return { error: 'Nome já existe na sala' };
    }

    room.players.push(player);
    room.lastActivity = Date.now();
    
    this.emit('playerJoined', room, player);
    this.updateRoomCache(roomCode, room);
    
    return { success: true, room };
  }

  removePlayerFromRoom(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;

    const removedPlayer = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    room.lastActivity = Date.now();

    // Se era o desenhista atual, passar para próximo
    if (room.currentDrawer === playerId) {
      this.handleDrawerLeft(room);
    }

    // Se era o host, transferir para outro jogador
    if (room.host === playerId && room.players.length > 0) {
      room.host = room.players[0].id;
      room.players[0].isHost = true;
    }

    this.emit('playerLeft', room, removedPlayer);
    this.updateRoomCache(roomCode, room);

    return removedPlayer;
  }

  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'waiting') return false;

    if (room.players.length < 2) {
      return { error: 'Mínimo 2 jogadores necessários' };
    }

    room.status = 'playing';
    room.round = 0;
    room.lastActivity = Date.now();
    
    this.emit('gameStarted', room);
    this.startNextRound(room);
    
    return { success: true };
  }

  startNextRound(room) {
    room.round++;
    
    if (room.round > room.maxRounds) {
      this.endGame(room);
      return;
    }

    // Escolher próximo desenhista
    const availableDrawers = room.players.filter(p => !p.isTemporarilyDisconnected);
    if (availableDrawers.length === 0) {
      this.endGame(room);
      return;
    }

    // Algoritmo melhorado para escolher desenhista
    let nextDrawer;
    if (room.currentDrawer) {
      const currentIndex = availableDrawers.findIndex(p => p.id === room.currentDrawer);
      nextDrawer = availableDrawers[(currentIndex + 1) % availableDrawers.length];
    } else {
      nextDrawer = availableDrawers[0];
    }

    room.currentDrawer = nextDrawer.id;
    
    // Escolher palavra baseada na categoria selecionada
    room.currentWord = this.selectWord(room.difficulty, room.category, room.settings.customWords);
    
    if (!room.currentWord) {
      room.currentWord = getRandomWord(room.difficulty);
    }

    // Estatísticas da ronda
    room.currentRoundStats = {
      startTime: Date.now(),
      word: room.currentWord,
      drawer: nextDrawer.name,
      guesses: [],
      correctGuesses: []
    };

    this.emit('roundStarted', room);
    this.startRoundTimer(room);
    this.updateRoomCache(room.id, room);
  }

  selectWord(difficulty, category, customWords = []) {
    // Priorizar palavras personalizadas se existirem
    if (customWords.length > 0) {
      const randomIndex = Math.floor(Math.random() * customWords.length);
      return customWords[randomIndex];
    }

    // Usar categoria específica se selecionada
    if (category && category !== 'all') {
      return getRandomWordFromCategory(category.toUpperCase(), difficulty);
    }

    // Fallback para palavra aleatória geral
    return getRandomWord(difficulty);
  }

  handleCorrectGuess(room, playerId, playerName, guessTime) {
    const roundStats = room.currentRoundStats;
    const responseTime = Date.now() - roundStats.startTime;

    // Calcular pontos baseado no tempo
    const basePoints = 10;
    const timeBonus = Math.max(0, Math.floor((60 - responseTime / 1000) / 10));
    const totalPoints = basePoints + timeBonus;

    // Atualizar pontuação do jogador
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.score += totalPoints;
    }

    // Dar pontos ao desenhista
    const drawer = room.players.find(p => p.id === room.currentDrawer);
    if (drawer) {
      drawer.score += 5;
    }

    // Registrar guess correto
    roundStats.correctGuesses.push({
      playerId,
      playerName,
      responseTime,
      points: totalPoints,
      timestamp: Date.now()
    });

    // Atualizar estatísticas gerais
    this.updateGameStats(room, responseTime);

    this.emit('correctGuess', room, playerId, playerName, totalPoints);
    return totalPoints;
  }

  updateGameStats(room, responseTime) {
    const stats = room.gameStats;
    stats.totalWords++;
    
    // Calcular tempo médio
    const currentAvg = stats.averageGuessTime;
    stats.averageGuessTime = ((currentAvg * (stats.totalWords - 1)) + responseTime) / stats.totalWords;

    // Atualizar recordes
    if (!stats.fastestGuess || responseTime < stats.fastestGuess) {
      stats.fastestGuess = responseTime;
    }
    
    if (!stats.slowestGuess || responseTime > stats.slowestGuess) {
      stats.slowestGuess = responseTime;
    }
  }

  startRoundTimer(room) {
    this.clearRoomTimers(room.id);

    const roundDuration = room.settings.drawingTimeout;
    let timeLeft = roundDuration;
    
    const hintsConfig = [
      { time: roundDuration * 0.75, type: 'length' },
      { time: roundDuration * 0.5, type: 'first_last' },
      { time: roundDuration * 0.25, type: 'vowel' }
    ];

    const timer = setInterval(() => {
      timeLeft--;
      room.timeLeft = timeLeft;

      // Enviar dicas em tempos específicos
      const hintToSend = hintsConfig.find(h => Math.abs(h.time - timeLeft) < 1);
      if (hintToSend && room.settings.allowHints) {
        const hint = this.generateHint(room.currentWord, hintToSend.type, room.category);
        if (hint) {
          this.emit('hint', room, hint);
        }
      }

      if (timeLeft <= 0) {
        this.endRound(room);
      } else {
        this.emit('timerUpdate', room, timeLeft);
      }
    }, 1000);

    this.gameTimers.set(room.id, timer);
  }

  generateHint(word, type, category = 'all') {
    const wordLower = word.toLowerCase();
    let hintText = '';
    let hintType = 'info';

    switch (type) {
      case 'length':
        hintText = `A palavra tem ${word.length} letras.`;
        break;
      case 'first_last':
        hintText = `Começa com '${word[0]}' e termina com '${word[word.length - 1]}'.`;
        break;
      case 'vowel':
        const vowels = 'aeiou';
        const wordVowels = [...wordLower].filter(char => vowels.includes(char));
        if (wordVowels.length > 0) {
          const randomVowel = wordVowels[Math.floor(Math.random() * wordVowels.length)];
          hintText = `A palavra contém a vogal '${randomVowel}'.`;
        }
        break;
      case 'category':
        if (category && category !== 'all') {
          hintText = `Categoria: ${category}`;
        }
        break;
      default:
        // Por defeito, mostra o padrão da palavra (ex: _ _ R _ A)
        const revealedChars = Math.floor(word.length / 3);
        let revealed = Array(word.length).fill('_');
        for (let i = 0; i < revealedChars; i++) {
          let randomIndex;
          do {
            randomIndex = Math.floor(Math.random() * word.length);
          } while (revealed[randomIndex] !== '_');
          revealed[randomIndex] = word[randomIndex];
        }
        hintText = revealed.join(' ');
        hintType = 'pattern';
        break;
    }
    
    if (hintText) {
      return { hint: hintText, type: hintType };
    }
    return null;
  }

  endRound(room) {
    const timerId = this.gameTimers.get(room.id);
    if (timerId) {
      clearInterval(timerId);
      this.gameTimers.delete(room.id);
    }
    
    // Assegurar que currentRoundStats existe
    if (!room.currentRoundStats) {
      // Se não houver estatísticas da ronda (ex: desenhista saiu logo), apenas começa a próxima
      this.startNextRound(room);
      return;
    }

    const { word, drawer, correctGuesses } = room.currentRoundStats;
    
    // Construir o sumário da ronda
    const summary = {
      word,
      drawer,
      players: room.players.map(p => {
        const correctGuess = correctGuesses.find(g => g.playerId === p.id);
        return {
          id: p.id,
          name: p.name,
          score: p.score,
          pointsGained: correctGuess ? correctGuess.points : 0
        };
      })
    };

    room.wordHistory.push({
      round: room.round,
      word,
      drawer,
      guessedBy: correctGuesses.map(g => g.playerName)
    });
    
    this.emit('roundSummary', room, summary);

    // Agendar o início da próxima ronda após um breve intervalo para o sumário
    const summaryDuration = 7000; // 7 segundos para o sumário
    const nextRoundTimer = setTimeout(() => {
      this.startNextRound(room);
    }, summaryDuration);

    this.gameTimers.set(`${room.id}:nextRound`, nextRoundTimer);
  }

  endGame(room) {
    room.status = 'finished';
    
    // Limpar todos os timers da sala
    this.clearRoomTimers(room.id);

    // Calcular ranking final
    const finalRanking = room.players
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        ...player,
        position: index + 1
      }));

    room.finalRanking = finalRanking;
    
    this.emit('gameEnded', room, finalRanking);
    this.updateRoomCache(room.id, room);
  }

  handleDrawerLeft(room) {
    // Se o desenhista saiu, terminar ronda atual
    if (room.status === 'playing') {
      this.endRound(room);
    }
  }

  clearRoomTimers(roomId) {
    // Limpar todos os timers relacionados a esta sala
    for (const [key, timerId] of this.gameTimers.entries()) {
      if (key === roomId || key.startsWith(`${roomId}:`)) {
        clearInterval(timerId); // Usar clearInterval para timers de jogo
        clearTimeout(timerId);  // E clearTimeout para próximas rondas
        this.gameTimers.delete(key);
      }
    }
  }

  updateRoomCache(roomCode, room) {
    gameCache.set(`room:${roomCode}`, room, 3600000);
  }

  startCleanupScheduler() {
    // Limpar salas inativas a cada 30 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 30 * 60 * 1000);
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    const maxInactiveTime = 2 * 60 * 60 * 1000; // 2 horas

    for (const [roomCode, room] of this.rooms.entries()) {
      if (now - room.lastActivity > maxInactiveTime) {
        this.deleteRoom(roomCode);
      }
    }
  }

  deleteRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (room) {
      this.clearRoomTimers(roomCode);
      this.rooms.delete(roomCode);
      gameCache.delete(`room:${roomCode}`);
      this.emit('roomDeleted', roomCode, room);
    }
  }

  getRoom(roomCode) {
    // Tentar buscar no cache primeiro
    let room = gameCache.get(`room:${roomCode}`);
    if (!room) {
      room = this.rooms.get(roomCode);
      if (room) {
        this.updateRoomCache(roomCode, room);
      }
    }
    return room;
  }

  getRoomStats() {
    return {
      totalRooms: this.rooms.size,
      activeRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length,
      totalPlayers: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.players.length, 0),
      cacheStats: gameCache.getStats()
    };
  }
}

module.exports = new GameManager(); 