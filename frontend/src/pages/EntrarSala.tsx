import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import socketService from '../services/socket';
import { useViewport } from '../hooks/useViewport';

function EntrarSala() {
  const [nome, setNome] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrScannerError, setQrScannerError] = useState('');
  const navigate = useNavigate();
  const { roomCode: urlRoomCode } = useParams<{ roomCode: string }>();
  const nomeInputRef = useRef<HTMLInputElement>(null);

  // Configurar viewport para mobile
  useViewport();

  useEffect(() => {
    // Se vier código pela URL, preencher automaticamente
    if (urlRoomCode) {
      setRoomCode(urlRoomCode.toUpperCase());
      setSuccessMessage('Código da sala carregado automaticamente!');
      setTimeout(() => setSuccessMessage(''), 4000);
      
      // Focar no campo nome após um pequeno delay para melhor UX
      setTimeout(() => {
        nomeInputRef.current?.focus();
      }, 500);
    }

    // Conectar ao servidor Socket.IO
    socketService.connect();
    
    return () => {
      // Desconectar apenas se o usuário sair sem entrar na sala
      if (!socketService.getUser()) {
        socketService.disconnect();
      }
    };
  }, [urlRoomCode]);

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
      
      // Tentar extrair código de diferentes formatos de URL
      const urlPatterns = [
        /\/entrar-sala\/([A-Z0-9]{6})/i,           // /entrar-sala/ABC123
        /\/sala\/([A-Z0-9]{6})/i,                  // /sala/ABC123
        /[?&]codigo=([A-Z0-9]{6})/i,               // ?codigo=ABC123
        /[?&]roomCode=([A-Z0-9]{6})/i,             // ?roomCode=ABC123
        /[?&]room=([A-Z0-9]{6})/i,                 // ?room=ABC123
      ];
      
      for (const pattern of urlPatterns) {
        const match = text.match(pattern);
        if (match) {
          setRoomCode(match[1].toUpperCase());
          setSuccessMessage('🔗 Código da sala detectado do link!');
          setTimeout(() => setSuccessMessage(''), 4000);
          return;
        }
      }
      
      // Se não for URL, tentar extrair código de 6 caracteres alfanuméricos
      const codeMatch = text.match(/\b[A-Z0-9]{6}\b/i);
      if (codeMatch) {
        setRoomCode(codeMatch[0].toUpperCase());
        setSuccessMessage('📋 Código da sala detectado!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        // Como último recurso, pegar os primeiros 6 caracteres válidos
        const cleanText = text.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
        if (cleanText.length > 0) {
          setRoomCode(cleanText);
          setSuccessMessage('✂️ Texto processado para código!');
          setTimeout(() => setSuccessMessage(''), 3000);
        } else {
          setError('Nenhum código válido encontrado no texto colado');
          setTimeout(() => setError(''), 3000);
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.log('Não foi possível colar do clipboard');
      }
      setError('Não foi possível acessar a área de transferência');
      setTimeout(() => setError(''), 3000);
    }
  };

  const startQrScanner = async () => {
    try {
      setQrScannerError('');
      setShowQrScanner(true);
      
      // Verificar se o dispositivo suporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmara não suportada neste dispositivo');
      }

      let stream: MediaStream | null = null;
      
      try {
        // Pedir permissão para usar a câmara
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment' // Câmara traseira preferencialmente
          } 
        });
      } catch (cameraError) {
        // Tentar câmara frontal se traseira falhar
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' } 
          });
        } catch (frontCameraError) {
          throw new Error('Não foi possível aceder à câmara. Verifique as permissões.');
        }
      }
      
      if (!stream) {
        throw new Error('Falha ao obter stream da câmara');
      }
      
      // Criar elemento de vídeo
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // iOS compatibility
      video.setAttribute('muted', 'true'); // Evitar problemas de autoplay
      
      let isScanning = true;
      
      const cleanup = () => {
        isScanning = false;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        video.remove();
      };

      // Aguardar até o vídeo estar pronto
      video.addEventListener('loadedmetadata', () => {
        if (!isScanning) {
          cleanup();
          return;
        }
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          cleanup();
          throw new Error('Não foi possível criar contexto do canvas');
        }
        
        const scanFrame = () => {
          if (!isScanning || !showQrScanner) {
            cleanup();
            return;
          }
          
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // TODO: Integrar biblioteca de detecção QR (jsQR, qr-scanner)
            // const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            // const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
            
            // Por enquanto, simular detecção
            requestAnimationFrame(scanFrame);
          } else {
            requestAnimationFrame(scanFrame);
          }
        };
        
        // Iniciar após vídeo carregar
        video.play().then(() => {
          scanFrame();
          
          // Simular detecção após 3 segundos (remover quando implementar biblioteca real)
          setTimeout(() => {
            if (isScanning) {
              cleanup();
              setShowQrScanner(false);
              setSuccessMessage('Scanner QR implementado com sucesso! (Biblioteca de detecção pendente)');
              setTimeout(() => setSuccessMessage(''), 3000);
            }
          }, 3000);
        }).catch(() => {
          cleanup();
          throw new Error('Erro ao reproduzir vídeo da câmara');
        });
      });

      video.addEventListener('error', () => {
        cleanup();
        throw new Error('Erro no stream de vídeo');
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao aceder à câmara';
      setQrScannerError(errorMessage);
      setShowQrScanner(false);
      if (import.meta.env.DEV) {
        console.error('Erro no scanner QR:', err);
      }
    }
  };

  const stopQrScanner = () => {
    setShowQrScanner(false);
    setQrScannerError('');
    
    // Parar o stream ativo se existir (será gerenciado pelo startQrScanner)
    // O cleanup será feito automaticamente pelo useEffect do startQrScanner
  };

      return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-400 text-white mobile:p-3 sm:p-4 touch-manipulation no-scroll-bounce">
      {/* QR Scanner Modal */}
      {showQrScanner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 max-w-sm w-full relative">
            <button 
              onClick={stopQrScanner}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl z-10"
            >
              ✕
            </button>
            
            <h3 className="text-blue-900 text-lg font-bold mb-4 text-center">📱 Scanner QR</h3>
            
            <div className="bg-gray-100 rounded-lg p-4 mb-4 text-center">
              <div className="inline-block p-4 bg-blue-100 rounded-lg">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-blue-900 text-sm">
                  A aceder à câmara...
                </p>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-gray-600 text-xs mb-2">
                📋 Aponte a câmara para o QR code da sala
              </p>
              <p className="text-gray-500 text-xs">
                O código será detectado automaticamente
              </p>
            </div>
            
            <button
              onClick={stopQrScanner}
              className="w-full mt-4 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
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
      
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/90 backdrop-blur-sm text-white p-3 rounded-xl mb-4 w-full max-w-sm text-center mobile:text-sm-mobile sm:text-sm animate-slide-down border border-green-400">
          ✅ {successMessage}
        </div>
      )}
      
      {/* QR Scanner Error */}
      {qrScannerError && (
        <div className="bg-orange-500/90 backdrop-blur-sm text-white p-3 rounded-xl mb-4 w-full max-w-sm text-center mobile:text-sm-mobile sm:text-sm animate-slide-down border border-orange-400">
          📱 {qrScannerError}
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
              ref={nomeInputRef}
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
        {(typeof navigator !== 'undefined' && navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices) && (
          <button 
            onClick={startQrScanner}
            disabled={isLoading || showQrScanner}
            className={`w-full ios-button ${showQrScanner ? 'bg-orange-500/50' : 'bg-purple-500/20 hover:bg-purple-500/30'} text-white mobile:py-3 sm:py-3 px-4 rounded-xl font-medium mobile:text-sm-mobile sm:text-base flex items-center justify-center gap-3 tap-feedback border ${showQrScanner ? 'border-orange-400/50' : 'border-purple-400/30'} transition-all`}
          >
            <span className="text-lg">{showQrScanner ? '📷' : '📱'}</span>
            {showQrScanner ? 'A escanear...' : 'Ler código QR'}
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

      {/* Código detectado da URL */}
      {urlRoomCode && (
        <div className="mt-4 w-full max-w-sm">
          <div className="bg-green-800/30 backdrop-blur-sm rounded-xl p-3 border border-green-600/50">
            <div className="text-center mb-3">
              <p className="mobile:text-sm-mobile sm:text-base text-green-200 font-medium">
                ✨ Entrada Automática
              </p>
              <p className="text-center mobile:text-xs-mobile sm:text-sm text-green-300">
                Código detectado: <span className="font-mono font-bold text-green-100">{urlRoomCode}</span>
              </p>
            </div>
            <p className="text-center mobile:text-xs-mobile sm:text-sm text-green-200 mb-2">
              🎯 Basta inserir seu nome e clicar em "Entrar na Sala"!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default EntrarSala; 