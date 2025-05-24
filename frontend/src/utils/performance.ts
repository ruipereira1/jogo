// Debounce function para evitar múltiplas chamadas
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: number;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function para limitar frequência de chamadas
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Função para comprimir dados do canvas antes de enviar
export const compressCanvasData = (data: any) => {
  // Implementação básica - em produção poderia usar uma biblioteca de compressão
  return data;
};

// Função para detectar dispositivo móvel
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Função para otimizar eventos de desenho
export const optimizeDrawEvents = throttle((drawData: any, socket: any, roomCode: string) => {
  socket.emit('draw-line', { roomCode, line: drawData });
}, 16); // ~60fps 