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

  // Função para alterar o número de rondas
  const changeRounds = (delta: number) => {
    const newRounds = rounds + delta;
    if (newRounds >= 1 && newRounds <= 10) {
      setRounds(newRounds);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white p-4">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-4 md:mb-6">Criar Sala</h2>
      
      {error && (
        <div className="bg-red-500 text-white p-2 md:p-3 rounded-lg mb-2 sm:mb-3 md:mb-4 w-full max-w-xs md:max-w-sm text-center text-xs sm:text-sm md:text-base">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4 md:gap-5 w-full max-w-xs md:max-w-sm">
        <input
          className="p-3 sm:p-3 md:p-4 rounded text-blue-900 text-sm sm:text-base md:text-lg font-medium"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          disabled={isLoading}
        />
        
        {/* Seletor de Rondas Melhorado */}
        <div className="bg-white bg-opacity-10 p-3 sm:p-4 rounded-lg">
          <label className="block text-white text-sm sm:text-base font-semibold mb-2 text-center">
            Número de Rondas
          </label>
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => changeRounds(-1)}
              disabled={rounds <= 1 || isLoading}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-lg sm:text-xl font-bold transition-all ${
                rounds <= 1 || isLoading
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white shadow-lg active:scale-95'
              }`}
            >
              −
            </button>
            
            <div className="mx-2 sm:mx-4 text-center">
              <div className="bg-white text-blue-900 rounded-lg px-4 py-2 sm:px-6 sm:py-3 font-bold text-lg sm:text-xl min-w-[80px] sm:min-w-[100px]">
                {rounds}
              </div>
              <div className="text-xs sm:text-sm text-blue-200 mt-1">
                {rounds === 1 ? 'ronda' : 'rondas'}
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => changeRounds(1)}
              disabled={rounds >= 10 || isLoading}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full text-lg sm:text-xl font-bold transition-all ${
                rounds >= 10 || isLoading
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-lg active:scale-95'
              }`}
            >
              +
            </button>
          </div>
          
          {/* Botões de seleção rápida */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[1, 3, 5, 10].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => setRounds(num)}
                disabled={isLoading}
                className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  rounds === num
                    ? 'bg-yellow-300 text-blue-900 shadow-md'
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30 active:scale-95'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
        
        {/* Seletor de Dificuldade */}
        <div className="bg-white bg-opacity-10 p-3 sm:p-4 rounded-lg">
          <label className="block text-white text-sm sm:text-base font-semibold mb-2 text-center">
            Dificuldade
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'facil', label: '😊 Fácil', color: 'green' },
              { value: 'medio', label: '😐 Médio', color: 'yellow' },
              { value: 'dificil', label: '😤 Difícil', color: 'red' }
            ].map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                disabled={isLoading}
                className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  difficulty === value
                    ? `bg-${color}-500 text-white shadow-lg scale-105`
                    : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30 active:scale-95'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
              Criando...
            </div>
          ) : (
            '🚀 Criar Sala'
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

export default CriarSala; 