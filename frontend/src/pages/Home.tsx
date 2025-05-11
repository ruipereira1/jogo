import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 text-white">
      <h1 className="text-4xl font-bold mb-4">ArteRápida</h1>
      <p className="mb-8 text-lg">Desenhe, adivinhe e divirta-se!</p>
      <div className="flex gap-4">
        <button
          className="bg-yellow-300 text-blue-900 px-6 py-2 rounded-lg font-semibold shadow hover:bg-yellow-400 transition"
          onClick={() => navigate('/criar-sala')}
        >
          Criar Sala
        </button>
        <button
          className="bg-white text-blue-900 px-6 py-2 rounded-lg font-semibold shadow hover:bg-gray-200 transition"
          onClick={() => navigate('/entrar-sala')}
        >
          Entrar em Sala
        </button>
      </div>
    </div>
  );
}

export default Home; 