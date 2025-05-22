import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white p-4">
      <h1 className="text-3xl md:text-4xl font-bold mb-2 md:mb-4 text-center">ArteRápida</h1>
      <p className="mb-6 md:mb-8 text-base md:text-lg text-center">Desenhe, adivinhe e divirta-se!</p>
      
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-xs sm:max-w-md">
        <button
          className="bg-yellow-300 text-blue-900 px-6 py-3 rounded-lg font-semibold shadow hover:bg-yellow-400 transition flex-1 text-sm md:text-base"
          onClick={() => navigate('/criar-sala')}
        >
          Criar Sala
        </button>
        <button
          className="bg-white text-blue-900 px-6 py-3 rounded-lg font-semibold shadow hover:bg-gray-200 transition flex-1 text-sm md:text-base"
          onClick={() => navigate('/entrar-sala')}
        >
          Entrar em Sala
        </button>
      </div>
      
      <div className="mt-12 text-xs md:text-sm text-center text-blue-100">
        <p>Versão 1.1 - Otimizada para todos os dispositivos</p>
        <p className="mt-1">© 2023-2024 ArteRápida</p>
      </div>
    </div>
  );
}

export default Home; 