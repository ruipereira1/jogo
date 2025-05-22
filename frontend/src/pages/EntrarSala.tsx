import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function EntrarSala() {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Conectar ao servidor Socket.IO
    socketService.connect();
    
    return () => {
      // Desconectar apenas se o usuário sair sem entrar na sala
      if (!socketService.getUser()) {
        socketService.disconnect();
      }
    };
  }, []);

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
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Entrar em Sala</h2>
      
      {error && (
        <div className="bg-red-500 text-white p-2 md:p-3 rounded-lg mb-3 md:mb-4 w-full max-w-xs md:max-w-sm text-center text-sm md:text-base">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:gap-4 w-full max-w-xs md:max-w-sm">
        <input
          className="p-2 md:p-3 rounded text-blue-900 text-sm md:text-base"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          disabled={isLoading}
        />
        <input
          className="p-2 md:p-3 rounded text-blue-900 text-sm md:text-base"
          type="text"
          placeholder="Código da sala"
          value={codigo}
          onChange={e => setCodigo(e.target.value.toUpperCase())}
          required
          disabled={isLoading}
          maxLength={6}
        />
        <button 
          className={`${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-yellow-300 hover:bg-yellow-400'
          } text-blue-900 px-4 py-2 md:px-6 md:py-2 rounded-lg font-semibold shadow transition text-sm md:text-base`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-4 text-white hover:underline text-sm md:text-base"
      >
        Voltar
      </button>
    </div>
  );
}

export default EntrarSala; 