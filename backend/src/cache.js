/**
 * Sistema de Cache para ArteRápida
 * Melhora performance e reduz carga no servidor
 */

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.expireTimers = new Map();
  }

  set(key, value, ttl = 300000) { // TTL padrão: 5 minutos
    // Limpar timer anterior se existir
    if (this.expireTimers.has(key)) {
      clearTimeout(this.expireTimers.get(key));
    }

    // Definir valor no cache
    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      ttl
    });

    // Definir timer de expiração
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.expireTimers.set(key, timer);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Verificar se expirou
    if (Date.now() - item.createdAt > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    // Limpar timer
    if (this.expireTimers.has(key)) {
      clearTimeout(this.expireTimers.get(key));
      this.expireTimers.delete(key);
    }

    return this.cache.delete(key);
  }

  clear() {
    // Limpar todos os timers
    this.expireTimers.forEach(timer => clearTimeout(timer));
    this.expireTimers.clear();
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      totalMemoryUsage: this._calculateMemoryUsage()
    };
  }

  _calculateMemoryUsage() {
    let total = 0;
    this.cache.forEach((value, key) => {
      total += JSON.stringify(value).length + key.length;
    });
    return total;
  }
}

// Cache para diferentes tipos de dados
const gameCache = new MemoryCache();
const wordCache = new MemoryCache();
const playerCache = new MemoryCache();

module.exports = {
  gameCache,
  wordCache, 
  playerCache,
  MemoryCache
}; 