/**
 * Sistema de Rate Limiting para ArteRápida
 * Previne abuso de APIs e DDoS
 */

const { RateLimiterMemory, RateLimiterRedis } = require('rate-limiter-flexible');

class RateLimitManager {
  constructor() {
    // Rate limiters para diferentes ações
    this.rateLimiters = this.setupRateLimiters();
  }

  setupRateLimiters() {
    return {
      // Criação de salas
      createRoom: new RateLimiterMemory({
        keyGeneratorSync: (req) => req.ip,
        points: 5, // 5 tentativas
        duration: 300, // por 5 minutos
        blockDuration: 600, // bloquear por 10 minutos
      }),

      // Entrada em salas
      joinRoom: new RateLimiterMemory({
        keyGeneratorSync: (req) => req.ip,
        points: 20, // 20 tentativas
        duration: 300, // por 5 minutos
        blockDuration: 300, // bloquear por 5 minutos
      }),

      // Mensagens de chat
      chatMessage: new RateLimiterMemory({
        keyGeneratorSync: (socket) => socket.id,
        points: 30, // 30 mensagens
        duration: 60, // por 1 minuto
        blockDuration: 120, // bloquear por 2 minutos
      }),

      // Desenhos (eventos de canvas)
      drawing: new RateLimiterMemory({
        keyGeneratorSync: (socket) => socket.id,
        points: 1000, // 1000 eventos
        duration: 60, // por 1 minuto
        blockDuration: 60, // bloquear por 1 minuto
      }),

      // Palpites
      guess: new RateLimiterMemory({
        keyGeneratorSync: (socket) => socket.id,
        points: 50, // 50 palpites
        duration: 60, // por 1 minuto
        blockDuration: 30, // bloquear por 30 segundos
      }),

      // Ações de host
      hostAction: new RateLimiterMemory({
        keyGeneratorSync: (socket) => socket.id,
        points: 10, // 10 ações
        duration: 60, // por 1 minuto
        blockDuration: 60, // bloquear por 1 minuto
      }),

      // Rate limiter global por IP
      globalIP: new RateLimiterMemory({
        keyGeneratorSync: (req) => req.ip,
        points: 100, // 100 requisições
        duration: 60, // por 1 minuto
        blockDuration: 300, // bloquear por 5 minutos
      })
    };
  }

  // Middleware para Express
  createExpressMiddleware(limiterName) {
    return async (req, res, next) => {
      try {
        const rateLimiter = this.rateLimiters[limiterName];
        if (!rateLimiter) {
          return next();
        }

        await rateLimiter.consume(req.ip);
        next();
      } catch (rejRes) {
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        res.set('Retry-After', String(secs));
        res.status(429).json({
          error: 'Muitas tentativas. Tente novamente em alguns segundos.',
          retryAfter: secs
        });
      }
    };
  }

  // Verificar rate limit para Socket.IO
  async checkSocketRateLimit(socket, action, customKey = null) {
    try {
      const rateLimiter = this.rateLimiters[action];
      if (!rateLimiter) {
        return { allowed: true };
      }

      const key = customKey || socket.id;
      await rateLimiter.consume(key);
      
      return { allowed: true };
    } catch (rejRes) {
      const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      return {
        allowed: false,
        retryAfter: secs,
        message: `Muitas tentativas. Aguarde ${secs} segundos.`
      };
    }
  }

  // Verificar rate limit de forma síncrona (para casos específicos)
  checkRateLimitSync(key, action) {
    const rateLimiter = this.rateLimiters[action];
    if (!rateLimiter) return { allowed: true };

    // Verificar apenas, sem consumir
    const resRateLimiter = rateLimiter.get(key);
    if (resRateLimiter && resRateLimiter.remainingHits <= 0) {
      return {
        allowed: false,
        retryAfter: Math.round(resRateLimiter.msBeforeNext / 1000) || 1
      };
    }

    return { allowed: true };
  }

  // Obter estatísticas de rate limiting
  async getRateLimitStats(key) {
    const stats = {};
    
    for (const [name, limiter] of Object.entries(this.rateLimiters)) {
      try {
        const res = await limiter.get(key);
        stats[name] = {
          remainingHits: res ? res.remainingHits : limiter.points,
          totalHits: res ? res.totalHits : 0,
          msBeforeNext: res ? res.msBeforeNext : 0
        };
      } catch (error) {
        stats[name] = { error: error.message };
      }
    }

    return stats;
  }

  // Limpar rate limits para um usuário específico
  async clearUserLimits(userId, socketId = null) {
    const keys = [userId];
    if (socketId) keys.push(socketId);

    for (const key of keys) {
      for (const limiter of Object.values(this.rateLimiters)) {
        try {
          await limiter.delete(key);
        } catch (error) {
          console.error(`Erro ao limpar rate limit para ${key}:`, error);
        }
      }
    }
  }

  // Adicionar pontos extras (para premium users ou situações especiais)
  async grantExtraPoints(key, action, extraPoints) {
    const rateLimiter = this.rateLimiters[action];
    if (!rateLimiter) return false;

    try {
      // Reduzir o contador (efectivamente dando pontos extras)
      await rateLimiter.reward(key, extraPoints);
      return true;
    } catch (error) {
      console.error(`Erro ao conceder pontos extras:`, error);
      return false;
    }
  }

  // Configuração dinâmica de rate limits
  updateRateLimit(action, newConfig) {
    if (!this.rateLimiters[action]) return false;

    // Criar novo rate limiter com nova configuração
    this.rateLimiters[action] = new RateLimiterMemory({
      keyGeneratorSync: this.rateLimiters[action].keyGeneratorSync,
      ...newConfig
    });

    return true;
  }

  // Relatório de atividade
  getActivityReport() {
    return {
      activeLimiters: Object.keys(this.rateLimiters).length,
      timestamp: new Date().toISOString(),
      config: Object.entries(this.rateLimiters).reduce((acc, [name, limiter]) => {
        acc[name] = {
          points: limiter.points,
          duration: limiter.duration,
          blockDuration: limiter.blockDuration
        };
        return acc;
      }, {})
    };
  }
}

module.exports = new RateLimitManager(); 