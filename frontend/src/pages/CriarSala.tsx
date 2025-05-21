import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function CriarSala() {
  const [nome, setNome] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rounds, setRounds] = useState(3);
  const [difficulty, setDifficulty] = useState('facil');
  const navigate = useNavigate();

  useEffect(() => {
    // Conectar ao servidor Socket.IO
    socketService.connect();
    
    return () => {
      // Desconectar apenas se o usuário sair sem criar a sala
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
      // Criar sala no servidor
      const roomCode = await socketService.createRoom(nome, rounds, difficulty);
      // Redirecionar para a sala
      navigate(`/sala/${roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar sala');
      console.error('Erro ao criar sala:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white">
      <h2 className="text-2xl font-bold mb-6">Criar Sala</h2>
      
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
          type="number"
          min={1}
          max={10}
          value={rounds}
          onChange={e => setRounds(Number(e.target.value))}
          required
          disabled={isLoading}
          placeholder="Quantidade de rondas"
        />
        <select
          className="p-3 rounded text-blue-900"
          value={difficulty}
          onChange={e => setDifficulty(e.target.value)}
          disabled={isLoading}
        >
          <option value="facil">Fácil</option>
          <option value="medio">Médio</option>
          <option value="dificil">Difícil</option>
        </select>
        <button 
          className={`${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-yellow-300 hover:bg-yellow-400'
          } text-blue-900 px-6 py-2 rounded-lg font-semibold shadow transition`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Criando...' : 'Criar'}
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

export default CriarSala; 