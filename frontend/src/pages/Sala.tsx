import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import QRCode from 'react-qr-code';
import DrawingCanvas from './DrawingCanvas';

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  online?: boolean;
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
  const isMobile = window.innerWidth < 640;
  const [isTouchDrawing, setIsTouchDrawing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [lastJoined, setLastJoined] = useState<string | null>(null);
  const [lastLeft, setLastLeft] = useState<string | null>(null);
  const [showWebViewWarning, setShowWebViewWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [drawerLeft, setDrawerLeft] = useState<string | null>(null);
  const [hostLeft, setHostLeft] = useState<string | null>(null);
  const [removedByTimeout, setRemovedByTimeout] = useState(false);
  const [pendingPoints, setPendingPoints] = useState<any[]>([]);
  const pendingPointsRef = useRef<any[]>([]);

  // Ref para garantir valor atualizado de drawing
  const drawingRef = useRef(false);

  let canvasWidth, canvasHeight;
  if (window.innerWidth < 640) { // Mobile
    canvasWidth = window.innerWidth;
    // Altura máxima: 70% da altura do ecrã, mas nunca maior que a largura * 0.66
    const maxCanvasHeight = Math.floor(window.innerHeight * 0.7);
    const idealHeight = Math.floor(canvasWidth * 0.66);
    canvasHeight = Math.min(idealHeight, maxCanvasHeight);
  } else if (window.innerWidth < 1024) { // Tablet
    canvasWidth = Math.floor(window.innerWidth * 0.8);
    canvasHeight = Math.floor(canvasWidth * 0.66);
  } else { // Desktop
    canvasWidth = 500;
    canvasHeight = 350;
  }

  useEffect(() => {
    const socket = socketService.getSocket();
    const user = socketService.getUser();

    if (!user || !roomCode) {
      // Usuário não está logado ou não tem código de sala
      navigate('/');
      return;
    }

    // Pedir estado completo da sala ao entrar/reconectar
    socket.emit('request-room-state', { roomCode });

    // Receber estado completo da sala
    socket.on('room-state', (state) => {
      setPlayers(state.players || []);
      setDrawerId(state.drawerId || null);
      setRound(state.round || 1);
      setMaxRounds(state.maxRounds || 1);
      setIsGameStarted(state.status === 'playing');
      setWord(state.word || null);
      setLines(state.lines || []);
      setTimer(state.timer || 0);
      if (state.podium) setPodium(state.podium);
      else setPodium(null);
    });

    // Ouvir eventos do socket
    socket.on('player-joined', ({ players, playerName }) => {
      setPlayers(players);
      setLastJoined(playerName);
      setTimeout(() => setLastJoined(null), 3000);
      // Garantir sincronização total:
      socket.emit('request-room-state', { roomCode });
    });

    socket.on('player-left', ({ players, playerName }) => {
      setPlayers(players);
      setLastLeft(playerName);
      setTimeout(() => setLastLeft(null), 3000);
      // Pedir estado completo da sala para garantir sincronização
      socket.emit('request-room-state', { roomCode });
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
    const handleDrawLine = (data: any) => {
      if (isDrawer) return; // O desenhista já desenhou localmente
      console.log('RECEBIDO DRAW-LINE DO BACKEND:', data);
      if (data.point) {
        setLines(prev => {
          if (
            prev.length === 0 ||
            !prev[prev.length - 1] ||
            !Array.isArray(prev[prev.length - 1].points)
          ) {
            console.log('BUFFERIZADO PONTO (sem linha):', data.point);
            return prev;
          }
          const newLines = [...prev];
          newLines[newLines.length - 1].points.push(data.point);
          console.log('ADICIONADO PONTO RECEBIDO À LINHA:', data.point, newLines);
          return newLines;
        });
      } else if (data.line) {
        setLines(prev => {
          const newLines = [...prev, data.line];
          if (pendingPointsRef.current.length > 0) {
            newLines[newLines.length - 1].points.push(...pendingPointsRef.current);
            pendingPointsRef.current = [];
          }
          return newLines;
        });
      }
    };
    socket.on('draw-line', handleDrawLine);

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

    socket.on('round-ended', ({ reason }) => {
      if (reason === 'timeout') {
        setRoundEnded(true);
        setTimeout(() => setRoundEnded(false), 4000); // Esconde a mensagem após 4 segundos
      }
    });

    socket.on('countdown', ({ value, round: countdownRound, maxRounds: countdownMaxRounds }) => {
      setCountdown(value > 0 ? value : null);
      setIsLastRoundCountdown(countdownRound === countdownMaxRounds && value > 0 && value <= 3);
    });

    socket.on('game-ended', ({ players }) => {
      setPlayers(players || []);
      // Ordenar por pontuação decrescente
      const sorted = [...(players || [])].sort((a, b) => b.score - a.score);
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

    socket.on('player-offline', ({ players }) => {
      setPlayers(players);
    });

    socket.on('drawer-left', ({ drawerName }) => {
      setDrawerLeft(drawerName);
      setTimeout(() => setDrawerLeft(null), 4000);
    });

    socket.on('host-left', ({ newHostName }) => {
      setHostLeft(newHostName);
      setTimeout(() => setHostLeft(null), 4000);
    });

    socket.on('removed-by-timeout', () => {
      setRemovedByTimeout(true);
      setTimeout(() => setRemovedByTimeout(false), 8000);
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
      socket.off('room-state');
      socket.off('player-offline');
      socket.off('drawer-left');
      socket.off('host-left');
      socket.off('removed-by-timeout');
    };
  }, [roomCode, navigate]);

  // Sincronizar newRounds com maxRounds sempre que maxRounds mudar
  useEffect(() => {
    setNewRounds(maxRounds);
  }, [maxRounds]);

  const handleLeaveRoom = () => {
    setPlayers([]);
    setLines([]);
    setGuesses([]);
    setPodium(null);
    setWord(null);
    setDrawerId(null);
    setIsGameStarted(false);
    setRound(1);
    setTimer(0);
    setWinnerName(null);
    setGuessedCorrectly(false);
    setCountdown(null);
    setLastJoined(null);
    setLastLeft(null);
    setDrawerLeft(null);
    setHostLeft(null);
    setRemovedByTimeout(false);
    setIsTouchDrawing(false);
    setDrawing(false);
    setError('');
    socketService.disconnect();
    localStorage.removeItem('playerId');
    navigate('/');
  };

  const handleStartGame = () => {
    socketService.getSocket().emit('start-game', { roomCode });
  };

  // Funções de desenho
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawer || isTouchDrawing) return;
    setDrawing(true);
    drawingRef.current = true;
    const rect = canvasRef.current!.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / rect.width;
    const yNorm = (e.clientY - rect.top) / rect.height;
    setLines(prev => [...prev, { points: [{ x: xNorm, y: yNorm }] }]); // Atualiza localmente
    const socket = socketService.getSocket();
    socket.emit('draw-line', { roomCode, point: { x: xNorm, y: yNorm } });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawer || !drawingRef.current || isTouchDrawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const xNorm = (e.clientX - rect.left) / rect.width;
    const yNorm = (e.clientY - rect.top) / rect.height;
    setLines(prev => {
      if (prev.length === 0) return prev;
      const newLines = [...prev];
      if (!newLines[newLines.length - 1].points) newLines[newLines.length - 1].points = [];
      newLines[newLines.length - 1].points.push({ x: xNorm, y: yNorm });
      return newLines;
    });
    const socket = socketService.getSocket();
    socket.emit('draw-line', { roomCode, point: { x: xNorm, y: yNorm } });
  };

  const handleMouseUp = () => {
    if (!isDrawer || isTouchDrawing) return;
    setDrawing(false);
    drawingRef.current = false;
    const socket = socketService.getSocket();
    // O estado 'lines' será atualizado apenas ao receber do servidor para espectadores
  };

  // Funções de toque para desenhar no mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    setIsTouchDrawing(true);
    e.preventDefault();
    e.stopPropagation();
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const touch = e.touches[0];
    const xNorm = (touch.clientX - rect.left) / rect.width;
    const yNorm = (touch.clientY - rect.top) / rect.height;
    setLines(prev => [...prev, { points: [{ x: xNorm, y: yNorm }] }]);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawer || !drawing) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current!.getBoundingClientRect();
    const touch = e.touches[0];
    const xNorm = (touch.clientX - rect.left) / rect.width;
    const yNorm = (touch.clientY - rect.top) / rect.height;
    setLines(prev => {
      if (prev.length === 0) return prev;
      const newLines = [...prev];
      if (!newLines[newLines.length - 1].points) newLines[newLines.length - 1].points = [];
      newLines[newLines.length - 1].points.push({ x: xNorm, y: yNorm });
      return newLines;
    });
  };

  const handleTouchEnd = () => {
    if (!isDrawer) return;
    setDrawing(false);
    setIsTouchDrawing(false);
    const socket = socketService.getSocket();
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      socket.emit('draw-line', { roomCode, line: lastLine });
    }
  };

  const handleMouseLeave = () => {
    if (!isDrawer) return;
    setDrawing(false);
    setIsTouchDrawing(false); // Garante que o rato volta a funcionar
  };

  // Desenhar no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Ajustar para alta resolução
      const dpr = window.devicePixelRatio || 1;
      // Guardar tamanhos lógicos
      const logicalWidth = canvasWidth;
      const logicalHeight = canvasHeight;
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      canvas.style.width = logicalWidth + 'px';
      canvas.style.height = logicalHeight + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, logicalWidth, logicalHeight);
      ctx.strokeStyle = '#222';
      // Largura do traço maior no mobile
      ctx.lineWidth = window.innerWidth < 640 ? 6 : 3;
      ctx.lineCap = 'round';
      lines.forEach(line => {
        if (!line.points || !Array.isArray(line.points)) return;
        ctx.beginPath();
        line.points.forEach((pt: any, i: number) => {
          if (typeof pt.x !== 'number' || typeof pt.y !== 'number') return;
          const x = pt.x * logicalWidth;
          const y = pt.y * logicalHeight;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    } catch (err) {
      console.error('Erro ao desenhar no canvas:', err);
    }
  }, [lines, isDrawer, canvasWidth, canvasHeight, isTouchDrawing]);

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

  useEffect(() => {
    function handleResize() {
      setIsPortrait(window.innerHeight > window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Função para detetar se está em WebView/app
  function isInWebView() {
    const ua = navigator.userAgent || navigator.vendor || (typeof window !== 'undefined' && (window as any).opera) || '';
    return (
      /(FBAN|FBAV|Instagram|Line|Twitter|WebView|wv)/i.test(ua) ||
      (typeof navigator !== 'undefined' && 'standalone' in navigator && (navigator as any).standalone === false)
    );
  }
  useEffect(() => {
    if (isInWebView()) setShowWebViewWarning(true);
  }, []);

  // Redirecionar se não houver nome guardado
  React.useEffect(() => {
    const nomeGuardado = localStorage.getItem('nomeJogador');
    if (!nomeGuardado && roomCode) {
      navigate(`/entrar-sala?codigo=${roomCode}`);
    }
  }, [roomCode, navigate]);

  useEffect(() => {
    const socket = socketService.getSocket();
    const handleDisconnect = () => {
      setIsReconnecting(true);
    };
    const handleConnect = () => {
      setIsReconnecting(false);
    };
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
    };
  }, []);

  // Diagnóstico: logar sempre que isDrawer muda
  useEffect(() => {
    console.log('isDrawer mudou:', isDrawer);
  }, [isDrawer]);

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

  if (removedByTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400">
        <div className="bg-red-500 text-white p-4 rounded-lg mb-4 text-xl font-bold">Foste removido da sala por inatividade. Por favor, entra novamente.</div>
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-900 to-blue-400 text-white p-0" style={{overflow: 'hidden'}}>
      {isReconnecting && (
        <div className="fixed top-0 left-0 w-full bg-yellow-400 text-blue-900 text-center py-2 z-50 font-bold animate-pulse">
          Ligação perdida. A tentar reconectar...
        </div>
      )}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-1 mb-2">
          <span className="bg-blue-800 text-white px-4 py-2 rounded-lg font-semibold shadow text-center text-sm flex items-center gap-1">
            <span role="img" aria-label="jogadores">👥</span> {players.length}
          </span>
          <div className="flex flex-row gap-2 justify-center">
            <button
              className="bg-green-400 text-white px-3 py-2 rounded font-bold shadow hover:bg-green-500 transition text-sm flex items-center gap-1"
              onClick={() => {
                const url = `https://desenharapido.netlify.app/entrar-sala?codigo=${roomCode}`;
                const texto = `Junta-te à minha sala! Clica aqui para entrar: ${url}`;
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(texto)}`;
                window.open(whatsappUrl, '_blank');
              }}
              title="Partilhar no WhatsApp"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.52 3.48A12.07 12.07 0 0 0 12 0C5.37 0 0 5.37 0 12a11.93 11.93 0 0 0 1.64 6L0 24l6.26-1.64A12.07 12.07 0 0 0 12 24c6.63 0 12-5.37 12-12a11.93 11.93 0 0 0-3.48-8.52zM12 22a9.93 9.93 0 0 1-5.13-1.41l-.37-.22-3.72.98.99-3.62-.24-.37A9.93 9.93 0 1 1 12 22zm5.47-7.14c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.5-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.05 1.02-1.05 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.37.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35z"/>
              </svg>
            </button>
            {isCurrentUserHost && !isGameStarted && (
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition text-sm font-bold shadow flex items-center gap-1"
              >
                <span role="img" aria-label="play">▶️</span> Iniciar Jogo
              </button>
            )}
            <button
              onClick={handleLeaveRoom}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition text-sm font-bold shadow flex items-center gap-1"
            >
              <span role="img" aria-label="sair">🚪</span> Sair da Sala
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold w-full break-words text-center mt-1">Sala: {roomCode}</h1>
        </div>
        {(copied || linkCopied) && (
          <div className="mb-2 text-green-300 text-sm font-bold text-center">
            {copied && 'Código copiado!'}
            {linkCopied && 'Link copiado!'}
          </div>
        )}

        {/* Lista de jogadores */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-3">Jogadores ({players.length})</h2>
          <ul className="space-y-2 max-h-40 overflow-y-auto sm:max-h-64 w-full">
            {players.map(player => (
              <li 
                key={player.id} 
                className={`flex items-center gap-2 p-2 bg-white/10 rounded ${drawerId === player.id ? 'border-2 border-yellow-300' : ''}`}
              >
                <span className="flex-1 flex items-center gap-2">
                  {player.name}
                  {player.online === false && (
                    <span title="Offline" className="ml-1 text-xs text-red-400 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="red" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="5"/></svg>
                      offline
                    </span>
                  )}
                </span>
                <span className="text-yellow-300">{player.score} pts</span>
                {player.isHost && (
                  <span className="bg-yellow-300 text-blue-900 text-xs px-2 py-1 rounded">HOST</span>
                )}
                {drawerId === player.id && (
                  <span className="bg-green-300 text-blue-900 text-xs px-2 py-1 rounded ml-2">DESENHISTA</span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-sm text-yellow-200">Ronda: {round}</div>
        </div>

        {/* Lobby (temporário - futuramente será o canvas de desenho) */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          {isGameStarted ? (
            isDrawer ? (
              <>
                <p className="text-xl mb-2 text-green-300 font-bold">Você é o desenhista!</p>
                <p className="text-2xl mb-4">Palavra: <span className="font-mono bg-yellow-200 text-blue-900 px-2 py-1 rounded">{word}</span></p>
                <DrawingCanvas
                  lines={lines}
                  isDrawer={isDrawer}
                  onDraw={(point) => {
                    if (isDrawer) {
                      console.log('EMITINDO DRAW-LINE PARA O BACKEND:', point);
                      setLines(prev => {
                        if (!prev.length || !drawing) {
                          const novaLinha = { points: [point] };
                          console.log('NOVA LINHA LOCAL:', novaLinha);
                          return [...prev, novaLinha];
                        } else {
                          const newLines = [...prev];
                          newLines[newLines.length - 1].points.push(point);
                          console.log('ADICIONANDO PONTO À LINHA LOCAL:', point, newLines);
                          return newLines;
                        }
                      });
                      const socket = socketService.getSocket();
                      socket.emit('draw-line', { roomCode, point });
                    }
                  }}
                  onStartLine={() => setDrawing(true)}
                  onEndLine={() => setDrawing(false)}
                />
                <button
                  onClick={handleClearCanvas}
                  className="bg-red-500 text-white px-4 py-2 rounded mb-2 hover:bg-red-600 transition"
                >
                  Apagar desenho
                </button>
                <p className="text-sm opacity-70">Desenhe algo relacionado à palavra!</p>
              </>
            ) : (
              <>
                <p className="text-xl mb-4 text-blue-200 font-bold">Aguardando o desenhista começar a desenhar...</p>
                <DrawingCanvas
                  lines={lines}
                  isDrawer={isDrawer}
                  onDraw={(point) => {
                    if (isDrawer) {
                      console.log('EMITINDO DRAW-LINE PARA O BACKEND:', point);
                      setLines(prev => {
                        if (!prev.length || !drawing) {
                          const novaLinha = { points: [point] };
                          console.log('NOVA LINHA LOCAL:', novaLinha);
                          return [...prev, novaLinha];
                        } else {
                          const newLines = [...prev];
                          newLines[newLines.length - 1].points.push(point);
                          console.log('ADICIONANDO PONTO À LINHA LOCAL:', point, newLines);
                          return newLines;
                        }
                      });
                      const socket = socketService.getSocket();
                      socket.emit('draw-line', { roomCode, point });
                    }
                  }}
                  onStartLine={() => setDrawing(true)}
                  onEndLine={() => setDrawing(false)}
                />
                <p className="text-sm opacity-70">O desenho aparecerá aqui em tempo real!</p>
                {/* Campo de palpite */}
                <form onSubmit={handleGuessSubmit} className="flex flex-col sm:flex-row gap-4 mt-4 w-full justify-center">
                  <input
                    type="text"
                    className="w-full p-3 rounded text-blue-900 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    placeholder={guessedCorrectly ? "Você já acertou!" : "Digite seu palpite..."}
                    value={guess}
                    onChange={e => setGuess(e.target.value)}
                    disabled={guessedCorrectly}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="w-full sm:w-auto py-3 px-4 text-lg font-semibold rounded shadow transition mb-2 sm:mb-0 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-300 text-blue-900 hover:bg-yellow-400"
                    disabled={guessedCorrectly}
                  >
                    Enviar
                  </button>
                </form>
                {/* Feed de palpites */}
                <div className="mt-4 max-h-40 overflow-y-auto bg-white/20 rounded p-2 text-left">
                  {guesses.map((g, i) => (
                    <div key={i} className={g.correct ? "text-green-300 font-bold" : "text-white"}>
                      <span className="font-semibold">{g.name}:</span> {g.text}
                      {g.correct && <span className="ml-2 bg-green-300 text-blue-900 px-2 py-1 rounded text-xs">ACERTOU!</span>}
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            <>
              <p className="text-xl mb-4">Aguardando início do jogo...</p>
              <p className="text-sm opacity-70">
                Em breve: o canvas de desenho e a lógica de jogo aparecerão aqui!
              </p>
            </>
          )}
        </div>

        {/* Cronómetro da ronda */}
        {isGameStarted && (
          <div className="mb-4 text-2xl font-bold text-yellow-300">Tempo restante: {timer}s</div>
        )}

        {winnerName && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-green-500 text-white text-4xl font-extrabold px-12 py-8 rounded-xl shadow-2xl border-4 border-white animate-pulse">
              {winnerName} acertou a palavra!
            </div>
          </div>
        )}

        {/* Mensagem de fim de ronda */}
        {roundEnded && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-red-500 text-white text-3xl font-extrabold px-10 py-6 rounded-xl shadow-2xl border-4 border-white animate-pulse">
              Tempo esgotado! A ronda terminou.
            </div>
          </div>
        )}

        {/* Countdown antes da ronda */}
        {countdown !== null && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="flex flex-col items-center">
              {/* Número do countdown sempre em destaque no topo */}
              <div className={`order-1 font-extrabold rounded-xl shadow-2xl border-4 border-white mb-2
                  flex items-center justify-center
                text-3xl px-4 py-4 w-full max-w-xs mx-auto
                sm:text-7xl sm:px-16 sm:py-10 sm:max-w-none
                ${round === maxRounds ? 'bg-gradient-to-r from-pink-500 via-yellow-400 to-red-500 text-white animate-bounce' : 'bg-blue-800 text-white animate-pulse'}`}
                  style={{ minHeight: '4rem' }}
              >
                {countdown}
              </div>
              {/* Info da ronda */}
              <div className="order-2 text-2xl font-bold text-yellow-200 mb-2">
                Ronda: {round} de {maxRounds}
              </div>
              {/* Mensagem especial só na última ronda e só durante o countdown, super perceptível */}
              {isLastRoundCountdown && (
                <div className="order-3 fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                  <div className="relative flex flex-col items-center w-full max-w-xs sm:max-w-lg mx-auto">
                    <div className="absolute inset-0 bg-black/80 rounded-xl animate-pulse"></div>
                    <div className="relative z-10 px-4 py-4 sm:px-12 sm:py-8 rounded-xl border-8 border-pink-400 shadow-2xl bg-gradient-to-r from-yellow-400 via-pink-500 to-red-500 animate-bounce flex flex-col items-center w-full max-w-xs sm:max-w-lg mx-auto">
                      <span className="text-2xl sm:text-7xl font-extrabold text-white drop-shadow-lg mb-4 flex items-center gap-4">
                        <span role='img' aria-label='trophy'>🏆</span>
                        ÚLTIMA RONDA!
                        <span role='img' aria-label='trophy'>🏆</span>
                      </span>
                      <span className="text-base sm:text-2xl text-yellow-100 font-bold mt-2 text-center">Dê o seu melhor, esta é a última chance!</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pódio final */}
        {podium && (
            <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-black/90" style={{pointerEvents: 'auto'}}>
            <div className="bg-yellow-300 text-blue-900 rounded-xl shadow-2xl p-10 flex flex-col items-center animate-pulse border-4 border-white">
              <h2 className="text-4xl font-extrabold mb-6">🏆 Pódio Final 🏆</h2>
              <ol className="text-2xl font-bold space-y-2 mb-4">
                {podium.slice(0, 3).map((player, idx) => (
                  <li key={player.id} className={idx === 0 ? 'text-4xl text-yellow-600' : idx === 1 ? 'text-3xl text-gray-700' : 'text-2xl text-orange-700'}>
                    {idx === 0 && '🥇 '}
                    {idx === 1 && '🥈 '}
                    {idx === 2 && '🥉 '}
                    {player.name} — {player.score} pts
                  </li>
                ))}
              </ol>
              <div className="text-lg mt-2 mb-4">Parabéns a todos!</div>
              {isCurrentUserHost && (
                <div className="flex flex-col items-center gap-2 mt-4">
                  <span className="text-blue-900 font-semibold mb-1">Selecione o número de rondas para a próxima partida:</span>
                  <label className="text-blue-900 font-bold">Número de rondas:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newRounds}
                    onChange={e => setNewRounds(Number(e.target.value))}
                    className="p-2 rounded text-blue-900 w-24 text-center"
                  />
                  <button
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold mt-2 hover:bg-green-700 transition"
                    onClick={() => {
                      socketService.getSocket().emit('restart-game', { roomCode, rounds: newRounds });
                      setPodium(null);
                    }}
                  >
                    Iniciar nova partida
                  </button>
                </div>
              )}
              {!isCurrentUserHost && (
                <div className="text-blue-900 font-bold mt-4">Aguardando o host iniciar uma nova partida...</div>
              )}
              <button
                className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold mt-6 hover:bg-red-700 transition"
                onClick={handleLeaveRoom}
              >
                Sair
              </button>
            </div>
          </div>
        )}

          {lastJoined && (
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded shadow-lg z-[9999] font-bold text-lg animate-bounce">
              {lastJoined} entrou na sala!
            </div>
          )}

          {lastLeft && (
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded shadow-lg z-[9999] font-bold text-lg animate-bounce">
              {lastLeft} saiu da sala!
            </div>
          )}

          {drawerLeft && (
            <div className="fixed top-36 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-blue-900 px-6 py-3 rounded shadow-lg z-[9999] font-bold text-lg animate-bounce">
              O desenhista <b>{drawerLeft}</b> saiu da sala! O tempo continua a contar.
            </div>
          )}

          {hostLeft && (
            <div className="fixed top-52 left-1/2 transform -translate-x-1/2 bg-yellow-300 text-blue-900 px-6 py-3 rounded shadow-lg z-[9999] font-bold text-lg animate-bounce">
              O host saiu! <b>{hostLeft}</b> é agora o novo host.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sala; 