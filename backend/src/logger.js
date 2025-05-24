// Sistema de logging simples
export class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
    
    // Em produção, aqui poderia enviar logs para um serviço externo
  }
  
  static info(message, data = null) {
    this.log('info', message, data);
  }
  
  static warn(message, data = null) {
    this.log('warn', message, data);
  }
  
  static error(message, data = null) {
    this.log('error', message, data);
  }
  
  static debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      this.log('debug', message, data);
    }
  }
}

// Função para obter estatísticas do servidor
export function getServerStats(rooms) {
  const totalRooms = rooms.size;
  const activeRooms = Array.from(rooms.values()).filter(room => room.players.length > 0).length;
  const totalPlayers = Array.from(rooms.values()).reduce((total, room) => total + room.players.length, 0);
  const playingRooms = Array.from(rooms.values()).filter(room => room.status === 'playing').length;
  
  return {
    totalRooms,
    activeRooms,
    totalPlayers,
    playingRooms,
    timestamp: new Date().toISOString()
  };
} 