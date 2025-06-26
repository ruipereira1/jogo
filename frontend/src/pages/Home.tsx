import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewport } from '../hooks/useViewport';

function Home() {
  const navigate = useNavigate();
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [orientation, setOrientation] = useState(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');

  // Configurar viewport para mobile
  useViewport();

  // Detectar PWA instalável
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detectar se já está instalado como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Detectar mudanças de orientação
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen-safe flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-400 text-white mobile:p-2 sm:p-4 touch-manipulation no-scroll-bounce">
      {/* PWA Install Banner */}
      {isInstallable && (
        <div className="mobile-fixed-top bg-black/80 backdrop-blur-sm text-white p-3 text-center z-mobile-modal animate-slide-down">
          <p className="text-sm mb-2">📱 Instalar ArteRápida como app?</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleInstallApp}
              className="bg-blue-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-blue-600 transition touch-optimized tap-feedback"
            >
              Instalar
            </button>
            <button
              onClick={() => setIsInstallable(false)}
              className="bg-gray-500 text-white px-4 py-1 rounded-lg text-sm hover:bg-gray-600 transition touch-optimized tap-feedback"
            >
              Agora não
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-4 w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8 animate-bounce-gentle">
          <div className="text-6xl mb-4">🎨</div>
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-yellow-300 via-yellow-200 to-yellow-300 bg-clip-text text-transparent">
            ArteRápida
          </h1>
          <p className="mobile:text-sm-mobile sm:text-base md:text-lg text-blue-100 font-medium">
            Desenhe, adivinhe e divirta-se!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col mobile:gap-3 sm:gap-4 w-full">
          <button
            data-tutorial="create-room"
            className="ios-button mobile:min-h-touch bg-gradient-to-r from-yellow-400 to-yellow-300 text-blue-900 mobile:px-6 mobile:py-4 sm:px-8 sm:py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 mobile:text-base-mobile sm:text-lg flex items-center justify-center gap-3 tap-feedback transform hover:scale-105"
            onClick={() => navigate('/criar-sala')}
          >
            <span className="text-2xl">🎮</span>
            Criar Sala
          </button>
          
          <button
            data-tutorial="join-room"
            className="ios-button mobile:min-h-touch bg-white/20 backdrop-blur-sm text-white mobile:px-6 mobile:py-4 sm:px-8 sm:py-4 rounded-2xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 mobile:text-base-mobile sm:text-lg flex items-center justify-center gap-3 tap-feedback border border-white/30 hover:bg-white/30"
            onClick={() => navigate('/entrar-sala')}
          >
            <span className="text-2xl">🚪</span>
            Entrar em Sala
          </button>
          
          {/* Novo botão para salas públicas */}
          <button
            className="ios-button mobile:min-h-touch bg-purple-500/20 backdrop-blur-sm text-white mobile:px-6 mobile:py-3 sm:px-8 sm:py-3 rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 mobile:text-sm-mobile sm:text-base flex items-center justify-center gap-2 tap-feedback border border-purple-300/30 hover:bg-purple-500/30"
            onClick={() => navigate('/salas-publicas')}
          >
            <span className="text-xl">🌐</span>
            Salas Públicas
          </button>
        </div>

        {/* Features Grid */}
        <div data-tutorial="features" className="grid grid-cols-2 gap-3 mt-8 w-full">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
            <div className="text-2xl mb-1">👥</div>
            <div className="mobile:text-xs-mobile sm:text-sm font-medium">Até 8 jogadores</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
            <div className="text-2xl mb-1">📱</div>
            <div className="mobile:text-xs-mobile sm:text-sm font-medium">Mobile-friendly</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
            <div className="text-2xl mb-1">🎯</div>
            <div className="mobile:text-xs-mobile sm:text-sm font-medium">3 dificuldades</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/20">
            <div className="text-2xl mb-1">💬</div>
            <div className="mobile:text-xs-mobile sm:text-sm font-medium">Chat em tempo real</div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-auto pb-safe-bottom pt-8 text-center">
        <div className="mobile:text-xs sm:text-sm text-blue-100/80 space-y-1">
          <p>Versão 2.0 - Otimizada para mobile 📱</p>
          <p>© 2025 ArteRápida - Dev Rui Valentim</p>
          {orientation === 'landscape' && window.innerHeight < 500 && (
            <p className="text-yellow-300 animate-pulse-fast">
              💡 Rotacione para melhor experiência
            </p>
          )}
        </div>
      </div>

      {/* Debug info pode ser habilitado manualmente se necessário */}
      {false && (
        <div className="fixed bottom-2 right-2 bg-black/50 text-white p-2 rounded text-xs">
          <div>Orientação: {orientation}</div>
          <div>Viewport: {window.innerWidth}x{window.innerHeight}</div>
          <div>PWA: {window.matchMedia('(display-mode: standalone)').matches ? 'Sim' : 'Não'}</div>
        </div>
      )}
    </div>
  );
}

export default Home; 