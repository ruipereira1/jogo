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
      // Entrar na sala no servidor
      await socketService.joinRoom(nome, codigo.toUpperCase());
      // Redirecionar para a sala
      navigate(`/sala/${codigo.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar na sala');
      console.error('Erro ao entrar na sala:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white">
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
        <input
          className="p-3 rounded text-blue-900"
          type="text"
          placeholder="Código da sala"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          required
          maxLength={6}
          style={{ textTransform: 'uppercase' }}
          disabled={isLoading}
        />
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