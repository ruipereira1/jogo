import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:4000';

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
    this.user = user;
  }

  getUser() {
    return this.user;
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

  joinRoom(userName: string, roomCode: string) {
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