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
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-4 md:mb-6">Entrar em Sala</h2>
      
      {roomCode && (
        <div className="bg-blue-700 text-white p-2 md:p-3 rounded-lg mb-2 sm:mb-3 md:mb-4 w-full max-w-xs md:max-w-sm text-center text-xs sm:text-sm md:text-base">
          Você está prestes a entrar na sala <span className="font-bold text-yellow-300">{roomCode}</span>
        </div>
      )}
      
      {error && (
        <div className="bg-red-500 text-white p-2 md:p-3 rounded-lg mb-2 sm:mb-3 md:mb-4 w-full max-w-xs md:max-w-sm text-center text-xs sm:text-sm md:text-base">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:gap-3 md:gap-4 w-full max-w-xs md:max-w-sm">
        <input
          className="p-2 sm:p-2 md:p-3 rounded text-blue-900 text-xs sm:text-sm md:text-base"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          disabled={isLoading}
          autoFocus={!!roomCode} // Foca automaticamente no campo de nome quando temos código
        />
        <input
          className="p-2 sm:p-2 md:p-3 rounded text-blue-900 text-xs sm:text-sm md:text-base"
          type="text"
          placeholder="Código da sala"
          value={codigo}
          onChange={e => setCodigo(e.target.value.toUpperCase())}
          required
          disabled={isLoading || !!roomCode} // Desabilita se temos código na URL
          maxLength={6}
        />
        <button 
          className={`${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-yellow-300 hover:bg-yellow-400'
          } text-blue-900 px-3 py-1 sm:px-4 sm:py-2 md:px-6 md:py-2 rounded-lg font-semibold shadow transition text-xs sm:text-sm md:text-base`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-4 text-white hover:underline text-xs sm:text-sm md:text-base"
      >
        Voltar
      </button>
    </div>
  );
}

export default EntrarSala; 