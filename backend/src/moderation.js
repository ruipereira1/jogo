/**
 * Sistema de Moderação para ArteRápida
 * Filtra palavrões, spam e conteúdo inadequado
 */

const Filter = require('bad-words');

class ModerationSystem {
  constructor() {
    this.filter = new Filter();
    this.setupPortugueseWords();
    this.spamDetection = new Map(); // userId -> lastMessages[]
    this.bannedWords = new Set();
    this.warningList = new Map(); // userId -> warnings count
    
    // Configurações
    this.maxMessagesPerMinute = 10;
    this.maxWarnings = 3;
    this.similarMessageThreshold = 0.8;
  }

  setupPortugueseWords() {
    // Lista de palavrões em português
    const portugueseBadWords = [
      'idiota', 'estupido', 'burro', 'tonto', 'imbecil', 'otario', 'babaca',
      'merda', 'bosta', 'porra', 'caralho', 'foda', 'puta', 'viado',
      'bicha', 'corno', 'piranha', 'vagabundo', 'fdp', 'filho da puta',
      'buceta', 'cu', 'rola', 'pau', 'pinto', 'cacete', 'broxa',
      'arrombado', 'desgraça', 'desgraçado', 'maldito', 'infeliz',
      'cretino', 'retardado', 'mongoloid', 'deficiente', 'aleijado'
    ];
    
    // Adicionar palavras portuguesas ao filtro
    this.filter.addWords(...portugueseBadWords);
  }

  // Filtrar mensagens de chat
  moderateMessage(userId, username, message) {
    const result = {
      isAllowed: true,
      filteredMessage: message,
      warning: null,
      action: null
    };

    // 1. Verificar spam
    const spamCheck = this.checkSpam(userId, message);
    if (!spamCheck.isAllowed) {
      result.isAllowed = false;
      result.warning = spamCheck.reason;
      result.action = 'spam_detected';
      return result;
    }

    // 2. Filtrar palavrões
    const profanityCheck = this.filterProfanity(message);
    result.filteredMessage = profanityCheck.filteredMessage;
    
    if (profanityCheck.hasProfanity) {
      this.addWarning(userId, username);
      result.warning = `Linguagem inadequada detectada. Advertências: ${this.getWarnings(userId)}/${this.maxWarnings}`;
      
      if (this.getWarnings(userId) >= this.maxWarnings) {
        result.action = 'temporary_ban';
        result.isAllowed = false;
      }
    }

    // 3. Verificar tentativa de revelar palavra
    const spoilerCheck = this.checkWordSpoiler(message);
    if (spoilerCheck.isSpoiler) {
      result.isAllowed = false;
      result.warning = 'Tentativa de revelar a palavra detectada!';
      result.action = 'spoiler_detected';
    }

    return result;
  }

  checkSpam(userId, message) {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Inicializar histórico se não existir
    if (!this.spamDetection.has(userId)) {
      this.spamDetection.set(userId, []);
    }

    const userMessages = this.spamDetection.get(userId);
    
    // Remover mensagens antigas (> 1 minuto)
    const recentMessages = userMessages.filter(msg => now - msg.timestamp < oneMinute);
    
    // Verificar quantidade de mensagens
    if (recentMessages.length >= this.maxMessagesPerMinute) {
      return {
        isAllowed: false,
        reason: 'Muitas mensagens enviadas. Aguarde um momento.'
      };
    }

    // Verificar mensagens similares (anti-spam)
    const similarMessages = recentMessages.filter(msg => 
      this.calculateSimilarity(message, msg.content) > this.similarMessageThreshold
    );

    if (similarMessages.length >= 3) {
      return {
        isAllowed: false,
        reason: 'Mensagem repetitiva detectada. Varie o conteúdo.'
      };
    }

    // Adicionar mensagem atual ao histórico
    recentMessages.push({
      content: message,
      timestamp: now
    });

    this.spamDetection.set(userId, recentMessages);

    return { isAllowed: true };
  }

  filterProfanity(message) {
    // Verificar se contém palavrões
    const hasProfanity = this.filter.isProfane(message);
    
    // Filtrar mensagem
    const filteredMessage = this.filter.clean(message);

    return {
      filteredMessage,
      hasProfanity
    };
  }

  checkWordSpoiler(message, currentWord = null) {
    if (!currentWord) return { isSpoiler: false };

    const normalizedMessage = this.normalizeText(message);
    const normalizedWord = this.normalizeText(currentWord);

    // Verificar se a mensagem contém a palavra exata
    if (normalizedMessage.includes(normalizedWord)) {
      return { isSpoiler: true };
    }

    // Verificar similaridade alta (possível tentativa de contornar)
    const similarity = this.calculateSimilarity(normalizedMessage, normalizedWord);
    if (similarity > 0.8) {
      return { isSpoiler: true };
    }

    return { isSpoiler: false };
  }

  normalizeText(text) {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, ' '); // Normaliza espaços
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  addWarning(userId, username) {
    const currentWarnings = this.warningList.get(userId) || 0;
    this.warningList.set(userId, currentWarnings + 1);
    
    console.log(`Advertência para ${username} (${userId}): ${currentWarnings + 1}/${this.maxWarnings}`);
  }

  getWarnings(userId) {
    return this.warningList.get(userId) || 0;
  }

  clearWarnings(userId) {
    this.warningList.delete(userId);
  }

  isUserBanned(userId) {
    return this.getWarnings(userId) >= this.maxWarnings;
  }

  // Moderar nomes de usuário
  moderateUsername(username) {
    const result = {
      isAllowed: true,
      suggestedName: username,
      reason: null
    };

    // Verificar comprimento
    if (username.length < 2 || username.length > 20) {
      result.isAllowed = false;
      result.reason = 'Nome deve ter entre 2 e 20 caracteres';
      return result;
    }

    // Filtrar palavrões
    const profanityCheck = this.filterProfanity(username);
    if (profanityCheck.hasProfanity) {
      result.isAllowed = false;
      result.reason = 'Nome contém linguagem inadequada';
      result.suggestedName = profanityCheck.filteredMessage;
      return result;
    }

    // Verificar caracteres especiais excessivos
    const specialCharCount = (username.match(/[^a-zA-Z0-9]/g) || []).length;
    if (specialCharCount > username.length * 0.3) {
      result.isAllowed = false;
      result.reason = 'Muitos caracteres especiais no nome';
      return result;
    }

    return result;
  }

  // Relatório de moderação
  getModerationReport() {
    return {
      totalWarnings: this.warningList.size,
      bannedUsers: Array.from(this.warningList.entries())
        .filter(([userId, warnings]) => warnings >= this.maxWarnings)
        .map(([userId, warnings]) => ({ userId, warnings })),
      spamCacheSize: this.spamDetection.size,
      profanityFilterActive: true
    };
  }
}

module.exports = new ModerationSystem(); 