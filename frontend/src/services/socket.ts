import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'https://jogo-yslo.onrender.com';

class SocketService {
  private socket: Socket | null = null;
  private user: { id: string; name: string } | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL);
      
      this.socket.on('connect', () => {
        console.log('Conectado ao servidor!');
      });
      
      this.socket.on('disconnect', () => {
        console.log('Desconectado do servidor!');
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    if (!this.socket) {
      return this.connect();
    }
    return this.socket;
  }

  setUser(user: { id: string; name: string }) {
    if (this.socket) {
      this.user = { id: this.socket.id || '', name: user.name };
    } else {
      this.user = user;
    }
    localStorage.setItem('nomeJogador', user.name);
  }

  getUser() {
    const name = this.user?.name || localStorage.getItem('nomeJogador');
    if (name) {
      // Sempre usar o socket.id mais atual
      const currentId = this.socket?.id || '';
      return { id: currentId, name };
    }
    return null;
  }

  createRoom(userName: string, rounds: number = 3, difficulty: string = 'facil') {
    const socket = this.getSocket();
    return new Promise<string>((resolve, reject) => {
      socket.emit('create-room', { userName, rounds, difficulty }, (response: any) => {
        if (response.success) {
          this.setUser({ id: socket.id ?? '', name: userName });
          resolve(response.roomCode);
        } else {
          reject(response.error);
        }
      });
    });
  }

  joinRoom(userName: string, roomCode: string, playerId?: string) {
    const socket = this.getSocket();
    return new Promise<void>((resolve, reject) => {
      socket.emit('join-room', { userName, roomCode }, (response: any) => {
        if (response.success) {
          this.setUser({ id: socket.id ?? '', name: userName });
          resolve();
        } else {
          reject(response.error);
        }
      });
    });
  }
}

export default new SocketService(); 