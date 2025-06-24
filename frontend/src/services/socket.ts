import { io, Socket } from 'socket.io-client';

// Usa a URL de produção quando o app estiver rodando no Netlify, caso contrário usa localhost
const isProduction = window.location.hostname !== 'localhost';
const SOCKET_URL = isProduction
  ? 'https://jogo-0vuq.onrender.com'
  : 'http://localhost:4000';

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

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        // Configurações de reconexão melhoradas
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000, // 1 segundo
        reconnectionDelayMax: 5000, // máximo 5 segundos
        reconnectionAttempts: this.maxReconnectAttempts,
        timeout: 20000, // 20 segundos timeout
        transports: ['websocket', 'polling'], // Permitir fallback para polling
        // Configurações adicionais para melhor estabilidade
        forceNew: false,
        upgrade: true
      });
      
      this.socket.on('connect', () => {
        console.log('Conectado ao servidor!');
        this.reconnectAttempts = 0;
        
        // Se há informações de usuário e reconexão, tentar reconectar à sala
        if (this.user && this.shouldAttemptReconnect()) {
          this.attemptRoomReconnection();
        }
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('Desconectado do servidor!', reason);
        
        // Se foi desconexão não intencional, tentar reconectar
        if (reason === 'io server disconnect' || reason === 'io client disconnect') {
          // Não tentar reconectar se foi desconexão intencional
          return;
        }
        
        this.handleReconnection();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconectado ao servidor na tentativa ${attemptNumber}!`);
        this.reconnectAttempts = 0;
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('Erro ao reconectar:', error);
        this.reconnectAttempts++;
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Falha ao reconectar após máximo de tentativas');
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

  private attemptRoomReconnection() {
    const roomCode = localStorage.getItem('currentRoomCode');
    const userName = localStorage.getItem('currentUserName');
    
    if (roomCode && userName && this.socket) {
      console.log(`Tentando reconectar à sala ${roomCode}...`);
      
      this.socket.emit('reconnect-to-room', { userName, roomCode }, (response: ReconnectResponse) => {
        if (response.success) {
          console.log('Reconexão à sala bem-sucedida!');
          // Emitir evento customizado para o componente da sala
          window.dispatchEvent(new CustomEvent('roomReconnected', {
            detail: { gameState: response.gameState }
          }));
        } else {
          console.error('Falha na reconexão à sala:', response.error);
          // Limpar dados de sala se reconexão falhou
          this.clearRoomData();
        }
      });
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
      socket.emit('create-room', { userName, rounds, difficulty }, (response: CreateRoomResponse) => {
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
}

export default new SocketService(); 