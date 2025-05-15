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
  const socket = socketService.getSocket();
  const isCurrentUserHost = players.find(p => p.id === socket.id)?.isHost;
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
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  // Ref para debouncing do envio de pontos
  const lastSentRef = useRef<number>(0);
  const pointQueueRef = useRef<{x: number, y: number}[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [points, setPoints] = useState<Array<{x: number, y: number, color?: string, width?: number}>>([]);
  const [receivedPoints, setReceivedPoints] = useState<any[]>([]);

  // Ref para garantir valor atualizado de drawing
  const drawingRef = useRef(false);
  const clearingRef = useRef<number>(0);
  const lineStartingRef = useRef(false);

  // Detectar tipo de dispositivo para ajustes de UI
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

  const lastPointsByClientRef = useRef<{[key: string]: {x: number, y: number} | null}>({});
  const lastPointTimerRef = useRef<number | null>(null);

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

    // Efeito para processar o estado inicial da sala quando ele é recebido
    const handleRoomState = (state: any) => {
      setPlayers(state.players || []);
      setDrawerId(state.drawerId || null);
      setRound(state.round || 1);
      setMaxRounds(state.maxRounds || 1);
      setIsGameStarted(state.status === 'playing');
      setWord(state.word || null);
      
      // Sincronizar linhas e pontos apenas se não for o desenhista atual
      // porque o desenhista já está desenhando localmente
      if (state.drawerId !== socket.id) {
        setLines(state.lines || []);
        
        // Limpar e recriar os pontos recebidos
        setReceivedPoints([]);
        // Se existem pontos no estado da sala, processá-los depois de um breve delay
        // para garantir que o canvas está pronto
        if (state.points && state.points.length > 0) {
          setTimeout(() => {
            setReceivedPoints(state.points);
          }, 100);
        }
      }
      
      setTimer(state.timer || 0);
      
      if (state.podium) setPodium(state.podium);
      else setPodium(null);
      
      console.log('Estado da sala sincronizado:', 
        `jogadores=${state.players?.length || 0}`, 
        `desenhista=${state.drawerId?.substring(0, 5) || 'nenhum'}`,
        `rodada=${state.round}/${state.maxRounds}`,
        `linhas=${state.lines?.length || 0}`
      );
    };

    // Receber estado completo da sala
    socket.on('room-state', handleRoomState);

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
      
      // Limpar o canvas quando começa uma nova rodada
      setReceivedPoints([]);
      setLines([]);
      setPoints([]);
      
      // Enviar um evento de limpeza para garantir que todos limpem o canvas
      if (isDrawer) {
        socket.emit('clear-canvas', { roomCode });
        
        // Enviar também um ponto especial que indica limpeza do canvas
        socket.emit('draw-point', { 
          roomCode, 
          x: 0, 
          y: 0,
          isClearCanvas: true,
          color: strokeColor,
          size: strokeWidth,
          timestamp: Date.now()
        });
      }
    });

    // Receber linhas desenhadas de outros jogadores
    const handleDrawLine = (data: any) => {
      if (isDrawer) return; // O desenhista já desenhou localmente
      console.log('RECEBIDO DRAW-LINE DO BACKEND:', data);
      
      if (data.line) {
        // Caso de uma linha completa - comportamento principal e preferido
        console.log('RECEBIDA LINHA COMPLETA:', data.line);
        setLines(prev => {
          const newLines = [...prev, data.line];
          // Adicionamos os pontos pendentes, se existirem
          if (pendingPointsRef.current.length > 0) {
            console.log('Adicionando pontos pendentes à linha recebida:', pendingPointsRef.current.length);
            if (!newLines[newLines.length - 1].points) newLines[newLines.length - 1].points = [];
            newLines[newLines.length - 1].points.push(...pendingPointsRef.current);
            pendingPointsRef.current = [];
          }
          return newLines;
        });
      } else if (data.point) {
        // Caso de um ponto individual
        setLines(prev => {
          if (prev.length === 0) {
            // Se não temos linhas, criamos uma nova com este ponto
            console.log('CRIANDO NOVA LINHA PARA PONTO RECEBIDO:', data.point);
            return [...prev, { 
              points: [data.point],
              color: data.color || '#222',
              width: data.width || 3
            }];
          } else {
            // Caso contrário, adicionamos o ponto à última linha
            const newLines = [...prev];
            if (!newLines[newLines.length - 1].points) newLines[newLines.length - 1].points = [];
            
            // Verificar se precisamos interpolar pontos intermediários
            const lastLineIndex = newLines.length - 1;
            const lastPoints = newLines[lastLineIndex].points;
            
            if (lastPoints.length > 0) {
              const lastPoint = lastPoints[lastPoints.length - 1];
              const newPoint = data.point;
              
              // Se a distância é significativa, adicionar pontos intermediários para melhor fluidez
              const dx = newPoint.x - lastPoint.x;
              const dy = newPoint.y - lastPoint.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > 0.03) { // Se os pontos estão distantes, interpolar
                const steps = Math.ceil(distance / 0.01); // Determinar número de passos
                for (let i = 1; i < steps; i++) {
                  const ratio = i / steps;
                  const interpolatedPoint = {
                    x: lastPoint.x + dx * ratio,
                    y: lastPoint.y + dy * ratio
                  };
                  newLines[lastLineIndex].points.push(interpolatedPoint);
                }
              }
            }
            
            newLines[newLines.length - 1].points.push(data.point);
            console.log('ADICIONADO PONTO RECEBIDO À LINHA:', data.point);
            return newLines;
          }
        });
      }
    };
    socket.on('draw-line', handleDrawLine);

    socket.on('guess', ({ name, text, correct }) => {
      setGuesses(prev => [...prev, { name, text, correct }]);
      if (correct) {
        setWinnerName(name);
        
        // Se estamos na última rodada e alguém acertou, terminar o jogo após mostrar o vencedor
        console.log(`Acerto na rodada ${round} de ${maxRounds}`);
        if (round >= maxRounds) {
          console.log('Última rodada com acerto! Preparando para encerrar o jogo...');
          
          // Aguardar alguns segundos para mostrar quem acertou antes de exibir o pódio
          setTimeout(() => {
            console.log('Encerrando o jogo e mostrando o pódio');
            // Calcular o pódio localmente
            const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
            
            // Primeiro esconder a mensagem de quem acertou
            setWinnerName(null);
            
            // Então mostrar o pódio
            setPodium(sortedPlayers);
            
            // Ainda assim, notificar o servidor sobre o fim do jogo
            // para garantir a sincronização entre todos os jogadores
            socketService.getSocket().emit('end-game', { roomCode });
          }, 3000);
        }
      }
      if (correct && name === socketService.getUser()?.name) {
        setGuessedCorrectly(true);
      }
    });

    // Simular recebimento de jogadores iniciais
    // (Em uma implementação completa, isso viria do evento de entrada na sala)
    // Para simplificar, estamos apenas adicionando o próprio usuário
    
    socket.on('clear-canvas', () => {
      console.log('Sala: Recebido evento clear-canvas, limpando desenho');
      
      // Flag para evitar loops infinitos
      const alreadyClearing = clearingRef.current > 0;
      if (alreadyClearing) return;
      
      clearingRef.current = Date.now();
      
      // Limpar arrays locais
      setLines([]);
      setReceivedPoints([]);
      
      // Resetar flag após um pequeno delay
      setTimeout(() => {
        clearingRef.current = 0;
      }, 100);
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

    // Receber pontos desenhados de outros jogadores
    socket.on('draw-point', (data) => {
      console.log('SALA recebendo draw-point:', data);
      
      // Apenas espectadores devem processar os pontos recebidos
      if (isDrawer) return;
      
      // Adicionar o ponto ao array de pontos recebidos
      setReceivedPoints(prev => {
        // Limitar o número de pontos armazenados para evitar problemas de performance
        const maxPoints = 1000;
        const newPoints = [...prev, data];
        if (newPoints.length > maxPoints) {
          // Se exceder o limite, manter apenas os mais recentes
          return newPoints.slice(newPoints.length - maxPoints);
        }
        return newPoints;
      });
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
      socket.off('draw-point');
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
    // Verificar se o usuário atual é o host antes de iniciar o jogo
    if (isCurrentUserHost) {
      socketService.getSocket().emit('start-game', { roomCode });
    } else {
      console.log('Apenas o host pode iniciar o jogo');
    }
  };

  // Função para o início de uma nova linha (mantida para compatibilidade)
  const handleStartLine = () => {
    if (!isDrawer) return;
    console.log('Sala: Iniciando nova linha de desenho');
    setDrawing(true);
    drawingRef.current = true;
    
    // Marcar o próximo ponto como início de linha
    lineStartingRef.current = true;
  };

  // Função simplificada para desenhar ponto
  const handleDrawPoint = (point: { x: number; y: number; pressure?: number }) => {
    if (!isDrawer) return;
    
    // Enviar o ponto para o servidor
    console.log('Enviando ponto do desenhista:', point);
    socketService.getSocket().emit('draw-point', { 
      roomCode, 
      x: point.x, 
      y: point.y,
      pressure: point.pressure || 0.5,
      color: strokeColor, 
      size: strokeWidth,
      isStartOfLine: lineStartingRef.current,
      timestamp: Date.now()
    });
    
    // Resetar flag de início de linha após o primeiro ponto
    if (lineStartingRef.current) {
      lineStartingRef.current = false;
    }
  };

  // Função para o fim de uma linha (mantida para compatibilidade)
  const handleEndLine = () => {
    if (!isDrawer) return;
    setDrawing(false);
    drawingRef.current = false;
  };

  // Função para limpar o canvas
  const handleClearCanvas = () => {
    if (!isDrawer) return;
    
    // Evitar chamadas duplicadas usando timestamp
    const now = Date.now();
    if (clearingRef.current && now - clearingRef.current < 300) {
      console.log('Ignorando solicitação de limpeza duplicada');
      return;
    }
    
    clearingRef.current = now;
    console.log('Sala: Limpando canvas e enviando evento clear-canvas');
    
    // Limpar arrays locais
    setPoints([]);
    setReceivedPoints([]);
    setLines([]);
    
    // Enviar evento para o servidor
    socketService.getSocket().emit('clear-canvas', { roomCode });
    
    // Enviar também um ponto especial que indica limpeza do canvas para garantir que os espectadores limpem
    socketService.getSocket().emit('draw-point', { 
      roomCode, 
      x: 0, 
      y: 0,
      isClearCanvas: true, // Propriedade especial que indica que o canvas deve ser limpo
      color: strokeColor, 
      size: strokeWidth,
      timestamp: Date.now()
    });
    
    // Resetar flag após um delay maior
    setTimeout(() => {
      clearingRef.current = 0;
    }, 300);
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

  // Função para renderizar a área do jogo em diferentes layouts
  const renderGameArea = () => {
    // Mostrar pódio quando o jogo acabou
    if (podium) {
      return (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          <h2 className="text-2xl font-bold text-yellow-300 mb-4">🏆 Fim do Jogo 🏆</h2>
          
          <div className="bg-blue-900/50 rounded-lg p-4 mb-4">
            <h3 className="text-xl font-bold mb-3 text-white">Pontuações Finais</h3>
            
            <div className="grid gap-3">
              {podium.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`flex items-center p-3 rounded-lg ${
                    index === 0 ? 'bg-yellow-500/50 text-white' : 
                    index === 1 ? 'bg-gray-400/50 text-white' : 
                    index === 2 ? 'bg-amber-700/50 text-white' : 
                    'bg-white/10'
                  }`}
                >
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-bold text-xl">{index + 1}º</span>
                    <span className="truncate">{player.name}</span>
                    {player.isHost && (
                      <span className="bg-yellow-300 text-blue-900 text-xs px-1 py-0.5 rounded ml-1">HOST</span>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-yellow-300">{player.score} pts</span>
                </div>
              ))}
            </div>
          </div>
          
          {isCurrentUserHost && (
            <button
              onClick={() => {
                socketService.getSocket().emit('restart-game', { roomCode, rounds: newRounds });
              }}
              className="bg-green-500 text-white px-6 py-3 mt-2 rounded-lg hover:bg-green-600 transition text-lg font-bold shadow flex items-center justify-center gap-2 mx-auto"
            >
              <span role="img" aria-label="recomeçar">🔄</span> Reiniciar Jogo
            </button>
          )}
          
          {!isCurrentUserHost && (
            <p className="text-sm text-center mt-4 italic">
              Aguardando o host iniciar um novo jogo...
            </p>
          )}
        </div>
      );
    }
    
    if (!isGameStarted) {
      return (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          <p className="text-xl mb-4">Aguardando início do jogo...</p>
          {isCurrentUserHost && (
            <div className="mt-4">
              <div className="mb-4">
                <label className="block text-white mb-2">Número de rondas:</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10} 
                  value={newRounds} 
                  onChange={e => setNewRounds(Number(e.target.value))}
                  className="w-24 p-2 rounded text-blue-900 text-center mx-auto"
                />
              </div>
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition text-lg font-bold shadow flex items-center justify-center gap-2 mx-auto"
              >
                <span role="img" aria-label="play">▶️</span> Iniciar Jogo
              </button>
            </div>
          )}
          <p className="text-sm opacity-70 mt-4">
            O jogo vai começar em breve! Fique atento!
          </p>
        </div>
      );
    }

    if (isDrawer) {
      return (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
            <p className="text-xl text-green-300 font-bold">Você é o desenhista!</p>
            <p className="text-xl mt-1 md:mt-0">
              <span className="mr-2">Palavra:</span>
              <span className="font-mono bg-yellow-200 text-blue-900 px-2 py-1 rounded">{word}</span>
            </p>
          </div>
          
          <div className={deviceType === 'mobile' ? 'mt-2' : 'mt-4'}>
            <DrawingCanvas
              onDraw={handleDrawPoint}
              isDrawer={isDrawer}
              onStartLine={handleStartLine}
              onEndLine={handleEndLine}
              onClear={handleClearCanvas}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              onColorChange={setStrokeColor}
              onWidthChange={setStrokeWidth}
              receivedPoints={receivedPoints}
            />
          </div>
          
          <p className="text-sm opacity-70 mt-2">Desenhe algo relacionado à palavra!</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
        <p className="text-xl mb-2 text-blue-200 font-bold">
          {deviceType === 'mobile' ? 'Adivinhe o desenho!' : 'Aguardando o desenhista desenhar...'}
        </p>
        
        <div className={deviceType === 'mobile' ? 'mt-2' : 'mt-4'}>
          <DrawingCanvas
            onDraw={handleDrawPoint}
            isDrawer={isDrawer}
            onStartLine={handleStartLine}
            onEndLine={handleEndLine}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            receivedPoints={receivedPoints}
          />
        </div>
        
        <p className="text-sm mt-2 text-yellow-200">Tente adivinhar o que está sendo desenhado!</p>
        
        {/* Campo de palpite */}
        <form onSubmit={handleGuessSubmit} className="flex flex-col sm:flex-row gap-2 mt-3 w-full justify-center">
          <input
            type="text"
            className="w-full p-3 rounded text-blue-900 text-base focus:outline-none focus:ring-2 focus:ring-yellow-400"
            placeholder={guessedCorrectly ? "Você já acertou!" : "Digite seu palpite..."}
            value={guess}
            onChange={e => setGuess(e.target.value)}
            disabled={guessedCorrectly}
            autoComplete="off"
          />
          <button
            type="submit"
            className={`py-3 px-4 font-semibold rounded shadow transition focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-300 text-blue-900 hover:bg-yellow-400 ${deviceType === 'mobile' ? 'w-full' : 'w-auto sm:whitespace-nowrap'}`}
            disabled={guessedCorrectly}
          >
            Enviar palpite
          </button>
        </form>
        
        {/* Feed de palpites */}
        <div className="mt-3 max-h-32 sm:max-h-40 overflow-y-auto bg-white/20 rounded p-2 text-left">
          {guesses.length === 0 ? (
            <p className="text-center text-white/60 italic">Nenhum palpite ainda...</p>
          ) : (
            guesses.map((g, i) => (
              <div key={i} className={g.correct ? "text-green-300 font-bold" : "text-white"}>
                <span className="font-semibold">{g.name}:</span> {g.text}
                {g.correct && <span className="ml-2 bg-green-300 text-blue-900 px-2 py-1 rounded text-xs">ACERTOU!</span>}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderPlayersList = () => {
    return (
      <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 ${deviceType === 'mobile' ? 'mb-3' : 'mb-6'}`}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">Jogadores ({players.filter(p => p.online !== false).length}/{players.length})</h2>
          <div className="flex items-center gap-1">
            <span className="text-sm text-yellow-200">Ronda: {round}/{maxRounds}</span>
            {timer > 0 && (
              <span className="ml-2 bg-yellow-300 text-blue-900 px-2 py-1 rounded-lg text-sm font-bold">
                {timer}s
              </span>
            )}
          </div>
        </div>
        
        <ul className={`space-y-1 overflow-y-auto w-full ${deviceType === 'mobile' ? 'max-h-28' : 'max-h-40 sm:max-h-64'}`}>
          {players
            .sort((a, b) => {
              // Ordenar: primeiro os online, depois por pontuação, depois por nome
              if ((a.online === false) !== (b.online === false)) {
                return a.online === false ? 1 : -1; // Online primeiro
              }
              if (b.score !== a.score) {
                return b.score - a.score; // Maior pontuação primeiro
              }
              return a.name.localeCompare(b.name); // Ordem alfabética
            })
            .map(player => (
              <li 
                key={player.id} 
                className={`flex items-center gap-2 p-2 rounded 
                  ${drawerId === player.id ? 'border-2 border-yellow-300' : ''}
                  ${player.online === false ? 'bg-white/5 opacity-50' : 'bg-white/10'}
                `}
              >
                <span className="flex-1 flex items-center gap-1 truncate">
                  {drawerId === player.id && (
                    <span className="text-yellow-300 mr-1">✏️</span>
                  )}
                  {player.name}
                  {player.online === false && (
                    <span title="Offline" className="ml-1 text-xs text-red-400 flex items-center gap-1 font-bold">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="red" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="5"/></svg>
                      {deviceType !== 'mobile' && 'offline'}
                    </span>
                  )}
                </span>
                <span className="text-yellow-300 whitespace-nowrap">{player.score} pts</span>
                {player.isHost && (
                  <span className="bg-yellow-300 text-blue-900 text-xs px-1 py-0.5 rounded">HOST</span>
                )}
              </li>
            ))}
        </ul>
      </div>
    );
  };

  const renderHeaderControls = () => {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 ${deviceType === 'mobile' ? 'mb-2' : 'mb-4'}`}>
        <div className={`flex ${deviceType === 'mobile' ? 'flex-col gap-1' : 'flex-row gap-3'} justify-center w-full`}>
          <div className="flex gap-2 justify-center">
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
              <span>{deviceType === 'mobile' ? 'Convidar' : 'Convidar amigos'}</span>
            </button>
          </div>
          <button
            onClick={handleLeaveRoom}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition text-sm font-bold shadow flex items-center gap-1"
          >
            <span role="img" aria-label="sair">🚪</span> {deviceType === 'mobile' ? 'Sair' : 'Sair da Sala'}
          </button>
        </div>
        
        <div className="flex flex-col items-center">
          <span className="bg-blue-800 text-white px-3 py-1 rounded-lg font-medium shadow text-sm flex items-center gap-1">
            <span role="img" aria-label="jogadores">👥</span> {players.length} {deviceType !== 'mobile' && 'jogadores'}
          </span>
          <h1 className={`font-bold text-center mt-1 break-all ${deviceType === 'mobile' ? 'text-lg' : 'text-xl sm:text-2xl'}`}>
            <span className="opacity-80">Sala:</span> {roomCode}
          </h1>
        </div>
        
        {(copied || linkCopied) && (
          <div className="text-green-300 text-sm font-bold text-center">
            {copied && 'Código copiado!'}
            {linkCopied && 'Link copiado!'}
          </div>
        )}
      </div>
    );
  };

  // Removido acidentalmente
  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim() || guessedCorrectly) return;
    socketService.getSocket().emit('guess', { roomCode, text: guess });
    setGuess('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-400">
        <div className="text-white text-xl animate-pulse">Carregando sala...</div>
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
      
      <div className={`flex-1 flex items-center justify-center w-full p-2 ${deviceType === 'mobile' ? 'py-1' : 'p-4'}`}>
        <div className={`w-full max-w-4xl flex flex-col items-center justify-center ${deviceType === 'mobile' ? 'space-y-2' : 'space-y-4'}`}>
          {/* Cabeçalho com controles */}
          {renderHeaderControls()}
          
          {/* Layout principal */}
          <div className={`w-full grid ${deviceType === 'desktop' ? 'grid-cols-[1fr_2fr]' : 'grid-cols-1'} gap-4`}>
            {/* Lista de jogadores */}
            {deviceType === 'desktop' ? (
              <div>
                {renderPlayersList()}
              </div>
            ) : renderPlayersList()}
            
            {/* Área de jogo */}
            {renderGameArea()}
          </div>
          
          {/* Área de notificações */}
          {isGameStarted && deviceType !== 'mobile' && timer > 0 && (
            <div className="mb-4 text-2xl font-bold text-yellow-300">Tempo restante: {timer}s</div>
          )}
        </div>
      </div>
      
      {/* Componentes de overlay (modais, notificações) */}
      {winnerName && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`bg-green-500 text-white font-extrabold px-12 py-8 rounded-xl shadow-2xl border-4 border-white animate-pulse ${deviceType === 'mobile' ? 'text-2xl' : 'text-4xl'}`}>
            {winnerName} acertou a palavra!
          </div>
        </div>
      )}

      {/* Countdown entre rodadas com efeito visual atraente */}
      {countdown !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`flex flex-col items-center justify-center gap-4`}>
            <div className={`relative rounded-full flex items-center justify-center ${isLastRoundCountdown ? 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500' : 'bg-yellow-300'} text-blue-900 font-extrabold ${deviceType === 'mobile' ? 'w-36 h-36 text-6xl' : 'w-48 h-48 text-7xl'} ${countdown === 1 ? 'animate-bounce' : 'animate-pulse'}`}>
              <div className="absolute inset-0 rounded-full opacity-20 animate-ping bg-white"></div>
              <div className="absolute inset-0 rounded-full animate-spin-slow border-4 border-dashed border-white opacity-70"></div>
              {countdown}
            </div>
            
            <div className={`text-white font-bold text-center ${deviceType === 'mobile' ? 'text-xl' : 'text-2xl'} transform ${isLastRoundCountdown ? 'scale-110' : ''} transition-transform`}>
              {isLastRoundCountdown ? (
                <span className="animate-pulse text-yellow-300">🔥 ÚLTIMA RODADA 🔥</span>
              ) : (
                <span>Preparar para a rodada {round}/{maxRounds}</span>
              )}
            </div>
            
            {isLastRoundCountdown && (
              <div className="flex gap-2 mt-2">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`text-2xl animate-bounce`} style={{ animationDelay: `${i * 0.1}s` }}>🏆</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {roundEnded && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`bg-red-500 text-white font-extrabold px-12 py-8 rounded-xl shadow-2xl border-4 border-white animate-pulse ${deviceType === 'mobile' ? 'text-2xl' : 'text-4xl'}`}>
            Tempo esgotado!
          </div>
        </div>
      )}
    </div>
  );
}

export default Sala; 