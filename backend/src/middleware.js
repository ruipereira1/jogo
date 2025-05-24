// Rate limiting simples em memória
const rateLimitMap = new Map();

export function rateLimit(socketId, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(socketId) || [];
  
  // Remover requests antigas fora da janela de tempo
  const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit excedido
  }
  
  validRequests.push(now);
  rateLimitMap.set(socketId, validRequests);
  return true; // Request permitido
}

// Limpar rate limits antigos periodicamente
setInterval(() => {
  const now = Date.now();
  const windowMs = 60000;
  
  rateLimitMap.forEach((requests, socketId) => {
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    if (validRequests.length === 0) {
      rateLimitMap.delete(socketId);
    } else {
      rateLimitMap.set(socketId, validRequests);
    }
  });
}, 300000); // Limpar a cada 5 minutos

// Middleware para validar dados de entrada
export function validateSocketData(data, requiredFields) {
  if (!data || typeof data !== 'object') return false;
  
  for (const field of requiredFields) {
    if (!data[field]) return false;
  }
  
  return true;
}

// Sanitizar mensagens de chat
export function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') return '';
  
  return message
    .trim()
    .slice(0, 200) // Limitar tamanho da mensagem
    .replace(/<[^>]*>/g, '') // Remover tags HTML
    .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF!?.,]/g, ''); // Permitir apenas caracteres seguros
} 