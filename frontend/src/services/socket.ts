import { io, Socket } from 'socket.io-client';

// Declaração de tipos para import.meta.env
declare global {
  interface ImportMeta {
    env: {
      DEV: boolean;
      PROD: boolean;
      [key: string]: any;
    };
  }
}

// URLs de produção e desenvolvimento
const PROD_SERVER_URL = 'https://jogo-0vuq.onrender.com';
const DEV_SERVER_URL = 'http://localhost:4000';

// Usar URL de produção ou desenvolvimento baseado no ambiente
const SERVER_URL = import.meta.env.PROD ? PROD_SERVER_URL : DEV_SERVER_URL;

// Configurações avançadas do Socket.IO
const socketOptions = {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  path: '/socket.io/',
  withCredentials: true,
  forceNew: false,
  // Headers específicos para CORS
  extraHeaders: {
    'Origin': import.meta.env.PROD ? 'https://desenharapido.netlify.app' : 'http://localhost:5173'
  }
};

interface CreateRoomResponse {
  success: boolean;
  roomCode?: string;
  error?: string;
}

interface JoinRoomResponse {
  success: boolean;
  error?: string;
}

interface ReconnectResponse {
  success: boolean;
  gameState?: {
    status: string;
    round: number;
    maxRounds: number;
    currentDrawer: string;
    isDrawer: boolean;
    timeLeft: number;
  };
  error?: string;
}

class SocketService {
  private socket: Socket | null = null;
  private user: { id: string; name: string } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval: number | null = null;
  private isConnected = false;
  private reconnectData = { roomCode: '', userName: '' };

  connect() {
    if (!this.socket) {
      this.socket = io(SERVER_URL, socketOptions);
      
      this.socket.on('connect', () => {
        if (import.meta.env.DEV) {
          console.log('Conectado ao servidor!');
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Se houver dados de reconexão, tentar reconectar à sala
        if (this.reconnectData.roomCode) {
          this.attemptRoomReconnection();
        }
      });
      
      this.socket.on('disconnect', (reason) => {
        if (import.meta.env.DEV) {
          console.log('Desconectado do servidor!', reason);
        }
        this.isConnected = false;
        
        // Se a desconexão foi por erro de transporte, tentar reconectar
        if (reason === 'transport error' || reason === 'transport close') {
          this.socket?.connect();
        }
      });

      // Monitorar mudanças no estado do transporte
      this.socket.on('upgrading', (transport) => {
        if (import.meta.env.DEV) {
          console.log('Atualizando transporte para:', transport.name);
        }
      });

      this.socket.on('upgrade', (transport) => {
        if (import.meta.env.DEV) {
          console.log('Transporte atualizado para:', transport.name);
        }
      });

      this.socket.on('connect_error', (error) => {
        if (import.meta.env.DEV) {
          console.error('Erro de conexão:', error);
        }
        this.showConnectionError();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        if (import.meta.env.DEV) {
          console.log(`Reconectado ao servidor na tentativa ${attemptNumber}!`);
        }
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('reconnect_error', (error) => {
        if (import.meta.env.DEV) {
          console.error('Erro ao reconectar:', error);
        }
        this.reconnectAttempts++;
      });

      this.socket.on('reconnect_failed', () => {
        if (import.meta.env.DEV) {
          console.error('Falha ao reconectar após máximo de tentativas');
        }
        this.showConnectionError();
      });
    }
    return this.socket;
  }

  private shouldAttemptReconnect(): boolean {
    // Verificar se há dados de sala no localStorage para reconexão
    const roomCode = localStorage.getItem('currentRoomCode');
    const userName = localStorage.getItem('currentUserName');
    return !!(roomCode && userName && this.user);
  }

  private async attemptRoomReconnection() {
    const { roomCode, userName } = this.reconnectData;
    
    if (!roomCode || !userName) return;

    if (import.meta.env.DEV) {
      console.log(`Tentando reconectar à sala ${roomCode}...`);
    }

    const response = await this.reconnectToRoom(userName, roomCode);
    if (response.success) {
      if (import.meta.env.DEV) {
        console.log('Reconexão à sala bem-sucedida!');
      }
      // Emitir evento para informar o UI sobre a reconexão
      window.dispatchEvent(new CustomEvent('roomReconnected', {
        detail: response.gameState
      }));
    } else {
      if (import.meta.env.DEV) {
        console.error('Falha na reconexão à sala:', response.error);
      }
      // Limpar dados de reconexão se falhou
      this.clearReconnectData();
    }
  }

  private handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && !this.reconnectInterval) {
      this.reconnectInterval = setInterval(() => {
        if (this.socket?.connected) {
          if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
          }
          return;
        }
        
        console.log(`Tentativa de reconexão ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
          }
          this.showConnectionError();
        }
      }, 2000); // Tentar a cada 2 segundos
    }
  }

  private showConnectionError() {
    // Emitir evento para mostrar erro de conexão no UI
    window.dispatchEvent(new CustomEvent('connectionError'));
  }

  private clearRoomData() {
    localStorage.removeItem('currentRoomCode');
    localStorage.removeItem('currentUserName');
  }

  disconnect() {
    if (this.socket) {
      this.clearRoomData();
      this.socket.disconnect();
      this.socket = null;
    }
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  setUser(user: { id: string; name: string }) {
    this.user = user;
    // Salvar dados para reconexão
    localStorage.setItem('currentUserName', user.name);
  }

  getUser() {
    return this.user;
  }

  createRoom(userName: string, rounds: number = 3, difficulty: string = 'facil') {
    const socket = this.getSocket();
    return new Promise<string>((resolve, reject) => {
      socket.emit('create-room', { 
        userName, 
        rounds, 
        difficulty,
        category: 'all' // Suporte para categorias temáticas
      }, (response: CreateRoomResponse) => {
        if (response.success && response.roomCode) {
          this.setUser({ id: socket.id ?? '', name: userName });
          // Salvar código da sala para reconexão
          localStorage.setItem('currentRoomCode', response.roomCode);
          resolve(response.roomCode);
        } else {
          reject(response.error || 'Erro ao criar sala');
        }
      });
    });
  }

  joinRoom(userName: string, roomCode: string) {
    const socket = this.getSocket();
    return new Promise<void>((resolve, reject) => {
      socket.emit('join-room', { userName, roomCode }, (response: JoinRoomResponse) => {
        if (response.success) {
          this.setUser({ id: socket.id ?? '', name: userName });
          // Salvar código da sala para reconexão
          localStorage.setItem('currentRoomCode', roomCode);
          resolve();
        } else {
          reject(response.error || 'Erro ao entrar na sala');
        }
      });
    });
  }

  leaveRoom() {
    this.clearRoomData();
    this.user = null;
  }

  private async reconnectToRoom(userName: string, roomCode: string): Promise<ReconnectResponse> {
    // Implemente a lógica para reconectar à sala e retornar o resultado
    // Este é um exemplo básico e deve ser ajustado de acordo com a sua implementação
    return { success: true, gameState: { status: 'connected', round: 1, maxRounds: 3, currentDrawer: 'John', isDrawer: true, timeLeft: 120 } };
  }

  private clearReconnectData() {
    this.reconnectData = { roomCode: '', userName: '' };
  }
}

export default new SocketService(); 