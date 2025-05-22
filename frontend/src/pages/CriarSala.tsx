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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white p-4">
      <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Criar Sala</h2>
      
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
        
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="flex-1">
            <label className="block text-white text-sm mb-1">Rondas</label>
            <input
              className="p-2 md:p-3 rounded text-blue-900 w-full text-sm md:text-base"
              type="number"
              min={1}
              max={10}
              value={rounds}
              onChange={e => setRounds(Number(e.target.value))}
              required
              disabled={isLoading}
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-white text-sm mb-1">Dificuldade</label>
            <select
              className="p-2 md:p-3 rounded text-blue-900 w-full text-sm md:text-base"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value)}
              disabled={isLoading}
            >
              <option value="facil">Fácil</option>
              <option value="medio">Médio</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
        </div>
        
        <button 
          className={`${
            isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-yellow-300 hover:bg-yellow-400'
          } text-blue-900 px-4 py-2 md:px-6 md:py-3 rounded-lg font-semibold shadow transition mt-2 text-sm md:text-base`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Criando...' : 'Criar Sala'}
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

export default CriarSala; 