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
    socketService.connect();
    
    return () => {
      // Restaurar viewport original quando componente for desmontado
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
      
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white p-2 sm:p-4">
      <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 sm:mb-3 md:mb-4">Criar Sala</h2>
      
      {error && (
        <div className="bg-red-500 text-white p-2 rounded-lg mb-2 w-full max-w-xs text-center text-xs sm:text-sm">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:gap-3 w-full max-w-xs sm:max-w-sm">
        <input
          className="p-2 sm:p-3 rounded text-blue-900 text-sm"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          disabled={isLoading}
        />
        
        <div className="flex flex-col gap-2">
          <div className="flex-1">
            <label className="block text-white text-sm mb-1">Rondas</label>
            <div className="grid grid-cols-5 gap-1 mb-1">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`p-1.5 sm:p-2 rounded text-xs font-bold transition ${
                    rounds === num 
                      ? 'bg-yellow-300 text-blue-900 border-2 border-yellow-500' 
                      : 'bg-white/20 text-white border-2 border-transparent hover:bg-white/30'
                  }`}
                  onClick={() => setRounds(num)}
                  disabled={isLoading}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-1 mb-1">
              {[6, 7, 8, 9, 10].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`p-1.5 sm:p-2 rounded text-xs font-bold transition ${
                    rounds === num 
                      ? 'bg-yellow-300 text-blue-900 border-2 border-yellow-500' 
                      : 'bg-white/20 text-white border-2 border-transparent hover:bg-white/30'
                  }`}
                  onClick={() => setRounds(num)}
                  disabled={isLoading}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="text-xs text-yellow-200 text-center">
              {rounds <= 3 && "⚡ Rápida (~3-5 min)"}
              {rounds >= 4 && rounds <= 6 && "⏱️ Média (~6-10 min)"}
              {rounds >= 7 && rounds <= 10 && "🕐 Longa (~12-15 min)"}
            </div>
            <input
              type="hidden"
              value={rounds}
              required
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-white text-sm mb-1">Dificuldade</label>
            <select
              className="p-2 sm:p-3 rounded text-blue-900 w-full text-sm"
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
          } text-blue-900 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold shadow transition mt-1 text-sm`} 
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Criando...' : 'Criar Sala'}
        </button>
      </form>
      
      <button 
        onClick={() => navigate('/')}
        className="mt-3 text-white hover:underline text-sm"
      >
        Voltar
      </button>
    </div>
  );
}

export default CriarSala; 