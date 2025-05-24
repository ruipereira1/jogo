import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socketService from '../services/socket';

function EntrarSala() {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Se existe um código na URL, preenche o campo
    if (roomCode) {
      setCodigo(roomCode.toUpperCase());
    }
    
    // Configurar viewport para dispositivos móveis
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }

    // Conectar ao servidor Socket.IO
    const socket = socketService.connect();
    
    // Ouvir evento de sala não encontrada
    socket.on('room-not-found', () => {
      setError('Sala não encontrada ou foi excluída');
      navigate('/');
    });
    
    return () => {
      // Restaurar viewport original quando componente for desmontado
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
      
      // Limpar listener
      socket.off('room-not-found');
      
      // Desconectar apenas se o usuário sair sem entrar na sala
      if (!socketService.getUser()) {
        socketService.disconnect();
      }
    };
  }, [navigate, roomCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Entrar na sala usando o serviço
      await socketService.joinRoom(nome, codigo);
      // Redirecionar para a sala
      navigate(`/sala/${codigo}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar na sala');
      console.error('Erro ao entrar na sala:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white p-4">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-4 md:mb-6">🚪 Entrar em Sala</h2>
      
      {roomCode && (
        <div className="bg-blue-700 bg-opacity-80 text-white p-3 md:p-4 rounded-lg mb-3 sm:mb-4 md:mb-5 w-full max-w-xs md:max-w-sm text-center border border-blue-500">
          <div className="text-sm sm:text-base">🎯 Está prestes a entrar na sala</div>
          <div className="font-bold text-yellow-300 text-lg sm:text-xl mt-1">{roomCode}</div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-500 text-white p-3 md:p-4 rounded-lg mb-3 sm:mb-4 md:mb-5 w-full max-w-xs md:max-w-sm text-center text-sm sm:text-base border-2 border-red-400">
          ⚠️ {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4 md:gap-5 w-full max-w-xs md:max-w-sm">
        <input
          className="p-3 sm:p-3 md:p-4 rounded-lg text-blue-900 text-sm sm:text-base md:text-lg font-medium border-2 border-transparent focus:border-yellow-300 focus:outline-none transition-all"
          type="text"
          placeholder="👤 Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          disabled={isLoading}
          autoFocus={!!roomCode} // Foca automaticamente no campo de nome quando temos código
        />
        
        <div className="relative">
          <input
            className={`p-3 sm:p-3 md:p-4 rounded-lg text-blue-900 text-sm sm:text-base md:text-lg font-medium border-2 border-transparent focus:border-yellow-300 focus:outline-none transition-all w-full ${
              roomCode ? 'bg-gray-200 cursor-not-allowed' : ''
            }`}
            type="text"
            placeholder="🔑 Código da sala (6 caracteres)"
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            required
            disabled={isLoading || !!roomCode} // Desabilita se temos código na URL
            maxLength={6}
            style={{ textTransform: 'uppercase', letterSpacing: '2px' }}
          />
          {roomCode && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600">
              ✅
            </div>
          )}
        </div>
        
        <button 
          className={`${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-yellow-300 hover:bg-yellow-400 active:scale-95'
          } text-blue-900 px-4 py-3 sm:px-6 sm:py-4 rounded-lg font-bold shadow-lg transition-all text-sm sm:text-base md:text-lg`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
              Entrando...
            </div>
          ) : (
            '🚀 Entrar na Sala'
          )}
        </button>
      </form>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-4 text-white hover:underline text-sm sm:text-base transition-all hover:scale-105"
      >
        ← Voltar
      </button>
    </div>
  );
}

export default EntrarSala; 