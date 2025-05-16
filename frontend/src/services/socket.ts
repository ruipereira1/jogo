import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://jogo-yslo.onrender.com';
const PLAYER_ID_KEY = 'desenha_player_id'; // Chave para armazenar o ID do jogador
const LAST_ROOM_KEY = 'desenha_last_room'; // Chave para armazenar a última sala

class SocketService {
  private socket: Socket | null = null;
  private user: { id: string; name: string; playerId?: string } | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lastRoomCode: string | null = null;
  private pendingPoints: any[] = [];
  private pointsBatchInterval: ReturnType<typeof setInterval> | null = null;
  private isReconnecting = false;

  connect() {
    if (!this.socket) {
      console.log('Tentando conectar ao servidor:', SOCKET_URL);
      
      // Opções para melhorar a confiabilidade da conexão
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling'],
        // Comprimir dados
        forceBase64: false
      });
      
      this.socket.on('connect', () => {
        console.log('Conectado ao servidor!', this.socket?.id);
        this.reconnectAttempts = 0;
        
        // Se o usuário já estava definido, atualizar o ID
        if (this.user) {
          this.user.id = this.socket?.id || '';
          
          // Se estava reconectando e tem sala anterior, tentar reconectar à sala
          if (this.isReconnecting && this.lastRoomCode) {
            console.log(`Tentando reconectar à sala ${this.lastRoomCode}`);
            this.rejoinRoom(this.lastRoomCode);
            this.isReconnecting = false;
          }
        }
      });
      
      this.socket.on('disconnect', () => {
        console.log('Desconectado do servidor!');
        this.isReconnecting = true;
        
        // Limpar intervalo de batching de pontos ao desconectar
        if (this.pointsBatchInterval) {
          clearInterval(this.pointsBatchInterval);
          this.pointsBatchInterval = null;
        }
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Erro de conexão:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          console.error('Número máximo de tentativas de reconexão atingido');
          this.socket?.disconnect();
        }
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      // Limpar intervalo de batching de pontos
      if (this.pointsBatchInterval) {
        clearInterval(this.pointsBatchInterval);
        this.pointsBatchInterval = null;
      }
      
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    if (!this.socket || !this.socket.connected) {
      return this.connect();
    }
    return this.socket;
  }

  // Salvar ID do jogador localmente
  savePlayerId(playerId: string) {
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }

  // Salvar código da sala
  saveRoomCode(roomCode: string) {
    localStorage.setItem(LAST_ROOM_KEY, roomCode);
    this.lastRoomCode = roomCode;
  }

  // Recuperar ID do jogador
  getPlayerId(): string | null {
    return localStorage.getItem(PLAYER_ID_KEY);
  }

  // Recuperar código da última sala
  getLastRoomCode(): string | null {
    return localStorage.getItem(LAST_ROOM_KEY) || this.lastRoomCode;
  }

  setUser(user: { id: string; name: string; playerId?: string }) {
    const playerId = user.playerId || this.socket?.id || '';
    
    this.user = { 
      id: this.socket?.id || '', 
      name: user.name,
      playerId 
    };
    
    // Persistir informações
    localStorage.setItem('nomeJogador', user.name);
    if (playerId) {
      this.savePlayerId(playerId);
    }
  }

  getUser() {
    const name = this.user?.name || localStorage.getItem('nomeJogador');
    const playerId = this.user?.playerId || this.getPlayerId();
    
    if (name) {
      // Sempre usar o socket.id mais atual
      const currentId = this.socket?.id || '';
      return { id: currentId, name, playerId };
    }
    return null;
  }

  // Reconectar a uma sala após reconexão
  rejoinRoom(roomCode: string) {
    const socket = this.getSocket();
    const user = this.getUser();
    
    if (user && socket) {
      console.log(`Tentando reconectar à sala ${roomCode} como ${user.name}`);
      
      socket.emit('rejoin-room', { 
        roomCode, 
        userName: user.name, 
        playerId: user.playerId 
      }, (response: any) => {
        if (response && response.success) {
          console.log('Reconexão à sala bem-sucedida');
          
          // Solicitar estado atual
          socket.emit('request-room-state', { roomCode });
        } else {
          console.error('Falha ao reconectar à sala:', response?.error || 'Erro desconhecido');
        }
      });
    }
  }

  createRoom(userName: string, rounds: number = 3, difficulty: string = 'facil') {
    const socket = this.getSocket();
    return new Promise<string>((resolve, reject) => {
      socket.emit('create-room', { userName, rounds, difficulty }, (response: any) => {
        if (response.success) {
          this.setUser({ id: socket.id ?? '', name: userName, playerId: socket.id });
          this.saveRoomCode(response.roomCode);
          resolve(response.roomCode);
        } else {
          reject(response.error);
        }
      });
    });
  }

  joinRoom(userName: string, roomCode: string) {
    const socket = this.getSocket();
    
    // Recuperar playerId salvo localmente ou usar o ID atual do socket
    const savedPlayerId = this.getPlayerId();
    const playerId = savedPlayerId || socket.id;
    
    console.log(`Tentando entrar na sala ${roomCode} como ${userName} (playerId: ${playerId})`);
    
    // Salvar o código da sala para reconexões
    this.saveRoomCode(roomCode);
    
    return new Promise<void>((resolve, reject) => {
      socket.emit('join-room', { userName, roomCode, playerId }, (response: any) => {
        if (response.success) {
          this.setUser({ id: socket.id ?? '', name: userName, playerId });
          console.log(`Entrada na sala ${roomCode} bem-sucedida!`);
          resolve();
        } else {
          console.error(`Erro ao entrar na sala: ${response.error}`);
          reject(response.error);
        }
      });
    });
  }

  // Função para enviar lotes de pontos
  sendPointsBatch(roomCode: string, points: any[], color: string, size: number) {
    if (!points || points.length === 0) return;
    
    const socket = this.getSocket();
    console.log(`Enviando lote de ${points.length} pontos`);
    
    // Compactar os pontos para reduzir tamanho
    const compactPoints = points.map(p => ({
      x: Math.round(p.x * 1000) / 1000, // Reduzir precisão para 3 casas decimais
      y: Math.round(p.y * 1000) / 1000,
      p: p.pressure ? Math.round(p.pressure * 10) / 10 : undefined, // Pressão com 1 casa decimal
      s: p.isStartOfLine ? 1 : undefined, // Usar 's' em vez de 'isStartOfLine'
      o: p.isSinglePoint ? 1 : undefined // Usar 'o' em vez de 'isSinglePoint'
    }));
    
    socket.emit('draw-points-batch', { 
      roomCode, 
      points: compactPoints,
      color, 
      size,
      timestamp: Date.now()
    });
  }

  // Função para forçar o encerramento de um jogo quando o host detecta problemas
  endGame(roomCode: string) {
    const socket = this.getSocket();
    return new Promise<void>((resolve, reject) => {
      socket.emit('end-game', { roomCode }, (response: any) => {
        if (response && response.success) {
          resolve();
        } else {
          reject(response?.error || 'Erro ao encerrar jogo');
        }
      });
    });
  }

  // Remover jogador da sala - pode ser usado para remover outro jogador (como host) ou sair voluntariamente
  removePlayer(roomCode: string, playerIdToRemove: string, reason: string = 'kicked') {
    const socket = this.getSocket();
    return new Promise<void>((resolve, reject) => {
      socket.emit('remove-player', { roomCode, playerIdToRemove, reason }, (response: any) => {
        if (response && response.success) {
          resolve();
        } else {
          resolve(); // Mesmo sem resposta explícita, consideramos sucesso
        }
      });
    });
  }
  
  // Sair voluntariamente da sala
  leaveRoom(roomCode: string) {
    const socket = this.getSocket();
    const user = this.getUser();
    
    if (user && socket) {
      const playerId = user.playerId || user.id;
      return this.removePlayer(roomCode, playerId, 'left');
    }
    
    return Promise.resolve();
  }
}

export default new SocketService(); 