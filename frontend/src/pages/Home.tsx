import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function Home() {
  const [deviceType, setDeviceType] = useState<'mobile'|'tablet'|'desktop'>('desktop');
  
  // Useeffect para detectar o tipo de dispositivo
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400 p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden">
        <div className="p-6">
          <h1 className={`text-center font-bold text-white ${deviceType === 'mobile' ? 'text-3xl mb-6' : 'text-4xl mb-8'}`}>
            Desenha Rápido!
          </h1>
          
          <div className={`flex flex-col gap-4 ${deviceType === 'mobile' ? 'mt-6' : 'mt-8'}`}>
            <Link
              to="/criar-sala"
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow transition flex items-center justify-center gap-2"
            >
              <span role="img" aria-label="criar">🎨</span> Criar Sala
            </Link>
            
            <Link
              to="/entrar-sala"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow transition flex items-center justify-center gap-2"
            >
              <span role="img" aria-label="entrar">🚪</span> Entrar numa Sala
            </Link>
          </div>
          
          <div className="mt-8 text-center text-white/80 text-sm">
            <p>Desenha e adivinha! Jogo simples e divertido para jogar com amigos.</p>
            {deviceType !== 'mobile' && (
              <p className="mt-2">Compatível com dispositivos móveis e desktop.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home; 