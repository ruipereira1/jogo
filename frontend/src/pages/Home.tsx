import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  // Adicionar viewport meta tag para mobile
  React.useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.getElementsByTagName('head')[0].appendChild(meta);
    }

    return () => {
      // Restaurar viewport original quando componente for desmontado
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white p-4">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 md:mb-4 text-center">ArteRápida</h1>
      <p className="mb-4 sm:mb-6 md:mb-8 text-sm sm:text-base md:text-lg text-center">Desenhe, adivinhe e divirta-se!</p>
      
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 w-full max-w-xs sm:max-w-md">
        <button
          className="bg-yellow-300 text-blue-900 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold shadow hover:bg-yellow-400 transition flex-1 text-xs sm:text-sm md:text-base"
          onClick={() => navigate('/criar-sala')}
        >
          Criar Sala
        </button>
        <button
          className="bg-white text-blue-900 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold shadow hover:bg-gray-200 transition flex-1 text-xs sm:text-sm md:text-base"
          onClick={() => navigate('/entrar-sala')}
        >
          Entrar em Sala
        </button>
      </div>
      
      <div className="mt-8 sm:mt-10 md:mt-12 text-[10px] sm:text-xs md:text-sm text-center text-blue-100">
        <p>Versão 1.2 - Otimizada para todos os dispositivos</p>
        <p className="mt-1">© 2025 ArteRápida - Desenvolvido por Dev Rui Valentim</p>
      </div>
    </div>
  );
}

export default Home; 