import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

function Sala() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isDrawer, setIsDrawer] = useState(false);
  const [word, setWord] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 350 });
  const [lines, setLines] = useState<any[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState<{ name: string; text: string; correct: boolean }[]>([]);
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [round, setRound] = useState<number>(1);
  const [timer, setTimer] = useState<number>(0);
  const [roundEnded, setRoundEnded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [podium, setPodium] = useState<Player[] | null>(null);
  const [newRounds, setNewRounds] = useState(3);
  const [maxRounds, setMaxRounds] = useState<number>(1);
  const user = socketService.getUser();
  const isCurrentUserHost = players.find(p => p.id === user?.id)?.isHost;
  const [isLastRoundCountdown, setIsLastRoundCountdown] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  // Adicionar viewport meta tag para mobile através do useEffect
  useEffect(() => {
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

  // Função para calcular o tamanho do canvas com base no container
  const updateCanvasSize = () => {
    if (canvasContainerRef.current) {
      const containerWidth = canvasContainerRef.current.clientWidth;
      // Em telas menores, usar quase a largura completa, mas mantendo proporção
      const screenWidth = window.innerWidth;
      let newWidth, newHeight;
      
      if (screenWidth < 480) { // Telefones pequenos
        newWidth = Math.min(300, containerWidth - 10);
      } else if (screenWidth < 768) { // Telefones maiores
        newWidth = Math.min(400, containerWidth - 15);
      } else { // Tablets e desktop
        newWidth = Math.min(500, containerWidth - 20);
      }
      
      newHeight = Math.floor(newWidth * 0.7); // Manter proporção de aspecto
      setCanvasSize({ width: newWidth, height: newHeight });
    }
  };

  // Atualizar o tamanho do canvas quando a janela for redimensionada
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  useEffect(() => {
    const socket = socketService.getSocket();
    const user = socketService.getUser();

    if (!user || !roomCode) {
      // Usuário não está logado ou não tem código de sala
      navigate('/');
      return;
    }

    // Ouvir eventos do socket
    socket.on('player-joined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('player-left', ({ players }) => {
      setPlayers(players);
      
      // Verificar se não há mais jogadores na sala (incluindo o usuário atual)
      if (players.length === 0) {
        navigate('/');
      }
    });

    socket.on('players-update', ({ players, drawerId, round, maxRounds }) => {
      setPlayers(players);
      setDrawerId(drawerId);
      setRound(round);
      if (maxRounds) setMaxRounds(maxRounds);
    });

    socket.on('game-started', () => {
      setIsGameStarted(true);
    });

    socket.on('round-start', ({ isDrawer, word }) => {
      setIsDrawer(isDrawer);
      setWord(isDrawer ? word : null);
      setGuesses([]);
      setGuessedCorrectly(false);
      setWinnerName(null);
    });

    // Receber linhas desenhadas de outros jogadores
    socket.on('draw-line', (line) => {
      setLines(prev => [...prev, line]);
    });

    socket.on('guess', ({ name, text, correct }) => {
      setGuesses(prev => [...prev, { name, text, correct }]);
      if (correct) {
        setWinnerName(name);
      }
      if (correct && name === socketService.getUser()?.name) {
        setGuessedCorrectly(true);
      }
    });

    // Simular recebimento de jogadores iniciais
    // (Em uma implementação completa, isso viria do evento de entrada na sala)
    // Para simplificar, estamos apenas adicionando o próprio usuário
    
    socket.on('clear-canvas', () => {
      setLines([]);
    });

    socket.on('timer-update', ({ timeLeft }) => {
      setTimer(timeLeft);
    });

    socket.on('round-ended', ({ reason, message }) => {
      if (reason === 'timeout') {
        setRoundEnded(true);
        setTimeout(() => setRoundEnded(false), 4000); // Esconde a mensagem após 4 segundos
      } else if (reason === 'drawer-left') {
        // Mostrar mensagem especial quando o desenhista sai
        setToastMessage(message || 'O desenhista saiu da sala. Avançando para próxima ronda...');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      }
    });

    socket.on('countdown', ({ value, round: countdownRound, maxRounds: countdownMaxRounds }) => {
      setCountdown(value > 0 ? value : null);
      setIsLastRoundCountdown(countdownRound === countdownMaxRounds && value > 0 && value <= 3);
    });

    socket.on('game-ended', ({ players }) => {
      // Ordenar por pontuação decrescente
      const sorted = [...players].sort((a, b) => b.score - a.score);
      setPodium(sorted);
    });

    socket.on('game-restarted', () => {
      setPodium(null);
      setRoundEnded(false);
      setCountdown(null);
      setTimer(0);
      setWinnerName(null);
      setGuesses([]);
      setIsGameStarted(false);
    });
    
    // Escutar evento quando a sala é excluída (todos saíram)
    socket.on('room-deleted', () => {
      navigate('/');
    });
    
    // Escutar evento quando a sala não é encontrada
    socket.on('room-not-found', () => {
      setError('Sala não encontrada ou foi excluída');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    });
    
    // Escutar evento quando a sala não é encontrada
    socket.on('room-not-found', () => {
      setError('Sala não encontrada ou foi excluída');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    });

    setIsLoading(false);

    return () => {
      // Limpar listeners ao sair
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('players-update');
      socket.off('draw-line');
      socket.off('guess');
      socket.off('clear-canvas');
      socket.off('timer-update');
      socket.off('round-ended');
      socket.off('countdown');
      socket.off('game-ended');
      socket.off('game-restarted');
      socket.off('room-deleted');
      socket.off('room-not-found');
    };
  }, [roomCode, navigate]);

  const handleLeaveRoom = () => {
    // Desconectar do socket e voltar para home
    socketService.disconnect();
    navigate('/');
  };

  const handleStartGame = () => {
    socketService.getSocket().emit('start-game', { roomCode });
  };

  // Adaptar ponto para o tamanho atual do canvas
  const adaptPoint = (point: { x: number, y: number }, originalWidth = 500, originalHeight = 350) => {
    return {
      x: (point.x / originalWidth) * canvasSize.width,
      y: (point.y / originalHeight) * canvasSize.height
    };
  };

  // Desnormalizar ponto para o tamanho original
  const denormalizePoint = (point: { x: number, y: number }, originalWidth = 500, originalHeight = 350) => {
    return {
      x: (point.x * originalWidth) / canvasSize.width,
      y: (point.y * originalHeight) / canvasSize.height
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawer) return;
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalizedPoint = denormalizePoint({ x, y });
    setLines(prev => [...prev, { points: [normalizedPoint] }]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawer || !drawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalizedPoint = denormalizePoint({ x, y });
    setLines(prev => {
      const newLines = [...prev];
      newLines[newLines.length - 1].points.push(normalizedPoint);
      return newLines;
    });
  };

  // Adicionar suporte para eventos de toque
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    // Previne rolagem da tela
    e.preventDefault();
    e.stopPropagation();
    
    // Armazena posição inicial do toque
    setDrawing(true);
    const touch = e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const normalizedPoint = denormalizePoint({ x, y });
    setLines(prev => [...prev, { points: [normalizedPoint] }]);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawer || !drawing) return;
    // Previne rolagem da tela
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const normalizedPoint = denormalizePoint({ x, y });
    setLines(prev => {
      const newLines = [...prev];
      newLines[newLines.length - 1].points.push(normalizedPoint);
      return newLines;
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    // Previne rolagem da tela
    e.preventDefault();
    e.stopPropagation();
    
    setDrawing(false);
    // Enviar a última linha desenhada para o backend
    const socket = socketService.getSocket();
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      socket.emit('draw-line', { roomCode, line: lastLine });
    }
  };

  const handleMouseUp = () => {
    if (!isDrawer) return;
    setDrawing(false);
    // Enviar a última linha desenhada para o backend
    const socket = socketService.getSocket();
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      socket.emit('draw-line', { roomCode, line: lastLine });
    }
  };

  // Desenhar no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    lines.forEach(line => {
      ctx.beginPath();
      line.points.forEach((pt: any, i: number) => {
        const adaptedPt = adaptPoint(pt);
        if (i === 0) ctx.moveTo(adaptedPt.x, adaptedPt.y);
        else ctx.lineTo(adaptedPt.x, adaptedPt.y);
      });
      ctx.stroke();
    });
  }, [lines, canvasSize]);

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || guessedCorrectly) return;
    socketService.getSocket().emit('guess', { roomCode, text: guess });
    setGuess('');
  };

  // Função para apagar o desenho
  const handleClearCanvas = () => {
    setLines([]);
    socketService.getSocket().emit('clear-canvas', { roomCode });
  };

  // Função para compartilhar sala via WhatsApp
  const handleShareWhatsApp = () => {
    try {
      // Criar URL para a página de entrada direta com o código da sala
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/entrar-sala/${roomCode}`;
      
      const shareText = `Venha jogar ArteRápida comigo! Basta entrar com seu nome:\n\n${shareUrl}`;
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
      
      const newWindow = window.open(whatsappUrl, '_blank');
      
      // Verificar se a janela foi aberta com sucesso
      if (newWindow) {
        setToastMessage('Link para WhatsApp aberto!');
      } else {
        setToastMessage('Não foi possível abrir o WhatsApp. Verifique se pop-ups estão habilitados.');
      }
      
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Erro ao compartilhar no WhatsApp:', error);
      setToastMessage('Erro ao abrir WhatsApp');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  // Função para abrir modal de compartilhamento
  const handleOpenShareModal = () => {
    setShowShareModal(true);
  };
  
  // Função para fechar modal de compartilhamento
  const handleCloseShareModal = () => {
    setShowShareModal(false);
  };

  // Função para copiar o código da sala
  const handleCopyRoomCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomCode || '');
    } else {
      // Fallback para navegadores mais antigos
      const textArea = document.createElement('textarea');
      textArea.value = roomCode || '';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setToastMessage('Código da sala copiado!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400">
        <div className="text-white text-xl">Carregando sala...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400">
        <div className="bg-red-500 text-white p-4 rounded-lg mb-4">{error}</div>
        <button 
          onClick={() => navigate('/')}
          className="bg-white text-blue-900 px-6 py-2 rounded-lg font-semibold shadow hover:bg-gray-200 transition"
        >
          Voltar para Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-400 text-white p-1 sm:p-2 md:p-4 overflow-x-hidden">
      {/* Toast de notificação */}
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-fade-in-out">
          {toastMessage}
        </div>
      )}
      
      {/* Modal de compartilhamento */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 max-w-sm w-full relative">
            <button 
              onClick={handleCloseShareModal}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            
            <h3 className="text-blue-900 text-lg sm:text-xl font-bold mb-3 text-center">Compartilhar Sala</h3>
            
            <div className="text-center mb-4">
              <p className="text-gray-600 text-sm">Código da sala:</p>
              <div className="bg-blue-100 text-blue-900 font-mono text-xl sm:text-2xl font-bold p-2 rounded flex justify-center items-center gap-2 mb-3">
                {roomCode}
                <button 
                  onClick={handleCopyRoomCode}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  <span role="img" aria-label="copiar">📋</span>
                </button>
              </div>
              
              <div className="flex flex-col space-y-2 mb-4">
                <p className="text-gray-600 text-sm">Link direto (só precisará digitar seu nome):</p>
                <div className="flex gap-2 justify-center">
                  <input 
                    type="text" 
                    value={`${window.location.origin}/entrar-sala/${roomCode}`} 
                    readOnly 
                    className="bg-gray-100 text-gray-800 p-2 rounded text-xs sm:text-sm flex-1 truncate"
                  />
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/entrar-sala/${roomCode}`;
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(shareUrl);
                      } else {
                        // Fallback para navegadores mais antigos
                        const textArea = document.createElement('textarea');
                        textArea.value = shareUrl;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                      }
                      setToastMessage('Link direto copiado!');
                      setShowToast(true);
                      setTimeout(() => setShowToast(false), 3000);
                    }}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    Copiar
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
                <button
                  onClick={handleShareWhatsApp}
                  className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <span role="img" aria-label="whatsapp">📱</span> WhatsApp
                </button>
                {navigator.share && (
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/entrar-sala/${roomCode}`;
                      navigator.share({
                        title: 'ArteRápida - Jogo de Desenho',
                        text: `Venha jogar ArteRápida comigo! Basta entrar com seu nome.`,
                        url: shareUrl
                      })
                      .then(() => {
                        setToastMessage('Compartilhado com sucesso!');
                        setShowToast(true);
                        setTimeout(() => setShowToast(false), 3000);
                      })
                      .catch(err => console.error('Erro ao compartilhar:', err));
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <span role="img" aria-label="share">📤</span> Compartilhar
                  </button>
                )}
              </div>
              
              <div className="mt-4">
                <p className="text-gray-600 text-sm mb-2">Ou escaneie o QR Code:</p>
                <div className="bg-white p-2 rounded-lg inline-block">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/entrar-sala/${roomCode}`)}`} 
                    alt="QR Code da sala" 
                    className="w-32 h-32 sm:w-40 sm:h-40 mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<p class="text-gray-500 text-xs p-4">QR Code indisponível</p>';
                      }
                    }}
                  />
                  <p className="text-gray-500 text-xs mt-1">Aponte a câmera para entrar diretamente</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 sm:mb-4 md:mb-6 gap-1 sm:gap-2">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Sala: {roomCode}</h1>
          <span className="bg-blue-800 text-white px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded-lg font-semibold shadow text-xs sm:text-sm md:text-base">
            Jogadores: {players.length}
          </span>
          <div className="flex gap-1 sm:gap-2 mt-1 sm:mt-0">
            <button
              onClick={handleOpenShareModal}
              className="bg-blue-600 text-white px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded text-xs sm:text-sm md:text-base hover:bg-blue-700 transition flex items-center gap-1"
            >
              <span role="img" aria-label="compartilhar">🔗</span> Compartilhar
            </button>
            {isCurrentUserHost && !isGameStarted && (
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded text-xs sm:text-sm md:text-base hover:bg-green-600 transition"
              >
                Iniciar Jogo
              </button>
            )}
            <button 
              onClick={handleLeaveRoom}
              className="bg-red-500 text-white px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded text-xs sm:text-sm md:text-base hover:bg-red-600 transition"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Layout responsivo para todos os dispositivos */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {/* Lista de jogadores */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3 md:p-4 sm:w-1/3">
            <div className="flex justify-between items-center mb-1 sm:mb-2 md:mb-3">
              <h2 className="font-semibold text-sm sm:text-base">Jogadores ({players.length})</h2>
              <button
                onClick={handleOpenShareModal}
                className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] sm:text-xs hover:bg-blue-700 transition flex items-center gap-1"
              >
                <span role="img" aria-label="compartilhar">🔗</span> Compartilhar
              </button>
            </div>
            <ul className="space-y-1 sm:space-y-2 max-h-32 sm:max-h-none overflow-y-auto">
              {players.map(player => (
                <li 
                  key={player.id} 
                  className={`flex items-center gap-1 sm:gap-2 p-1 sm:p-2 bg-white/10 rounded ${drawerId === player.id ? 'border-2 border-yellow-300' : ''}`}
                >
                  <span className="flex-1 truncate text-xs sm:text-sm md:text-base">{player.name}</span>
                  <span className="text-yellow-300 text-xs sm:text-sm md:text-base">{player.score}</span>
                  {player.isHost && (
                    <span className="bg-yellow-300 text-blue-900 text-[10px] sm:text-xs px-1 py-0.5 rounded">HOST</span>
                  )}
                  {drawerId === player.id && (
                    <span className="bg-green-300 text-blue-900 text-[10px] sm:text-xs px-1 py-0.5 rounded ml-1">✏️</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-yellow-200">Ronda: {round || 0}</div>
          </div>

          {/* Área principal de jogo */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 sm:p-3 md:p-4 text-center sm:w-2/3">
            {isGameStarted ? (
              isDrawer ? (
                <>
                  <p className="text-sm sm:text-lg md:text-xl mb-1 sm:mb-2 text-green-300 font-bold">Você é o desenhista!</p>
                  <p className="text-sm sm:text-lg md:text-xl mb-1 sm:mb-2 md:mb-4">Palavra: <span className="font-mono bg-yellow-200 text-blue-900 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm md:text-base">{word}</span></p>
                  
                  {/* Seção de compartilhamento para convidar mais pessoas */}
                  <div className="flex justify-center mb-2">
                    <p className="text-[10px] sm:text-xs md:text-sm text-yellow-200 mr-2">Faltam jogadores?</p>
                    <button
                      onClick={handleOpenShareModal}
                      className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs hover:bg-blue-700 transition flex items-center gap-1"
                    >
                      <span role="img" aria-label="compartilhar">🔗</span> Compartilhar
                    </button>
                  </div>
                  
                  <div ref={canvasContainerRef} className="w-full">
                    <canvas
                      ref={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className="border-2 border-yellow-300 bg-white rounded mb-2 sm:mb-4 cursor-crosshair mx-auto"
                      style={{ touchAction: "none" }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                    />
                  </div>
                  <button
                    onClick={handleClearCanvas}
                    className="bg-red-500 text-white px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded mb-1 sm:mb-2 text-xs sm:text-sm md:text-base hover:bg-red-600 transition"
                  >
                    Apagar
                  </button>
                  <p className="text-[10px] sm:text-xs md:text-sm opacity-70">Desenhe algo relacionado à palavra!</p>
                </>
              ) : (
                <>
                  <p className="text-sm sm:text-lg md:text-xl mb-1 sm:mb-2 md:mb-4 text-blue-200 font-bold">Aguardando o desenho...</p>
                  
                  {/* Seção de compartilhamento para convidar mais pessoas */}
                  <div className="flex justify-center mb-2">
                    <p className="text-[10px] sm:text-xs md:text-sm text-yellow-200 mr-2">Faltam jogadores?</p>
                    <button
                      onClick={handleOpenShareModal}
                      className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] sm:text-xs hover:bg-blue-700 transition flex items-center gap-1"
                    >
                      <span role="img" aria-label="compartilhar">🔗</span> Compartilhar
                    </button>
                  </div>
                  
                  <div ref={canvasContainerRef} className="w-full">
                    <canvas
                      ref={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className="border-2 border-yellow-300 bg-white rounded mb-2 sm:mb-4 mx-auto"
                      style={{ touchAction: "none", cursor: 'not-allowed' }}
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs md:text-sm opacity-70">O desenho aparecerá aqui em tempo real!</p>
                  {/* Campo de palpite */}
                  <form onSubmit={handleGuessSubmit} className="flex gap-1 sm:gap-2 mt-1 sm:mt-2 md:mt-4 justify-center">
                    <input
                      type="text"
                      className="p-1 sm:p-2 rounded text-blue-900 w-full sm:w-64 text-xs sm:text-sm md:text-base"
                      placeholder={guessedCorrectly ? "Você já acertou!" : "Digite seu palpite..."}
                      value={guess}
                      onChange={e => setGuess(e.target.value)}
                      disabled={guessedCorrectly}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="bg-yellow-300 text-blue-900 px-2 py-1 sm:px-3 sm:py-1 md:px-4 md:py-2 rounded font-semibold shadow text-xs sm:text-sm md:text-base hover:bg-yellow-400 transition"
                      disabled={guessedCorrectly}
                    >
                      Enviar
                    </button>
                  </form>
                  {/* Feed de palpites */}
                  <div className="mt-1 sm:mt-2 md:mt-4 max-h-24 sm:max-h-28 md:max-h-40 overflow-y-auto bg-white/20 rounded p-1 sm:p-2 text-left text-xs sm:text-sm md:text-base">
                    {guesses.map((g, i) => (
                      <div key={i} className={g.correct ? "text-green-300 font-bold" : "text-white"}>
                        <span className="font-semibold">{g.name}:</span> {g.text}
                        {g.correct && <span className="ml-1 sm:ml-2 bg-green-300 text-blue-900 px-1 py-0.5 rounded text-[10px] sm:text-xs">ACERTOU!</span>}
                      </div>
                    ))}
                  </div>
                </>
              )
            ) : (
              <>
                <p className="text-sm sm:text-lg md:text-xl mb-1 sm:mb-2 md:mb-4">Aguardando início do jogo...</p>
                
                {/* Seção de compartilhamento quando o jogo não começou */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-2 mb-3">
                  <p className="text-xs sm:text-sm">Compartilhar sala: <span className="font-bold text-yellow-300">{roomCode}</span></p>
                  <button
                    onClick={handleOpenShareModal}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] sm:text-xs hover:bg-blue-700 transition flex items-center gap-1"
                  >
                    <span role="img" aria-label="compartilhar">🔗</span> Compartilhar sala
                  </button>
                </div>
                
                <p className="text-[10px] sm:text-xs md:text-sm opacity-70">
                  Em breve: o canvas de desenho e a lógica de jogo aparecerão aqui!
                </p>
              </>
            )}
          </div>
        </div>

        {/* Cronómetro da ronda */}
        {isGameStarted && (
          <div className="mt-1 sm:mt-2 md:mt-4 text-base sm:text-xl md:text-2xl font-bold text-yellow-300 text-center">Tempo: {timer}s</div>
        )}

        {winnerName && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-2 sm:p-4">
            <div className="bg-green-500 text-white text-lg sm:text-xl md:text-4xl font-extrabold px-4 py-3 sm:px-6 sm:py-4 md:px-12 md:py-8 rounded-xl shadow-2xl border-4 border-white animate-pulse text-center">
              {winnerName} acertou a palavra!
            </div>
          </div>
        )}

        {/* Mensagem de fim de ronda */}
        {roundEnded && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-2 sm:p-4">
            <div className="bg-red-500 text-white text-lg sm:text-xl md:text-3xl font-extrabold px-4 py-3 sm:px-6 sm:py-4 md:px-10 md:py-6 rounded-xl shadow-2xl border-4 border-white animate-pulse text-center">
              Tempo esgotado! A ronda terminou.
            </div>
          </div>
        )}

        {/* Countdown antes da ronda */}
        {countdown !== null && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-2 sm:p-4">
            <div className="flex flex-col items-center">
              {/* Número do countdown sempre em destaque no topo */}
              <div className={`order-1 text-4xl sm:text-5xl md:text-7xl font-extrabold px-8 sm:px-12 md:px-16 py-6 sm:py-8 md:py-10 rounded-xl shadow-2xl border-4 border-white mb-2 ${round === maxRounds ? 'bg-gradient-to-r from-pink-500 via-yellow-400 to-red-500 text-white animate-bounce' : 'bg-blue-800 text-white animate-pulse'}`}
              >
                {countdown}
              </div>
              {/* Info da ronda */}
              <div className="order-2 text-base sm:text-xl md:text-2xl font-bold text-yellow-200 mb-2">
                Ronda: {round} de {maxRounds}
              </div>
              {/* Mensagem especial só na última ronda */}
              {isLastRoundCountdown && (
                <div className="order-3 fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="relative flex flex-col items-center p-4">
                    <div className="absolute inset-0 bg-black/80 rounded-xl animate-pulse"></div>
                    <div className="relative z-10 px-4 sm:px-8 md:px-12 py-4 sm:py-6 md:py-8 rounded-xl border-4 sm:border-8 border-pink-400 shadow-2xl bg-gradient-to-r from-yellow-400 via-pink-500 to-red-500 animate-bounce flex flex-col items-center">
                      <span className="text-3xl sm:text-5xl md:text-7xl font-extrabold text-white drop-shadow-lg mb-2 sm:mb-4 flex items-center gap-2 sm:gap-4">
                        <span role='img' aria-label='trophy'>🏆</span>
                        ÚLTIMA RONDA!
                        <span role='img' aria-label='trophy'>🏆</span>
                      </span>
                      <span className="text-sm sm:text-xl md:text-2xl text-yellow-100 font-bold mt-1 sm:mt-2 text-center">Dê o seu melhor, esta é a última chance!</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pódio final */}
        {podium && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 p-2 sm:p-4">
            <div className="bg-yellow-300 text-blue-900 rounded-xl shadow-2xl p-4 sm:p-6 md:p-10 flex flex-col items-center animate-pulse border-4 border-white w-full max-w-xs sm:max-w-md md:max-w-lg">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold mb-3 sm:mb-6">🏆 Pódio Final 🏆</h2>
              <ol className="text-base sm:text-xl md:text-2xl font-bold space-y-1 sm:space-y-2 mb-2 sm:mb-4">
                {podium.slice(0, 3).map((player, idx) => (
                  <li key={player.id} className={idx === 0 ? 'text-xl sm:text-2xl md:text-4xl text-yellow-600' : idx === 1 ? 'text-lg sm:text-xl md:text-3xl text-gray-700' : 'text-base sm:text-lg md:text-2xl text-orange-700'}>
                    {idx === 0 && '🥇 '}
                    {idx === 1 && '🥈 '}
                    {idx === 2 && '🥉 '}
                    {player.name} — {player.score} pts
                  </li>
                ))}
              </ol>
              <div className="text-sm sm:text-base md:text-lg mt-1 sm:mt-2 mb-2 sm:mb-4">Parabéns a todos!</div>
              {isCurrentUserHost && (
                <div className="flex flex-col items-center gap-1 sm:gap-2 mt-2 sm:mt-4">
                  <label className="text-blue-900 font-bold text-sm sm:text-base">Número de rondas:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newRounds}
                    onChange={e => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 1 && value <= 10) {
                        setNewRounds(value);
                      } else if (e.target.value === '') {
                        setNewRounds(1); // Valor padrão quando campo está vazio
                      }
                    }}
                    onBlur={e => {
                      // Garantir valor válido quando sai do campo
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 1 || value > 10) {
                        setNewRounds(3); // Valor padrão
                      }
                    }}
                    className="p-1 sm:p-2 rounded text-blue-900 w-16 sm:w-24 text-center text-sm sm:text-base"
                  />
                  <button
                    className="bg-green-600 text-white px-4 py-1 sm:px-6 sm:py-2 rounded-lg font-bold mt-1 sm:mt-2 hover:bg-green-700 transition text-sm sm:text-base"
                    onClick={() => {
                      // Validar antes de enviar
                      const rounds = newRounds && newRounds >= 1 && newRounds <= 10 ? newRounds : 3;
                      socketService.getSocket().emit('restart-game', { roomCode, rounds });
                      setPodium(null);
                    }}
                  >
                    Iniciar nova partida
                  </button>
                </div>
              )}
              {!isCurrentUserHost && (
                <div className="text-blue-900 font-bold mt-2 sm:mt-4 text-sm sm:text-base">Aguardando o host iniciar uma nova partida...</div>
              )}
              <button
                className="bg-red-600 text-white px-4 py-1 sm:px-6 sm:py-2 rounded-lg font-bold mt-3 sm:mt-6 hover:bg-red-700 transition text-sm sm:text-base"
                onClick={handleLeaveRoom}
              >
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Sala; 