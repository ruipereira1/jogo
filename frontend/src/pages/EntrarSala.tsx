import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import socketService from '../services/socket';
import { v4 as uuidv4 } from 'uuid';

function EntrarSala() {
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceType, setDeviceType] = useState<'mobile'|'tablet'|'desktop'>('desktop');
  const navigate = useNavigate();
  const location = useLocation();
  const [playerId, setPlayerId] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState(false);

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

  // Extrair código da sala da URL, se presente
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const codigoParam = searchParams.get('codigo');
    if (codigoParam) {
      setCodigo(codigoParam);
    }

    // Carregar nome se estiver guardado
    const nomeGuardado = localStorage.getItem('nomeJogador');
    if (nomeGuardado) {
      setNome(nomeGuardado);
    }
  }, [location]);

  useEffect(() => {
    // Conectar ao servidor Socket.IO
    socketService.connect();
    
    // Preencher o código da sala a partir do parâmetro da URL
    const params = new URLSearchParams(location.search);
    const codigoParam = params.get('codigo');
    if (codigoParam) {
      setCodigo(codigoParam.toUpperCase().slice(0, 6));
    }
    
    const nomeGuardado = localStorage.getItem('nomeJogador');
    if (nomeGuardado) setNome(nomeGuardado);
    
    let id = localStorage.getItem('playerId');
    if (!id) {
      id = uuidv4();
      localStorage.setItem('playerId', id);
    }
    setPlayerId(id);
    
    // Reconexão automática
    const socket = socketService.getSocket();
    const handleDisconnect = () => {
      setIsReconnecting(true);
    };
    const handleConnect = () => {
      setIsReconnecting(false);
      // Se temos nome e código, tentar reentrar automaticamente
      const nome = localStorage.getItem('nomeJogador') || nomeGuardado;
      if (nome && codigo) {
        socketService.joinRoom(nome, codigo, id).then(() => {
          navigate(`/sala/${codigo}`);
        });
      }
    };
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
      if (!socketService.getUser()) {
        socketService.disconnect();
      }
    };
  }, [location.search]);

  const handleEntrarSala = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Por favor, digite seu nome');
      return;
    }
    if (!codigo.trim()) {
      setError('Por favor, digite o código da sala');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Salvar nome para uso futuro
      localStorage.setItem('nomeJogador', nome);

      // Guardar o playerId se presente no localStorage
      const playerId = localStorage.getItem('playerId') || undefined;

      // Conectar ao servidor
      socketService.connect();

      // Primeiro registrar o usuário no socket
      socketService.setUser({ id: playerId, name: nome });

      // Tentar entrar na sala
      const socket = socketService.getSocket();
      socket.emit('join-room', { 
        userName: nome, 
        roomCode: codigo.toUpperCase(), 
        playerId 
      }, (response: any) => {
        setIsLoading(false);
        if (response.success) {
          // Guardar o playerId para reconexões
          if (!playerId) {
            localStorage.setItem('playerId', socket.id);
          }
          navigate(`/sala/${codigo.toUpperCase()}`);
        } else {
          setError(response.error || 'Erro ao entrar na sala');
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
            Entrar em uma Sala
          </h1>
          
          {error && (
            <div className="bg-red-500 text-white p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleEntrarSala} className="flex flex-col gap-4">
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
                htmlFor="codigo" 
                className="block text-white mb-2 font-medium"
              >
                Código da sala
              </label>
              <input
                id="codigo"
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ex: ABC123"
                className="w-full p-3 rounded text-blue-900 bg-white/90 uppercase focus:outline-none focus:ring-2 focus:ring-yellow-400"
                maxLength={6}
                autoComplete="off"
              />
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
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span role="img" aria-label="entrar">🚪</span>
                  Entrar na Sala
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

export default EntrarSala;