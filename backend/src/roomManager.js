/**
 * Gerenciador de Salas Avançado do ArteRápida
 * Sistema completo para criação e gestão de salas de jogo
 */

const { gameCache } = require('./cache');
const { getRandomWord, getRandomWordFromCategory } = require('./words');
const EventEmitter = require('events');

class RoomManager extends EventEmitter {
  constructor() {
    super();
    this.rooms = new Map();
    this.privateRooms = new Map(); // Salas com senha
    this.roomCategories = new Map(); // Categorias personalizadas por sala
    this.customWords = new Map(); // Palavras personalizadas por sala
    this.roomSettings = new Map(); // Configurações avançadas
    this.cleanupInterval = null;
    this.startCleanupScheduler();
  }

  // Criar sala com configurações avançadas
  createRoom(hostSocketId, roomData) {
    const roomCode = this.generateRoomCode();
    
    const room = {
      id: roomCode,
      host: hostSocketId,
      players: [],
      status: 'waiting', // waiting, playing, paused, finished
      currentDrawer: null,
      currentWord: null,
      round: 0,
      maxRounds: roomData.rounds || 3,
      timePerRound: roomData.timePerRound || 60,
      difficulty: roomData.difficulty || 'facil',
      category: roomData.category || 'all',
      
      // Novas funcionalidades
      isPrivate: roomData.isPrivate || false,
      password: roomData.password || null,
      allowSpectators: roomData.allowSpectators || true,
      maxPlayers: roomData.maxPlayers || 8,
      
      // Configurações avançadas
      settings: {
        allowChat: roomData.allowChat !== false,
        allowHints: roomData.allowHints !== false,
        autoStart: roomData.autoStart || false,
        drawingTimeout: roomData.drawingTimeout || 60,
        guessTimeout: roomData.guessTimeout || 10,
        showWordLength: roomData.showWordLength !== false,
        allowSkip: roomData.allowSkip !== false,
        competitiveMode: roomData.competitiveMode || false
      },
      
      // Metadados
      createdAt: Date.now(),
      lastActivity: Date.now(),
      wordHistory: [],
      gameStats: {
        totalWords: 0,
        averageGuessTime: 0,
        fastestGuess: null,
        slowestGuess: null,
        mostActivePlayer: null
      },
      
      // Sistema de moderação
      moderation: {
        bannedPlayers: new Set(),
        mutedPlayers: new Set(),
        warnings: new Map()
      }
    };

    this.rooms.set(roomCode, room);
    
    if (room.isPrivate) {
      this.privateRooms.set(roomCode, room);
    }
    
    // Palavras personalizadas se fornecidas
    if (roomData.customWords && roomData.customWords.length > 0) {
      this.customWords.set(roomCode, roomData.customWords);
    }
    
    // Cache da sala
    gameCache.set(`room:${roomCode}`, room, 3600000); // 1 hora
    
    this.emit('roomCreated', room);
    console.log(`Sala ${roomCode} criada por ${hostSocketId}`, {
      private: room.isPrivate,
      category: room.category,
      difficulty: room.difficulty,
      maxPlayers: room.maxPlayers
    });
    
    return room;
  }

  // Entrar em sala com validação de senha
  joinRoom(roomCode, player, password = null) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { error: 'Sala não encontrada' };
    }

    // Verificar senha para salas privadas
    if (room.isPrivate && room.password && room.password !== password) {
      return { error: 'Senha incorreta' };
    }

    // Verificar se o jogador está banido
    if (room.moderation.bannedPlayers.has(player.id)) {
      return { error: 'Você foi banido desta sala' };
    }

    // Verificar limite de jogadores
    if (room.players.length >= room.maxPlayers) {
      if (!room.allowSpectators) {
        return { error: 'Sala cheia' };
      }
      // Adicionar como espectador
      player.isSpectator = true;
    }

    // Verificar nomes duplicados
    const existingPlayer = room.players.find(p => 
      p.name.toLowerCase() === player.name.toLowerCase() && !p.isTemporarilyDisconnected
    );
    
    if (existingPlayer) {
      return { error: 'Nome já existe na sala' };
    }

    // Verificar se o jogo já começou
    if (room.status === 'playing' && !room.allowSpectators) {
      return { error: 'Jogo em andamento - espectadores não permitidos' };
    }

    room.players.push(player);
    room.lastActivity = Date.now();
    
    this.emit('playerJoined', room, player);
    this.updateRoomCache(roomCode, room);
    
    // Auto-iniciar se configurado
    if (room.settings.autoStart && room.players.filter(p => !p.isSpectator).length >= 2) {
      setTimeout(() => this.startGame(roomCode), 3000);
    }
    
    return { success: true, room };
  }

  // Iniciar jogo com validações
  startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'waiting') {
      return { error: 'Não é possível iniciar o jogo' };
    }

    const activePlayers = room.players.filter(p => !p.isSpectator && !p.isTemporarilyDisconnected);
    if (activePlayers.length < 2) {
      return { error: 'Mínimo 2 jogadores ativos necessários' };
    }

    room.status = 'playing';
    room.round = 0;
    room.lastActivity = Date.now();
    
    // Resetar estatísticas do jogo
    room.gameStats = {
      totalWords: 0,
      averageGuessTime: 0,
      fastestGuess: null,
      slowestGuess: null,
      mostActivePlayer: null
    };
    
    this.emit('gameStarted', room);
    this.startNextRound(room);
    
    return { success: true };
  }

  // Escolher palavra baseada nas configurações da sala
  selectWord(room) {
    // Priorizar palavras personalizadas
    const customWords = this.customWords.get(room.id);
    if (customWords && customWords.length > 0) {
      const unusedWords = customWords.filter(word => 
        !room.wordHistory.some(entry => entry.word === word)
      );
      
      if (unusedWords.length > 0) {
        return unusedWords[Math.floor(Math.random() * unusedWords.length)];
      }
    }

    // Usar categoria específica se selecionada
    if (room.category && room.category !== 'all') {
      const categoryWord = getRandomWordFromCategory(room.category.toUpperCase(), room.difficulty);
      if (categoryWord) return categoryWord;
    }

    // Fallback para palavra aleatória geral
    return getRandomWord(room.difficulty);
  }

  // Sistema de dicas inteligente
  generateHint(room, type = 'length') {
    if (!room.settings.allowHints || !room.currentWord) {
      return null;
    }

    const word = room.currentWord;
    
    switch (type) {
      case 'length':
        return `A palavra tem ${word.length} letras`;
      
      case 'category':
        if (room.category && room.category !== 'all') {
          return `Categoria: ${room.category}`;
        }
        return 'Dica de categoria não disponível';
      
      case 'first_letter':
        return `Primeira letra: ${word.charAt(0).toUpperCase()}`;
      
      case 'vowels':
        const vowels = word.match(/[aeiouáéíóúâêîôûàèìòùãõç]/gi);
        return vowels ? `Vogais: ${vowels.join(', ')}` : 'Sem vogais especiais';
      
      case 'syllables':
        // Estimativa simples de sílabas
        const syllableCount = word.split(/[aeiouáéíóúâêîôûàèìòùãõ]/gi).length - 1;
        return `Número de sílabas: ${syllableCount}`;
      
      default:
        return this.generateHint(room, 'length');
    }
  }

  // Pausar/Retomar jogo
  pauseGame(roomCode, reason = 'Pausado pelo host') {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'playing') {
      return { error: 'Jogo não pode ser pausado' };
    }

    room.status = 'paused';
    room.pauseReason = reason;
    room.pausedAt = Date.now();
    
    this.emit('gamePaused', room, reason);
    return { success: true };
  }

  resumeGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'paused') {
      return { error: 'Jogo não está pausado' };
    }

    room.status = 'playing';
    delete room.pauseReason;
    delete room.pausedAt;
    
    this.emit('gameResumed', room);
    return { success: true };
  }

  // Sistema de moderação
  banPlayer(roomCode, playerId, hostId, reason = 'Violação das regras') {
    const room = this.rooms.get(roomCode);
    if (!room || room.host !== hostId) {
      return { error: 'Sem permissão para banir' };
    }

    room.moderation.bannedPlayers.add(playerId);
    
    // Remover jogador da sala
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
      const bannedPlayer = room.players[playerIndex];
      room.players.splice(playerIndex, 1);
      
      this.emit('playerBanned', room, bannedPlayer, reason);
    }

    return { success: true };
  }

  mutePlayer(roomCode, playerId, hostId, duration = 300000) { // 5 minutos default
    const room = this.rooms.get(roomCode);
    if (!room || room.host !== hostId) {
      return { error: 'Sem permissão para silenciar' };
    }

    room.moderation.mutedPlayers.add(playerId);
    
    // Auto-unmute após duração
    setTimeout(() => {
      room.moderation.mutedPlayers.delete(playerId);
      this.emit('playerUnmuted', room, playerId);
    }, duration);

    this.emit('playerMuted', room, playerId, duration);
    return { success: true };
  }

  // Transferir host
  transferHost(roomCode, currentHostId, newHostId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.host !== currentHostId) {
      return { error: 'Sem permissão para transferir host' };
    }

    const newHost = room.players.find(p => p.id === newHostId);
    if (!newHost) {
      return { error: 'Novo host não encontrado na sala' };
    }

    room.host = newHostId;
    newHost.isHost = true;
    
    // Remover status de host do anterior
    const oldHost = room.players.find(p => p.id === currentHostId);
    if (oldHost) {
      oldHost.isHost = false;
    }

    this.emit('hostTransferred', room, currentHostId, newHostId);
    return { success: true };
  }

  // Obter estatísticas da sala
  getRoomStats(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      roomCode,
      players: room.players.length,
      status: room.status,
      round: room.round,
      maxRounds: room.maxRounds,
      isPrivate: room.isPrivate,
      settings: room.settings,
      gameStats: room.gameStats,
      uptime: Date.now() - room.createdAt,
      lastActivity: room.lastActivity
    };
  }

  // Listar salas públicas disponíveis
  getPublicRooms() {
    const publicRooms = Array.from(this.rooms.values())
      .filter(room => !room.isPrivate && room.status === 'waiting')
      .map(room => ({
        code: room.id,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        difficulty: room.difficulty,
        category: room.category,
        host: room.players.find(p => p.isHost)?.name || 'Anônimo',
        createdAt: room.createdAt
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20); // Limitar a 20 salas

    return publicRooms;
  }

  // Utilidades
  generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    // Verificar se o código já existe
    if (this.rooms.has(result)) {
      return this.generateRoomCode();
    }
    
    return result;
  }

  updateRoomCache(roomCode, room) {
    gameCache.set(`room:${roomCode}`, room, 3600000);
  }

  startCleanupScheduler() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveRooms();
    }, 30 * 60 * 1000); // A cada 30 minutos
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    this.rooms.forEach((room, roomCode) => {
      // Remover salas vazias há mais de 1 hora
      if (room.players.length === 0 && (now - room.lastActivity) > oneHour) {
        this.deleteRoom(roomCode);
      }
      
      // Remover salas inativas há mais de 2 horas
      if ((now - room.lastActivity) > (2 * oneHour)) {
        this.deleteRoom(roomCode);
      }
    });
  }

  deleteRoom(roomCode) {
    const room = this.rooms.get(roomCode);
    if (room) {
      this.rooms.delete(roomCode);
      this.privateRooms.delete(roomCode);
      this.customWords.delete(roomCode);
      this.roomSettings.delete(roomCode);
      gameCache.del(`room:${roomCode}`);
      
      this.emit('roomDeleted', roomCode);
      console.log(`Sala ${roomCode} deletada na limpeza automática`);
    }
  }

  // Obter estatísticas gerais
  getGlobalStats() {
    const totalRooms = this.rooms.size;
    const privateRooms = this.privateRooms.size;
    const activeGames = Array.from(this.rooms.values()).filter(r => r.status === 'playing').length;
    const totalPlayers = Array.from(this.rooms.values()).reduce((sum, room) => sum + room.players.length, 0);

    return {
      totalRooms,
      privateRooms,
      publicRooms: totalRooms - privateRooms,
      activeGames,
      waitingRooms: totalRooms - activeGames,
      totalPlayers,
      averagePlayersPerRoom: totalRooms > 0 ? totalPlayers / totalRooms : 0
    };
  }

  // Cleanup ao finalizar
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.rooms.clear();
    this.privateRooms.clear();
    this.customWords.clear();
    this.roomSettings.clear();
  }
}

module.exports = RoomManager;