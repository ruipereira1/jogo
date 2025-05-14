import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

function CriarSala() {
  const [nome, setNome] = useState('');
  const [rounds, setRounds] = useState(3);
  const [dificuldade, setDificuldade] = useState('facil');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile'|'tablet'|'desktop'>('desktop');
  const navigate = useNavigate();

  // Detectar tipo de dispositivo
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setDeviceType('mobile');
      } else if (window.innerWidth < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar nome se estiver guardado
  useEffect(() => {
    const nomeGuardado = localStorage.getItem('nomeJogador');
    if (nomeGuardado) {
      setNome(nomeGuardado);
    }
  }, []);

  const handleCriarSala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Por favor, digite seu nome');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Salvar nome para uso futuro
      localStorage.setItem('nomeJogador', nome);

      // Conectar ao servidor
      socketService.connect();

      // Registrar usuário no socket
      socketService.setUser({ id: null, name: nome });

      // Criar sala
      const socket = socketService.getSocket();
      socket.emit('create-room', { 
        userName: nome, 
        rounds, 
        difficulty: dificuldade 
      }, (response: any) => {
        setIsLoading(false);
        if (response.success) {
          localStorage.setItem('playerId', socket.id);
          navigate(`/sala/${response.roomCode}`);
        } else {
          setError(response.error || 'Erro ao criar sala');
        }
      });
    } catch (err) {
      setIsLoading(false);
      setError('Erro ao conectar com o servidor');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden">
        <div className="p-6">
          <h1 className={`text-center font-bold text-white ${deviceType === 'mobile' ? 'text-2xl mb-6' : 'text-3xl mb-8'}`}>
            Criar uma Nova Sala
          </h1>
          
          {error && (
            <div className="bg-red-500 text-white p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleCriarSala} className="flex flex-col gap-4">
            <div>
              <label 
                htmlFor="nome" 
                className="block text-white mb-2 font-medium"
              >
                Seu nome
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome"
                className="w-full p-3 rounded text-blue-900 bg-white/90 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                maxLength={15}
                autoComplete="off"
              />
            </div>
            
            <div>
              <label 
                htmlFor="rounds" 
                className="block text-white mb-2 font-medium"
              >
                Número de rondas
              </label>
              <div className="flex items-center">
                <input
                  id="rounds"
                  type="range"
                  min={1}
                  max={10}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="w-full mr-3"
                />
                <span className="bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold">
                  {rounds}
                </span>
              </div>
            </div>
            
            <div>
              <label 
                htmlFor="dificuldade" 
                className="block text-white mb-2 font-medium"
              >
                Dificuldade das palavras
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDificuldade('facil')}
                  className={`flex-1 py-2 px-3 rounded font-medium ${dificuldade === 'facil' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  Fácil
                </button>
                <button
                  type="button"
                  onClick={() => setDificuldade('medio')}
                  className={`flex-1 py-2 px-3 rounded font-medium ${dificuldade === 'medio' 
                    ? 'bg-yellow-500 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  Médio
                </button>
                <button
                  type="button"
                  onClick={() => setDificuldade('dificil')}
                  className={`flex-1 py-2 px-3 rounded font-medium ${dificuldade === 'dificil' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white/20 text-white hover:bg-white/30'}`}
                >
                  Difícil
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 font-bold rounded shadow transition focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-300 text-blue-900 hover:bg-yellow-400 mt-2 flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-blue-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Criando...</span>
                </>
              ) : (
                <>
                  <span role="img" aria-label="criar">🎨</span>
                  Criar Sala
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate('/')}
              className="text-white/80 hover:text-white text-sm"
            >
              Voltar para o início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CriarSala; 