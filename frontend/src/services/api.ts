/**
 * Serviço de API para ArteRápida
 * Centralizador de chamadas para o backend
 */

export interface CreateRoomAdvancedRequest {
  difficulty?: 'facil' | 'medio' | 'dificil';
  rounds?: number;
  category?: string;
  isPrivate?: boolean;
  password?: string;
  maxPlayers?: number;
  allowSpectators?: boolean;
  customWords?: string[];
  settings?: {
    allowChat?: boolean;
    allowHints?: boolean;
    autoStart?: boolean;
    drawingTimeout?: number;
    guessTimeout?: number;
    showWordLength?: boolean;
    allowSkip?: boolean;
    competitiveMode?: boolean;
  };
}

export interface CreateRoomAdvancedResponse {
  success: boolean;
  roomCode?: string;
  room?: {
    code: string;
    difficulty: string;
    rounds: number;
    category: string;
    isPrivate: boolean;
    maxPlayers: number;
    settings: any;
  };
  error?: string;
}

export interface PublicRoom {
  code: string;
  players: number;
  maxPlayers: number;
  difficulty: string;
  category: string;
  host: string;
  createdAt: number;
}

export interface PublicRoomsResponse {
  success: boolean;
  rooms?: PublicRoom[];
  timestamp?: number;
  error?: string;
}

export interface RoomStatsResponse {
  success: boolean;
  stats?: {
    roomCode: string;
    players: number;
    status: string;
    round: number;
    maxRounds: number;
    isPrivate: boolean;
    settings: any;
    gameStats: any;
    uptime: number;
    lastActivity: number;
  };
  error?: string;
}

export interface GlobalStatsResponse {
  success: boolean;
  stats?: {
    totalRooms: number;
    privateRooms: number;
    publicRooms: number;
    activeGames: number;
    waitingRooms: number;
    totalPlayers: number;
    averagePlayersPerRoom: number;
  };
  error?: string;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin
      : 'http://localhost:4000';
  }

  // Configuração base para requests
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Erro na requisição para ${endpoint}:`, error);
      throw error;
    }
  }

  // Buscar salas públicas
  async getPublicRooms(): Promise<PublicRoomsResponse> {
    return this.request<PublicRoomsResponse>('/api/public-rooms');
  }

  // Criar sala com configurações avançadas
  async createRoomAdvanced(data: CreateRoomAdvancedRequest): Promise<CreateRoomAdvancedResponse> {
    return this.request<CreateRoomAdvancedResponse>('/api/create-room-advanced', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Obter estatísticas de uma sala
  async getRoomStats(roomCode: string): Promise<RoomStatsResponse> {
    return this.request<RoomStatsResponse>(`/api/room/${roomCode}/stats`);
  }

  // Obter estatísticas globais do servidor
  async getGlobalStats(): Promise<GlobalStatsResponse> {
    return this.request<GlobalStatsResponse>('/api/stats');
  }

  // Health check do servidor
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Validar se sala existe
  async validateRoom(roomCode: string): Promise<{ exists: boolean; isPrivate?: boolean }> {
    try {
      const stats = await this.getRoomStats(roomCode);
      return { 
        exists: stats.success, 
        isPrivate: stats.stats?.isPrivate 
      };
    } catch {
      return { exists: false };
    }
  }

  // Obter categorias disponíveis (pode ser expandido)
  getAvailableCategories(): string[] {
    return [
      'all',
      'animais',
      'objetos', 
      'comida',
      'profissoes',
      'lugares',
      'transporte',
      'tecnologia'
    ];
  }

  // Obter dificuldades disponíveis
  getAvailableDifficulties(): Array<{ value: string; label: string }> {
    return [
      { value: 'facil', label: 'Fácil' },
      { value: 'medio', label: 'Médio' },
      { value: 'dificil', label: 'Difícil' }
    ];
  }

  // Validar dados de criação de sala
  validateRoomData(data: CreateRoomAdvancedRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.rounds && (data.rounds < 1 || data.rounds > 20)) {
      errors.push('Número de rodadas deve ser entre 1 e 20');
    }

    if (data.maxPlayers && (data.maxPlayers < 2 || data.maxPlayers > 12)) {
      errors.push('Número de jogadores deve ser entre 2 e 12');
    }

    if (data.isPrivate && !data.password) {
      errors.push('Sala privada requer senha');
    }

    if (data.password && data.password.length < 3) {
      errors.push('Senha deve ter pelo menos 3 caracteres');
    }

    if (data.customWords && data.customWords.length > 100) {
      errors.push('Máximo 100 palavras personalizadas');
    }

    return { valid: errors.length === 0, errors };
  }

  // Formatar tempo relativo
  formatTimeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  }

  // Formatar dificuldade
  formatDifficulty(difficulty: string): string {
    const map: Record<string, string> = {
      'facil': 'Fácil',
      'medio': 'Médio', 
      'dificil': 'Difícil'
    };
    return map[difficulty] || difficulty;
  }

  // Formatar categoria
  formatCategory(category: string): string {
    const map: Record<string, string> = {
      'all': 'Todas',
      'animais': 'Animais',
      'objetos': 'Objetos',
      'comida': 'Comida',
      'profissoes': 'Profissões',
      'lugares': 'Lugares',
      'transporte': 'Transporte',
      'tecnologia': 'Tecnologia'
    };
    return map[category] || category;
  }
}

export const apiService = new ApiService();
export default apiService; 