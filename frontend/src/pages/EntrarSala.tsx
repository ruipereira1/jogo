import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socketService from '../services/socket';
import { useViewport } from '../hooks/useViewport';

function EntrarSala() {
  const [nome, setNome] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();

  // Configurar viewport para mobile
  useViewport();

  useEffect(() => {
    // Se vier código pela URL, preencher automaticamente
    if (code) {
      setRoomCode(code.toUpperCase());
    }

    // Conectar ao servidor Socket.IO
    socketService.connect();
    
    return () => {
      // Desconectar apenas se o usuário sair sem entrar na sala
      if (!socketService.getUser()) {
        socketService.disconnect();
      }
    };
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Validar código da sala
      if (roomCode.length !== 6) {
        throw new Error('O código da sala deve ter 6 caracteres');
      }
      
      // Entrar na sala
      await socketService.joinRoom(nome, roomCode.toUpperCase());
      // Redirecionar para a sala
      navigate(`/sala/${roomCode.toUpperCase()}`);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao entrar na sala:', err);
      }
      setError(err instanceof Error ? err.message : 'Erro ao entrar na sala');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoomCodeChange = (value: string) => {
    // Limitar a 6 caracteres e converter para maiúsculas
    const formatted = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setRoomCode(formatted);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      
      // Tentar extrair código de 6 dígitos do texto colado
      const match = text.match(/[A-Z0-9]{6}/);
      if (match) {
        setRoomCode(match[0]);
      } else {
        setRoomCode(text.slice(0, 6).toUpperCase());
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.log('Não foi possível colar do clipboard');
      }
      // Silenciosamente falhar se não conseguir acessar clipboard
    }
  };

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-400 text-white mobile:p-3 sm:p-4 touch-manipulation no-scroll-bounce">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🚪</div>
        <h2 className="mobile:text-xl sm:text-2xl md:text-3xl font-bold mb-2">Entrar em Sala</h2>
        <p className="mobile:text-sm-mobile sm:text-base text-blue-100">Digite o código da sala para participar</p>
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
          
          {/* Room Code Input */}
          <div className="space-y-2">
            <label className="block text-white mobile:text-sm-mobile sm:text-sm font-medium">
              🔑 Código da sala
            </label>
            <div className="relative">
              <input
                className="w-full ios-button mobile:min-h-touch p-3 pr-16 rounded-xl text-blue-900 mobile:text-base-mobile sm:text-base placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 transition font-mono tracking-wider text-center uppercase"
                type="text"
                placeholder="ABC123"
                value={roomCode}
                onChange={e => handleRoomCodeChange(e.target.value)}
                required
                disabled={isLoading}
                maxLength={6}
                style={{ letterSpacing: '0.2em' }}
              />
              {/* Paste Button */}
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500/70 hover:bg-blue-500 text-white p-2 rounded-lg transition tap-feedback"
                disabled={isLoading}
                title="Colar código"
              >
                📋
              </button>
            </div>
            
            {/* Code Progress */}
            <div className="flex justify-center space-x-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < roomCode.length
                      ? 'bg-yellow-300 scale-110'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            
            {roomCode.length > 0 && roomCode.length < 6 && (
              <p className="text-center mobile:text-xs-mobile sm:text-sm text-yellow-200">
                {6 - roomCode.length} caracteres restantes
              </p>
            )}
          </div>
          
          {/* Submit Button */}
          <button 
            className={`ios-button mobile:min-h-touch w-full ${
              isLoading 
                ? 'bg-gray-400/50 cursor-not-allowed' 
                : 'bg-gradient-to-r from-green-400 to-green-300 hover:from-green-300 hover:to-green-200 transform hover:scale-105'
            } text-blue-900 mobile:py-4 sm:py-4 px-6 rounded-2xl font-bold shadow-xl transition-all duration-300 mobile:text-base-mobile sm:text-lg flex items-center justify-center gap-3 tap-feedback`} 
            type="submit"
            disabled={isLoading || !nome.trim() || roomCode.length !== 6}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-900"></div>
                Entrando...
              </>
            ) : (
              <>
                <span className="text-xl">🎯</span>
                Entrar na Sala
              </>
            )}
          </button>
        </form>
      </div>
      
      {/* Quick Actions */}
      <div className="mt-6 w-full max-w-sm space-y-3">
        {/* Scan QR Code Button (se suportado) */}
        {'BarcodeDetector' in window && (
          <button 
            onClick={() => {
              // Implementar scanner QR no futuro
              alert('Scanner QR será implementado em breve!');
            }}
            className="w-full ios-button bg-purple-500/20 text-white mobile:py-3 sm:py-3 px-4 rounded-xl font-medium mobile:text-sm-mobile sm:text-base flex items-center justify-center gap-3 tap-feedback border border-purple-400/30"
          >
            <span className="text-lg">📱</span>
            Ler código QR
          </button>
        )}
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/')}
          className="w-full ios-button text-white hover:text-yellow-300 mobile:py-3 sm:py-3 px-4 rounded-xl font-medium mobile:text-sm-mobile sm:text-base flex items-center justify-center gap-3 tap-feedback"
        >
          <span>⬅️</span>
          Voltar ao início
        </button>
      </div>

      {/* Help Section */}
      <div className="mt-6 w-full max-w-sm">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <h3 className="mobile:text-sm-mobile sm:text-base font-semibold mb-2 text-yellow-300">❓ Como funciona:</h3>
          <ul className="mobile:text-xs-mobile sm:text-sm text-blue-100 space-y-1">
            <li>• Peça o código de 6 caracteres ao host</li>
            <li>• O código aparece no topo da tela do host</li>
            <li>• Pode colar o código diretamente</li>
            <li>• Códigos expiram quando a sala é fechada</li>
          </ul>
        </div>
      </div>

      {/* Demo Code for Testing */}
      {code && (
        <div className="mt-4 w-full max-w-sm">
          <div className="bg-green-800/30 backdrop-blur-sm rounded-xl p-3 border border-green-600/50">
            <p className="text-center mobile:text-xs-mobile sm:text-sm text-green-200">
              ✅ Código detectado: <span className="font-mono font-bold">{code}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default EntrarSala; 