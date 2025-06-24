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
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
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

  const getDifficultyInfo = (diff: string) => {
    switch (diff) {
      case 'facil': return { emoji: '🟢', name: 'Fácil', desc: 'Palavras simples' };
      case 'medio': return { emoji: '🟡', name: 'Médio', desc: 'Palavras moderadas' };
      case 'dificil': return { emoji: '🔴', name: 'Difícil', desc: 'Palavras complexas' };
      default: return { emoji: '🟢', name: 'Fácil', desc: 'Palavras simples' };
    }
  };

  const diffInfo = getDifficultyInfo(difficulty);

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-400 text-white mobile:p-3 sm:p-4 touch-manipulation no-scroll-bounce">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🎮</div>
        <h2 className="mobile:text-xl sm:text-2xl md:text-3xl font-bold mb-2">Criar Nova Sala</h2>
        <p className="mobile:text-sm-mobile sm:text-base text-blue-100">Configure sua partida personalizada</p>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/90 backdrop-blur-sm text-white p-3 rounded-xl mb-4 w-full max-w-sm text-center mobile:text-sm-mobile sm:text-sm animate-slide-down border border-red-400">
          ❌ {error}
        </div>
      )}
      
      {/* Form Container */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Nome Input */}
          <div className="space-y-2">
            <label className="block text-white mobile:text-sm-mobile sm:text-sm font-medium">
              👤 Seu nome
            </label>
            <input
              className="w-full ios-button mobile:min-h-touch p-3 rounded-xl text-blue-900 mobile:text-base-mobile sm:text-base placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition"
              type="text"
              placeholder="Digite seu nome..."
              value={nome}
              onChange={e => setNome(e.target.value)}
              required
              disabled={isLoading}
              maxLength={20}
            />
          </div>
          
          {/* Rounds Selection */}
          <div className="space-y-3">
            <label className="block text-white mobile:text-sm-mobile sm:text-sm font-medium">
              🎯 Número de rondas
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`ios-button mobile:min-h-touch p-2 rounded-xl mobile:text-sm-mobile sm:text-base font-bold transition-all transform ${
                    rounds === num 
                      ? 'bg-yellow-300 text-blue-900 scale-105 shadow-lg border-2 border-yellow-500' 
                      : 'bg-white/20 text-white border border-white/30 hover:bg-white/30 tap-feedback'
                  }`}
                  onClick={() => setRounds(num)}
                  disabled={isLoading}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[6, 7, 8, 9, 10].map(num => (
                <button
                  key={num}
                  type="button"
                  className={`ios-button mobile:min-h-touch p-2 rounded-xl mobile:text-sm-mobile sm:text-base font-bold transition-all transform ${
                    rounds === num 
                      ? 'bg-yellow-300 text-blue-900 scale-105 shadow-lg border-2 border-yellow-500' 
                      : 'bg-white/20 text-white border border-white/30 hover:bg-white/30 tap-feedback'
                  }`}
                  onClick={() => setRounds(num)}
                  disabled={isLoading}
                >
                  {num}
                </button>
              ))}
            </div>
            
            {/* Round Duration Info */}
            <div className="text-center p-2 bg-blue-800/50 rounded-lg border border-blue-600/50">
              <div className="mobile:text-xs-mobile sm:text-sm text-yellow-200 font-medium">
                {rounds <= 3 && "⚡ Partida rápida (~3-5 min)"}
                {rounds >= 4 && rounds <= 6 && "⏱️ Partida média (~6-10 min)"}
                {rounds >= 7 && rounds <= 10 && "🕐 Partida longa (~12-15 min)"}
              </div>
            </div>
          </div>
          
          {/* Difficulty Selection */}
          <div className="space-y-3">
            <label className="block text-white mobile:text-sm-mobile sm:text-sm font-medium">
              🎲 Dificuldade
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['facil', 'medio', 'dificil'].map(diff => {
                const info = getDifficultyInfo(diff);
                return (
                  <button
                    key={diff}
                    type="button"
                    className={`ios-button mobile:min-h-touch p-3 rounded-xl transition-all transform ${
                      difficulty === diff 
                        ? 'bg-yellow-300 text-blue-900 scale-105 shadow-lg border-2 border-yellow-500' 
                        : 'bg-white/20 text-white border border-white/30 hover:bg-white/30 tap-feedback'
                    }`}
                    onClick={() => setDifficulty(diff)}
                    disabled={isLoading}
                  >
                    <div className="text-lg mb-1">{info.emoji}</div>
                    <div className="mobile:text-xs-mobile sm:text-sm font-bold">{info.name}</div>
                  </button>
                );
              })}
            </div>
            
            {/* Difficulty Description */}
            <div className="text-center p-2 bg-purple-800/50 rounded-lg border border-purple-600/50">
              <div className="mobile:text-xs-mobile sm:text-sm text-purple-200">
                {diffInfo.emoji} {diffInfo.desc}
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <button 
            className={`ios-button mobile:min-h-touch w-full ${
              isLoading 
                ? 'bg-gray-400/50 cursor-not-allowed' 
                : 'bg-gradient-to-r from-yellow-400 to-yellow-300 hover:from-yellow-300 hover:to-yellow-200 transform hover:scale-105'
            } text-blue-900 mobile:py-4 sm:py-4 px-6 rounded-2xl font-bold shadow-xl transition-all duration-300 mobile:text-base-mobile sm:text-lg flex items-center justify-center gap-3 tap-feedback`} 
            type="submit"
            disabled={isLoading || !nome.trim()}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-900"></div>
                Criando...
              </>
            ) : (
              <>
                <span className="text-xl">🚀</span>
                Criar Sala
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Back Button */}
      <button 
        onClick={() => navigate('/')}
        className="mt-6 ios-button text-white hover:text-yellow-300 mobile:text-sm-mobile sm:text-base font-medium flex items-center gap-2 px-4 py-2 rounded-xl transition tap-feedback"
      >
        <span>⬅️</span>
        Voltar ao início
      </button>

      {/* Tips */}
      <div className="mt-6 w-full max-w-sm">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <h3 className="mobile:text-sm-mobile sm:text-base font-semibold mb-2 text-yellow-300">💡 Dicas:</h3>
          <ul className="mobile:text-xs-mobile sm:text-sm text-blue-100 space-y-1">
            <li>• Escolha um nome fácil de ler</li>
            <li>• 3-5 rondas é ideal para jogos rápidos</li>
            <li>• Dificuldade média é perfeita para iniciantes</li>
            <li>• Partilhe o código com os seus amigos!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CriarSala; 