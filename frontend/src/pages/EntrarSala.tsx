import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import socketService from '../services/socket';
import { v4 as uuidv4 } from 'uuid';

function EntrarSala() {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [playerId, setPlayerId] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // Conectar ao servidor Socket.IO
    socketService.connect();
    
    // Preencher o código da sala a partir do parâmetro da URL
    const params = new URLSearchParams(location.search);
    const codigoParam = params.get('codigo');
    if (codigoParam) {
      setCodigo(codigoParam.toUpperCase().slice(0, 6));
    }
    
    const nomeGuardado = localStorage.getItem('nomeJogador');
    if (nomeGuardado) setNome(nomeGuardado);
    
    let id = localStorage.getItem('playerId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('playerId', id);
    }
    setPlayerId(id);
    
    // Reconexão automática
    const socket = socketService.getSocket();
    const handleDisconnect = () => {
      setIsReconnecting(true);
    };
    const handleConnect = () => {
      setIsReconnecting(false);
      // Se temos nome e código, tentar reentrar automaticamente
      const nome = localStorage.getItem('nomeJogador') || nomeGuardado;
      if (nome && codigo) {
        socketService.joinRoom(nome, codigo, id).then(() => {
          navigate(`/sala/${codigo}`);
        });
      }
    };
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
      if (!socketService.getUser()) {
        socketService.disconnect();
      }
    };
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      localStorage.setItem('nomeJogador', nome);
      await socketService.joinRoom(nome, codigo.toUpperCase(), playerId);
      navigate(`/sala/${codigo.toUpperCase()}`);
    } catch (err: any) {
      // Se for erro de playerId, tentar novamente com novo playerId
      const erroStr = err instanceof Error ? err.message : String(err);
      if (
        erroStr.includes('ID na sala') ||
        erroStr.toLowerCase().includes('playerid') ||
        erroStr.toLowerCase().includes('jogador não encontrado')
      ) {
        // Limpar e gerar novo playerId
        localStorage.removeItem('playerId');
        const novoId = uuidv4();
        localStorage.setItem('playerId', novoId);
        setPlayerId(novoId);
        try {
          await socketService.joinRoom(nome, codigo.toUpperCase(), novoId);
          navigate(`/sala/${codigo.toUpperCase()}`);
          return;
        } catch (err2) {
          setError(err2 instanceof Error ? err2.message : 'Erro ao entrar na sala');
        }
      } else {
        setError(erroStr);
      }
      console.error('Erro ao entrar na sala:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white">
      {isReconnecting && (
        <div className="fixed top-0 left-0 w-full bg-yellow-400 text-blue-900 text-center py-2 z-50 font-bold animate-pulse">
          Ligação perdida. A tentar reconectar...
        </div>
      )}
      <h2 className="text-2xl font-bold mb-6">Entrar em Sala</h2>
      
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-4 w-80 text-center">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <input
          className="p-3 rounded text-blue-900"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          disabled={isLoading}
        />
        <div className="flex gap-2">
          <input
            className="p-3 rounded text-blue-900 flex-1"
            type="text"
            placeholder="Código da sala"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            required
            maxLength={6}
            style={{ textTransform: 'uppercase' }}
            disabled={isLoading}
          />
        </div>
        <button 
          className={`${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-white hover:bg-gray-200'
          } text-blue-900 px-6 py-2 rounded-lg font-semibold shadow transition`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <button 
        onClick={() => navigate('/')}
        className="mt-4 text-white hover:underline"
      >
        Voltar
      </button>
    </div>
  );
}

export default EntrarSala;