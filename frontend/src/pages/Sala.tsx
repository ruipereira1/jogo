import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import Canvas, { DrawingLine, DrawingData } from '../components/Canvas';
import GameStats from '../components/GameStats';
import AchievementSystem from '../components/AchievementSystem';
import DrawingTools, { DrawingTool } from '../components/DrawingTools';

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

interface WordHistoryEntry {
  round: number;
  word: string;
  drawer: string;
  guessedBy: string[];
}

interface GameState {
  phase: 'waiting' | 'countdown' | 'drawing' | 'guessing' | 'revealing' | 'round-end' | 'game-end';
  timeLeft?: number;
  message?: string;
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
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [guess, setGuess] = useState('');
  const [guesses, setGuesses] = useState<{ name: string; text: string; correct: boolean; timestamp: number }[]>([]);
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
  
  // Estados melhorados para a nova interface
  const [hints, setHints] = useState<{ hint: string; type: string; timestamp: number }[]>([]);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ name: string; message: string; timestamp: number }[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [wordHistory, setWordHistory] = useState<WordHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [gameState, setGameState] = useState<GameState>({ phase: 'waiting' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Estados para ferramentas de desenho avançadas
  const [currentTool, setCurrentTool] = useState<DrawingTool>({
    type: 'pen',
    color: '#000000',
    size: 3,
    opacity: 1
  });
  const [undoStack, setUndoStack] = useState<DrawingLine[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingLine[][]>([]);
  
  // Estados para conquistas e estatísticas avançadas
  const [playerStats, setPlayerStats] = useState({
    totalGames: 0,
    totalCorrectGuesses: 0,
    totalDrawnWords: 0,
    fastestGuessTime: 0,
    longestStreak: 0,
    totalScore: 0,
    averageScore: 0,
    wordsGuessedInOrder: 0,
    perfectGames: 0,
    artisticGames: 0
  });
  const [currentStreak, setCurrentStreak] = useState(0);
  const [showAchievements, setShowAchievements] = useState(false);
  const [activeTab, setActiveTab] = useState<'game' | 'stats' | 'achievements'>('game');
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [roundTransitionData, setRoundTransitionData] = useState<{
    type: 'start' | 'end';
    round: number;
    maxRounds: number;
    word?: string;
    drawer?: string;
    nextDrawer?: string;
  } | null>(null);

  // Refs para armazenar timeouts e intervalos para limpeza
  const timeoutRefs = useRef<number[]>([]);

  // Função auxiliar para adicionar timeout com limpeza automática
  const addTimeout = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      callback();
      timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId);
    }, delay);
    timeoutRefs.current.push(timeoutId);
    return timeoutId;
  };

  // Função para limpar todos os timeouts
  const clearAllTimeouts = () => {
    timeoutRefs.current.forEach(id => window.clearTimeout(id));
    timeoutRefs.current = [];
  };

  // Função para calcular o tamanho do canvas com base no container
  const updateCanvasSize = () => {
    if (canvasContainerRef.current) {
      const containerWidth = canvasContainerRef.current.clientWidth;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      let newWidth, newHeight;
      
      if (isFullscreen) {
        newWidth = Math.min(containerWidth - 20, screenWidth * 0.9);
        newHeight = Math.floor(Math.min(newWidth * 0.6, screenHeight * 0.6));
      } else {
        if (screenWidth < 480) {
          newWidth = Math.min(320, containerWidth - 10);
        } else if (screenWidth < 768) {
          newWidth = Math.min(450, containerWidth - 15);
        } else {
          newWidth = Math.min(600, containerWidth - 20);
        }
        newHeight = Math.floor(newWidth * 0.7);
      }
      
      setCanvasSize({ width: newWidth, height: newHeight });
    }
  };

  // Sons para feedback
  const playSound = (type: 'correct' | 'wrong' | 'hint' | 'timer' | 'round-start' | 'round-end') => {
    if (!soundEnabled) return;
    
    // Criar um tom simples usando Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    let frequency = 440;
    let duration = 0.2;
    
    switch (type) {
      case 'correct':
        frequency = 800;
        duration = 0.5;
        break;
      case 'wrong':
        frequency = 200;
        duration = 0.3;
        break;
      case 'hint':
        frequency = 600;
        duration = 0.2;
        break;
      case 'timer':
        frequency = 300;
        duration = 0.1;
        break;
      case 'round-start':
        frequency = 1000;
        duration = 0.3;
        break;
      case 'round-end':
        frequency = 500;
        duration = 0.8;
        break;
    }
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  };

  // Função para mostrar transição de round
  const showRoundTransitionAnimation = (data: typeof roundTransitionData) => {
    setRoundTransitionData(data);
    setShowRoundTransition(true);
    
    addTimeout(() => {
      setShowRoundTransition(false);
      setRoundTransitionData(null);
    }, 3000);
  };

  // Atualizar o tamanho do canvas quando a janela for redimensionada
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Atualizar canvas quando o modo fullscreen mudar
  useEffect(() => {
    updateCanvasSize();
  }, [isFullscreen]);

  useEffect(() => {
    const socket = socketService.getSocket();
    const user = socketService.getUser();

    if (!user || !roomCode) {
      navigate('/');
      return;
    }

    // Ouvir eventos do socket
    socket.on('player-joined', ({ players }) => {
      setPlayers(players);
    });

    socket.on('player-left', ({ players }) => {
      setPlayers(players);
    });

    socket.on('room-joined', ({ room, players }) => {
      setPlayers(players);
      setRound(room.round || 1);
      setMaxRounds(room.maxRounds || 3);
      setIsLoading(false);
      setGameState({ phase: room.status === 'playing' ? 'drawing' : 'waiting' });
    });

    socket.on('players-update', ({ players: updatedPlayers, drawerId: newDrawerId, round: currentRound, maxRounds: totalRounds }) => {
      setPlayers(updatedPlayers);
      setDrawerId(newDrawerId);
      setRound(currentRound);
      setMaxRounds(totalRounds);
      setIsDrawer(newDrawerId === user.id);
    });

    socket.on('game-started', () => {
      setIsGameStarted(true);
      setGameState({ phase: 'countdown' });
      playSound('round-start');
    });

    socket.on('round-start', ({ isDrawer: userIsDrawer, word: gameWord }) => {
      setIsDrawer(userIsDrawer);
      setWord(userIsDrawer ? gameWord : null);
      setGuesses([]);
      setGuessedCorrectly(false);
      setWinnerName(null);
      setRevealedWord(null);
      setHints([]);
      setGameState({ phase: 'drawing' });
      
      // Mostrar transição de início de round
      const drawer = players.find(p => p.id === drawerId);
      showRoundTransitionAnimation({
        type: 'start',
        round,
        maxRounds,
        drawer: drawer?.name
      });
      
      playSound('round-start');
    });

    socket.on('guess', ({ name, text, correct }) => {
      const newGuess = { name, text, correct, timestamp: Date.now() };
      setGuesses(prev => [...prev, newGuess]);
      
      if (correct) {
        setWinnerName(name);
        setGameState({ phase: 'revealing' });
        playSound('correct');
        
        if (name === user?.name) {
          setGuessedCorrectly(true);
          setCurrentStreak(prev => prev + 1);
          setPlayerStats(prev => ({
            ...prev,
            totalCorrectGuesses: prev.totalCorrectGuesses + 1,
            longestStreak: Math.max(prev.longestStreak, currentStreak + 1)
          }));
        }
      } else {
        if (name === user?.name) {
          setCurrentStreak(0);
          playSound('wrong');
        }
      }
    });

    socket.on('clear-canvas', () => {
      setLines([]);
      setUndoStack([]);
      setRedoStack([]);
    });

    socket.on('timer-update', ({ timeLeft }) => {
      setTimer(timeLeft);
      
      // Sons de alerta nos últimos segundos
      if (timeLeft <= 5 && timeLeft > 0) {
        playSound('timer');
      }
      
      setGameState(prev => ({ ...prev, timeLeft }));
    });

    socket.on('round-ended', ({ reason, message }) => {
      setGameState({ phase: 'round-end', message });
      
      if (reason === 'timeout') {
        setRoundEnded(true);
        addTimeout(() => setRoundEnded(false), 4000);
      } else if (reason === 'drawer-left') {
        setToastMessage(message || 'O desenhista saiu da sala. Avançando para próxima ronda...');
        setShowToast(true);
        addTimeout(() => setShowToast(false), 4000);
      }
      
      playSound('round-end');
    });

    socket.on('countdown', ({ value, round: countdownRound, maxRounds: countdownMaxRounds }) => {
      setCountdown(value > 0 ? value : null);
      setIsLastRoundCountdown(countdownRound === countdownMaxRounds && value > 0 && value <= 3);
      setGameState({ phase: value > 0 ? 'countdown' : 'drawing' });
    });

    socket.on('game-ended', ({ players }) => {
      const sorted = [...players].sort((a, b) => b.score - a.score);
      setPodium(sorted);
      setGameState({ phase: 'game-end' });
      
      const currentUser = socketService.getUser();
      const userPlayer = players.find((p: Player) => p.name === currentUser?.name);
      
      if (userPlayer) {
        setPlayerStats(prev => ({
          ...prev,
          totalGames: prev.totalGames + 1,
          totalScore: prev.totalScore + userPlayer.score,
          averageScore: (prev.totalScore + userPlayer.score) / (prev.totalGames + 1),
          perfectGames: prev.perfectGames + (currentStreak === round ? 1 : 0)
        }));
      }
      
      setCurrentStreak(0);
    });

    socket.on('game-restarted', () => {
      setPodium(null);
      setRoundEnded(false);
      setCountdown(null);
      setTimer(0);
      setWinnerName(null);
      setGuesses([]);
      setIsGameStarted(false);
      setGameState({ phase: 'waiting' });
    });
    
    socket.on('room-deleted', () => {
      navigate('/');
    });
    
    socket.on('room-not-found', () => {
      setError('Sala não encontrada ou foi excluída');
      setTimeout(() => {
        navigate('/');
      }, 3000);
    });
    
    // Listeners melhorados para dicas
    socket.on('hint', ({ hint, type }) => {
      const newHint = { hint, type, timestamp: Date.now() };
      setHints(prev => [...prev, newHint]);
      setToastMessage(`💡 ${hint}`);
      setShowToast(true);
      playSound('hint');
      addTimeout(() => setShowToast(false), 4000);
    });

    socket.on('word-reveal', ({ word }) => {
      setRevealedWord(word);
      setToastMessage(`A palavra era: ${word}`);
      setShowToast(true);
      
      // Mostrar transição de fim de round
      showRoundTransitionAnimation({
        type: 'end',
        round,
        maxRounds,
        word
      });
      
      addTimeout(() => {
        setShowToast(false);
        setRevealedWord(null);
      }, 5000);
    });

    // Listeners para desenho
    socket.on('draw-line', ({ line }) => {
      setLines(prev => [...prev, line]);
    });

    // Entrar na sala
    socketService.joinRoom(user.name, roomCode)
      .then(response => {
        if (response.success) {
          console.log('Entrou na sala com sucesso');
        } else {
          console.error('Erro ao entrar na sala:', response.error);
          navigate('/', { state: { error: response.error } });
        }
      })
      .catch(error => {
        console.error('Erro ao entrar na sala:', error);
        navigate('/', { state: { error: 'Erro de conexão' } });
      });

    return () => {
      socket.off('player-joined');
      socket.off('player-left');
      socket.off('room-joined');
      socket.off('players-update');
      socket.off('game-started');
      socket.off('round-start');
      socket.off('guess');
      socket.off('clear-canvas');
      socket.off('timer-update');
      socket.off('round-ended');
      socket.off('countdown');
      socket.off('game-ended');
      socket.off('game-restarted');
      socket.off('room-deleted');
      socket.off('room-not-found');
      socket.off('hint');
      socket.off('word-reveal');
      socket.off('draw-line');
      clearAllTimeouts();
    };
  }, [roomCode, navigate, currentStreak, round, players, drawerId, maxRounds, user]);

  const handleLeaveRoom = () => {
    socketService.leaveRoom();
    socketService.disconnect();
    navigate('/');
  };

  const handleStartGame = () => {
    socketService.getSocket().emit('start-game', { roomCode });
  };

  // Funções para ferramentas de desenho
  const handleToolChange = (tool: DrawingTool) => {
    setCurrentTool(tool);
  };

  const handleUndo = () => {
    if (lines.length > 0) {
      const newUndoStack = [...undoStack, lines];
      const newLines = lines.slice(0, -1);
      setUndoStack(newUndoStack);
      setLines(newLines);
      setRedoStack([]);
      
      // Enviar comando de desfazer para outros jogadores
      socketService.getSocket().emit('undo', { roomCode });
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const lastUndoState = redoStack[redoStack.length - 1];
      setLines(lastUndoState);
      setRedoStack(prev => prev.slice(0, -1));
      
      // Enviar comando de refazer para outros jogadores
      socketService.getSocket().emit('redo', { roomCode });
    }
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
    const line: DrawingLine = {
      points: [normalizedPoint],
      tool: { type: 'pen', color: '#000000', size: 3, opacity: 1 },
      timestamp: Date.now()
    };
    setLines(prev => [...prev, line]);
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
    const line: DrawingLine = {
      points: [normalizedPoint],
      tool: { type: 'pen', color: '#000000', size: 3, opacity: 1 },
      timestamp: Date.now()
    };
    setLines(prev => [...prev, line]);
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
      line.points.forEach((pt: { x: number; y: number }, i: number) => {
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

  // Função para lidar com dados de desenho do novo Canvas
  const handleCanvasDraw = (data: DrawingData) => {
    if (data.type === 'draw' && data.line && roomCode) {
      const newUndoStack = [...undoStack, lines];
      setUndoStack(newUndoStack);
      setRedoStack([]);
      
      const line = data.line;
      setLines(prev => [...prev, line]);
      socketService.getSocket().emit('draw-line', { roomCode, line });
    } else if (data.type === 'clear') {
      setUndoStack([]);
      setRedoStack([]);
      handleClearCanvas();
    }
  };

  // Função para conquistas desbloqueadas
  const handleAchievementUnlocked = (achievement: any) => {
    setToastMessage(`🏆 Conquista desbloqueada: ${achievement.title}!`);
    setShowToast(true);
    addTimeout(() => setShowToast(false), 4000);
  };

  // Função para compartilhar sala via WhatsApp
  const handleShareWhatsApp = async () => {
    try {
      // Criar URL para a página de entrada direta com o código da sala
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/entrar-sala/${roomCode}`;
      
      // Primeiro, copiar o link para a área de transferência
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = shareUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } catch (clipboardError) {
        if (import.meta.env.DEV) {
          console.warn('Não foi possível copiar automaticamente:', clipboardError);
        }
      }
      
      const shareText = `🎨 Venha jogar ArteRápida comigo! 

✨ ENTRADA AUTOMÁTICA:
${shareUrl}

📋 Ou use o código: ${roomCode}

🎯 Como jogar:
1. Clique no link acima (entrada automática)
2. Ou cole o código no jogo
3. Divirta-se desenhando e adivinhando!`;
      
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
      
      const newWindow = window.open(whatsappUrl, '_blank');
      
      // Verificar se a janela foi aberta com sucesso
      if (newWindow) {
        setToastMessage('🔗 Link copiado e WhatsApp aberto!');
      } else {
        setToastMessage('🔗 Link copiado! Não foi possível abrir o WhatsApp automaticamente.');
      }
      
      setShowToast(true);
      addTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao compartilhar no WhatsApp:', error);
      }
      // Fallback: copiar para clipboard
      handleCopyRoomCode();
    }
  };

  // Função para abrir modal de compartilhamento
  const handleOpenShareModal = async () => {
    // Copiar automaticamente o link da sala para a área de transferência
    const shareUrl = `${window.location.origin}/entrar-sala/${roomCode}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback para navegadores mais antigos
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setToastMessage('🔗 Link da sala copiado automaticamente!');
      setShowToast(true);
      addTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Erro ao copiar link:', error);
      }
      setToastMessage('❌ Não foi possível copiar automaticamente');
      setShowToast(true);
      addTimeout(() => setShowToast(false), 3000);
    }
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
    addTimeout(() => setShowToast(false), 3000);
  };

  // Novas funções para as melhorias
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    socketService.getSocket().emit('chat-message', { roomCode, message: chatMessage });
    setChatMessage('');
  };

  const handleGetWordHistory = () => {
    socketService.getSocket().emit('get-word-history', { roomCode }, (response: { success: boolean; history?: WordHistoryEntry[]; error?: string }) => {
      if (response.success && response.history) {
        setWordHistory(response.history);
        setShowHistory(true);
      }
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-400 text-white p-1 sm:p-2 overflow-x-hidden">
      {/* Indicador de conexão */}
      {connectionStatus !== 'connected' && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-1 z-50 text-xs">
          {connectionStatus === 'reconnecting' ? '🔄 Reconectando...' : '❌ Sem conexão'}
        </div>
      )}
      
      {/* Indicador de modo landscape */}
      {isFullscreen && (
        <div className="fixed bottom-4 right-4 bg-green-600/90 text-white px-3 py-2 rounded-lg shadow-lg z-40 text-xs backdrop-blur-sm border border-green-400/50">
          📱 Modo Paisagem Ativo
        </div>
      )}
      
      {/* Transições de Round */}
      {showRoundTransition && roundTransitionData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-md w-full text-gray-800 shadow-2xl transform animate-pulse">
            {roundTransitionData.type === 'start' ? (
              <>
                <div className="text-6xl mb-4">🎨</div>
                <h2 className="text-2xl font-bold mb-2 text-blue-600">
                  Ronda {roundTransitionData.round} de {roundTransitionData.maxRounds}
                </h2>
                <p className="text-lg text-gray-600 mb-4">
                  {roundTransitionData.drawer ? `${roundTransitionData.drawer} vai desenhar!` : 'Preparando...'}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(roundTransitionData.round / roundTransitionData.maxRounds) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500">Boa sorte! 🍀</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">✨</div>
                <h2 className="text-2xl font-bold mb-2 text-purple-600">Fim da Ronda!</h2>
                {roundTransitionData.word && (
                  <div className="bg-purple-100 rounded-lg p-4 mb-4">
                    <p className="text-sm text-purple-600 mb-1">A palavra era:</p>
                    <p className="text-2xl font-bold text-purple-800">{roundTransitionData.word}</p>
                  </div>
                )}
                <p className="text-lg text-gray-600">Preparando próxima ronda...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast de notificação melhorado */}
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-2 rounded-lg shadow-lg border border-white/20 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <span className="font-medium">{toastMessage}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de chat */}
      {showChat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-xl shadow-2xl p-3 max-w-sm w-full max-h-80 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-blue-900 text-base font-bold">💬 Chat</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-500 hover:text-gray-700 text-lg">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-100 rounded p-2 mb-2 text-xs text-gray-800">
              {chatMessages.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Sem mensagens ainda...</p>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className="mb-1">
                    <span className="font-semibold text-blue-900">{msg.name}</span>
                    <span className="text-gray-500 text-[10px] ml-1">{formatTime(msg.timestamp)}</span>
                    <div className="text-gray-800">{msg.message}</div>
                  </div>
                ))
              )}
            </div>
            
            <form onSubmit={handleChatSubmit} className="flex gap-1">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 p-2 border rounded text-gray-800 text-xs"
                autoComplete="off"
              />
              <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs">
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Modal de histórico */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-xl shadow-2xl p-3 max-w-sm w-full max-h-80 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-blue-900 text-base font-bold">📚 Histórico</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-gray-700 text-lg">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto text-gray-800 text-xs">
              {wordHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma palavra ainda...</p>
              ) : (
                wordHistory.map((item, i) => (
                  <div key={i} className="mb-2 p-2 bg-gray-100 rounded">
                    <div className="font-semibold">Ronda {item.round}</div>
                    <div className="text-blue-900 font-bold">{item.word}</div>
                    <div className="text-gray-600 text-[10px]">Desenhista: {item.drawer}</div>
                    {item.guessedBy.length > 0 && (
                      <div className="text-green-600 text-[10px]">Acertaram: {item.guessedBy.join(', ')}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de compartilhamento */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-xl shadow-2xl p-3 max-w-sm w-full relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={handleCloseShareModal}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-lg"
            >
              ✕
            </button>
            
            <h3 className="text-blue-900 text-base font-bold mb-2 text-center">🔗 Compartilhar Sala</h3>
            
            <div className="bg-green-50 p-2 rounded-lg mb-3 border border-green-200">
              <p className="text-green-700 text-xs text-center font-medium">
                ✅ <strong>Link já copiado!</strong> Pode colar diretamente no WhatsApp ou onde quiser.
              </p>
            </div>
            
            <div className="bg-blue-50 p-2 rounded-lg mb-3">
              <p className="text-blue-800 text-xs text-center">
                ✨ <strong>ENTRADA AUTOMÁTICA:</strong> Quem clicar no link entra direto na sala sem precisar digitar código!
              </p>
            </div>
            
            <div className="text-center mb-3">
              <p className="text-gray-600 text-xs">Código da sala:</p>
              <div className="bg-blue-100 text-blue-900 font-mono text-lg font-bold p-2 rounded flex justify-center items-center gap-2 mb-2">
                {roomCode}
                <button 
                  onClick={handleCopyRoomCode}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  📋
                </button>
              </div>
              
              <div className="flex flex-col space-y-2 mb-3">
                <p className="text-gray-600 text-xs">Link direto:</p>
                <div className="flex gap-1">
                  <input 
                    type="text" 
                    value={`${window.location.origin}/entrar-sala/${roomCode}`} 
                    readOnly 
                    className="bg-gray-100 text-gray-800 p-1 rounded text-xs flex-1"
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
                      setToastMessage('Link copiado!');
                      setShowToast(true);
                      addTimeout(() => setShowToast(false), 3000);
                    }}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              <div className="flex justify-center gap-2 mb-3">
                <button
                  onClick={handleShareWhatsApp}
                  className="bg-green-600 text-white px-3 py-2 rounded font-medium hover:bg-green-700 transition flex items-center justify-center gap-1 text-xs"
                >
                  📱 WhatsApp
                </button>
                {navigator.share && (
                  <button
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/entrar-sala/${roomCode}`;
                      
                      // Copiar primeiro para a área de transferência
                      try {
                        if (navigator.clipboard) {
                          await navigator.clipboard.writeText(shareUrl);
                        }
                      } catch (clipboardError) {
                        if (import.meta.env.DEV) {
                          console.warn('Não foi possível copiar automaticamente:', clipboardError);
                        }
                      }
                      
                      // Depois abrir o partilhador nativo
                      navigator.share({
                        title: 'ArteRápida - Jogo de Desenho',
                        text: `🎨 Venha jogar ArteRápida comigo! Clique no link ou cole no campo "Código da sala". Sala: ${roomCode}`,
                        url: shareUrl
                      })
                      .then(() => {
                        setToastMessage('🔗 Link copiado e compartilhado!');
                        setShowToast(true);
                        addTimeout(() => setShowToast(false), 3000);
                      })
                      .catch(err => {
                        if (import.meta.env.DEV) {
                          console.error('Erro ao compartilhar:', err);
                        }
                        setToastMessage('🔗 Link copiado!');
                        setShowToast(true);
                        addTimeout(() => setShowToast(false), 3000);
                      });
                    }}
                    className="bg-blue-600 text-white px-3 py-2 rounded font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1 text-xs"
                  >
                    📤 Mais
                  </button>
                )}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-gray-600 text-xs mb-2">📱 QR Code para partilhar:</p>
                <div className="bg-white p-3 rounded-xl shadow-lg inline-block">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/entrar-sala/${roomCode}`)}`} 
                    alt="QR Code da sala" 
                    className="w-32 h-32 mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center"><p class="text-gray-500 text-xs text-center">QR indisponível</p></div>';
                      }
                    }}
                  />
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  🎯 Escaneie para entrar diretamente na sala
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className={`max-w-4xl mx-auto ${isFullscreen ? 'landscape-layout h-screen' : ''}`}>
        <div className={`flex flex-col gap-1 mb-2 ${isFullscreen ? 'landscape-sidebar p-2' : ''}`}>
          {/* Linha 1: Título e contador de jogadores */}
          <div className="flex justify-between items-center">
            <h1 className="text-base sm:text-lg font-bold">Sala: {roomCode}</h1>
            <span className="bg-blue-800 text-white px-2 py-1 rounded text-xs font-semibold">
              {players.length} jogador{players.length !== 1 ? 'es' : ''}
            </span>
          </div>
          
          {/* Linha 2: Botões de ação - otimizados para móvel */}
          <div className="flex gap-2 flex-wrap justify-center">
            <button
              onClick={() => setShowChat(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all tap-feedback flex items-center gap-2 shadow-lg"
            >
              💬 Chat
              {chatMessages.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold animate-pulse">
                  {chatMessages.length}
                </span>
              )}
            </button>
            
            <button
              onClick={handleGetWordHistory}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all tap-feedback shadow-lg"
            >
              📚 Histórico
            </button>
            
            <div className="flex gap-1">
              <button
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/entrar-sala/${roomCode}`;
                  try {
                    if (navigator.clipboard) {
                      await navigator.clipboard.writeText(shareUrl);
                    } else {
                      const textArea = document.createElement('textarea');
                      textArea.value = shareUrl;
                      document.body.appendChild(textArea);
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                    }
                    setToastMessage('🔗 Link copiado!');
                    setShowToast(true);
                    addTimeout(() => setShowToast(false), 3000);
                  } catch (error) {
                    if (import.meta.env.DEV) {
                      console.error('Erro ao copiar link:', error);
                    }
                    setToastMessage('❌ Erro ao copiar');
                    setShowToast(true);
                    addTimeout(() => setShowToast(false), 3000);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all tap-feedback shadow-lg"
                title="Copiar link rapidamente"
              >
                📋
              </button>
              <button
                onClick={handleOpenShareModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all tap-feedback shadow-lg"
              >
                🔗 Partilhar
              </button>
            </div>
            
            {isCurrentUserHost && !isGameStarted && (
              <button
                onClick={handleStartGame}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all tap-feedback shadow-lg animate-pulse"
              >
                ▶️ INICIAR JOGO
              </button>
            )}
            
            <button 
              onClick={handleLeaveRoom}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-medium transition-all tap-feedback flex items-center gap-2 shadow-lg"
              title="Sair da sala"
              aria-label="Sair da sala"
            >
              🚪 Sair
            </button>
          </div>
        </div>

        {/* Layout responsivo para todos os dispositivos */}
        <div className={`flex flex-col gap-2 ${isFullscreen ? 'landscape-canvas overflow-y-auto' : ''}`}>
          {/* Lista de jogadores - otimizada para móvel */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-base text-white">
                👥 Jogadores ({players.length})
              </h2>
              <div className="bg-blue-800/50 px-3 py-1 rounded-full">
                <span className="text-yellow-300 font-bold text-sm">
                  Ronda: {round || 0}/{maxRounds || 1}
                </span>
              </div>
            </div>
            <div className="mobile-players grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                    drawerId === player.id 
                      ? 'bg-gradient-to-r from-yellow-400/20 to-yellow-300/20 border-2 border-yellow-300 shadow-lg' 
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate text-white font-medium text-sm">
                      {player.name}
                    </span>
                    {player.isHost && (
                      <span className="text-yellow-300 text-base" title="Host">👑</span>
                    )}
                    {drawerId === player.id && (
                      <span className="text-green-300 text-base animate-pulse" title="Desenhando">✏️</span>
                    )}
                  </div>
                  <div className="bg-yellow-300 text-blue-900 px-2 py-1 rounded-lg font-bold text-sm">
                    {player.score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Área principal de jogo */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center">
            {isGameStarted ? (
              isDrawer ? (
                <>
                  <div className="mb-4">
                    {/* Status do desenhista */}
                    <div className="text-center mb-3">
                      <div className="inline-block bg-gradient-to-r from-green-500 to-green-400 text-white px-4 py-2 rounded-2xl shadow-lg">
                        <p className="text-lg font-bold">✏️ Você está desenhando!</p>
                      </div>
                    </div>
                    
                    {/* Palavra em destaque */}
                    <div className="text-center mb-3">
                      <p className="text-white text-sm mb-2">Desenhe esta palavra:</p>
                      <div className="inline-block bg-yellow-300 text-blue-900 px-6 py-3 rounded-2xl shadow-xl border-2 border-yellow-400">
                        <span className="font-mono text-2xl font-extrabold tracking-wider">
                          {word}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    ref={canvasContainerRef} 
                    className={`w-full mb-3 ${isFullscreen ? 'flex justify-center' : ''}`}
                  >
                    <Canvas
                      isDrawer={isDrawer}
                      onDraw={handleCanvasDraw}
                      lines={lines}
                      onClear={handleClearCanvas}
                      className="border-4 border-yellow-300 bg-white rounded-lg shadow-xl"
                    />
                  </div>
                  
                  <div className="flex justify-center gap-3 flex-wrap">
                    <button
                      onClick={handleClearCanvas}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all tap-feedback"
                      aria-label="Limpar desenho do canvas"
                    >
                      🗑️ Apagar Tudo
                    </button>
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-all tap-feedback ${
                        isFullscreen 
                          ? 'bg-yellow-300 text-blue-900 hover:bg-yellow-400' 
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                      title={isFullscreen ? 'Modo Normal' : 'Modo Paisagem'}
                    >
                      {isFullscreen ? '📱 Normal' : '📺 Paisagem'}
                    </button>
                    {isFullscreen && (
                      <div className="text-sm text-yellow-200 flex items-center px-2 py-1 bg-blue-800/50 rounded-lg">
                        💡 Mais espaço para desenhar!
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Status do adivinhador */}
                  <div className="text-center mb-4">
                    <div className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-2xl shadow-lg">
                      <p className="text-lg font-bold">🔍 Adivinhe o desenho!</p>
                    </div>
                    {drawerId && (
                      <p className="text-blue-200 text-sm mt-2">
                        🎨 {players.find(p => p.id === drawerId)?.name} está desenhando
                      </p>
                    )}
                  </div>
                  
                  <div ref={canvasContainerRef} className="w-full mb-3">
                    <Canvas
                      isDrawer={false}
                      onDraw={handleCanvasDraw}
                      lines={lines}
                      onClear={handleClearCanvas}
                      className="border-4 border-yellow-300 bg-white rounded-lg shadow-xl mx-auto"
                    />
                  </div>
                  
                  {/* Campo de palpite otimizado para móvel */}
                  <form onSubmit={handleGuessSubmit} className="flex gap-2 mb-3">
                    <input
                      type="text"
                      className="flex-1 p-3 rounded-xl text-blue-900 text-base font-medium shadow-lg border-2 border-yellow-300 focus:border-yellow-400 focus:outline-none transition-all"
                      placeholder={guessedCorrectly ? "🎉 Você acertou!" : "💭 Digite seu palpite..."}
                      value={guess}
                      onChange={e => setGuess(e.target.value)}
                      disabled={guessedCorrectly}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      style={{ fontSize: '16px' }} // Previne zoom no iOS
                      aria-label="Campo para digitar palpite do desenho"
                      role="textbox"
                    />
                    <button
                      type="submit"
                      className="bg-yellow-300 hover:bg-yellow-400 text-blue-900 px-4 py-3 rounded-xl font-bold text-base shadow-lg transition-all tap-feedback min-w-[60px]"
                      disabled={guessedCorrectly}
                      aria-label="Enviar palpite"
                    >
                      {guessedCorrectly ? '✅' : '➤'}
                    </button>
                  </form>
                  
                  {/* Feed de palpites otimizado para móvel */}
                  <div 
                    className="max-h-32 overflow-y-auto bg-white/20 backdrop-blur-sm rounded-xl p-3 text-left custom-scroll"
                    role="log"
                    aria-live="polite"
                    aria-label="Lista de palpites dos jogadores"
                  >
                    {guesses.length === 0 ? (
                      <div className="text-white/70 text-sm text-center py-2">
                        💬 Nenhum palpite ainda...
                      </div>
                    ) : (
                      guesses.slice(-5).map((g, i) => (
                        <div 
                          key={i} 
                          className={`mb-1 p-2 rounded-lg transition-all ${
                            g.correct 
                              ? "bg-green-500/30 text-green-200 font-bold border border-green-400/50" 
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          <span className="font-semibold text-yellow-300">{g.name}:</span> 
                          <span className="ml-1 text-sm">{g.text}</span>
                          {g.correct && (
                            <span className="ml-2 text-green-300 font-bold" role="img" aria-label="correto">
                              ✅ ACERTOU!
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )
            ) : (
              <>
                <p className="text-sm mb-2">Aguardando início do jogo...</p>
                <div className="flex justify-center items-center gap-2 text-xs">
                  <span>Código da sala: <span className="font-bold text-yellow-300">{roomCode}</span></span>
                  <button
                    onClick={handleOpenShareModal}
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition"
                  >
                    🔗
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Interface de estado do jogo completamente renovada */}
        {isGameStarted && (
          <div className="mt-4 space-y-4">
            {/* Cronômetro moderno com animações e efeitos visuais */}
            <div className="text-center">
              <div className={`inline-block relative px-8 py-4 rounded-3xl shadow-2xl transition-all duration-500 transform ${
                timer <= 5 && timer > 0
                  ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white animate-pulse scale-110 border-4 border-red-300 shadow-red-500/50'
                  : timer <= 10
                  ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 text-white border-3 border-orange-300 shadow-orange-500/40 scale-105'
                  : timer <= 20
                  ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 text-blue-900 border-2 border-yellow-300 shadow-yellow-500/30'
                  : 'bg-gradient-to-r from-green-400 via-green-500 to-blue-500 text-white border-2 border-green-300 shadow-green-500/30'
              }`}>
                {/* Efeito de pulso para tempo crítico */}
                {timer <= 5 && timer > 0 && (
                  <div className="absolute inset-0 rounded-3xl bg-red-500 animate-ping opacity-20"></div>
                )}
                
                <div className="relative flex items-center gap-3">
                  <span className={`text-4xl ${timer <= 10 ? 'animate-bounce' : ''}`}>
                    {timer <= 5 ? '⚠️' : timer <= 10 ? '⏰' : '⏱️'}
                  </span>
                  <div className="text-center">
                    <div className="text-4xl font-black tracking-wider">{timer}s</div>
                    <div className="text-sm font-semibold opacity-90">
                      {timer > 30 ? '🌟 Muito tempo' : 
                       timer > 15 ? '⚡ Tempo moderado' : 
                       timer > 5 ? '🔥 Pouco tempo!' : 
                       '💥 CRÍTICO!'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Barra de progresso animada */}
              <div className="max-w-lg mx-auto mt-3">
                <div className="relative w-full bg-gray-200/30 rounded-full h-3 overflow-hidden shadow-inner">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      timer <= 5 ? 'bg-gradient-to-r from-red-500 to-red-600 animate-pulse' : 
                      timer <= 10 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      timer <= 20 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                      'bg-gradient-to-r from-green-400 to-blue-500'
                    }`}
                    style={{ 
                      width: `${Math.max(0, (timer / 60) * 100)}%`,
                      boxShadow: timer <= 10 ? '0 0 10px rgba(255, 0, 0, 0.5)' : 'none'
                    }}
                  >
                    {/* Efeito de brilho na barra */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                  </div>
                  
                  {/* Marcos de tempo */}
                  <div className="absolute inset-0 flex justify-between items-center px-2">
                    {[0, 15, 30, 45, 60].map(mark => (
                      <div 
                        key={mark}
                        className="w-0.5 h-full bg-white/50"
                        style={{ left: `${(mark / 60) * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between text-xs text-white/70 mt-1">
                  <span>0s</span>
                  <span>15s</span>
                  <span>30s</span>
                  <span>45s</span>
                  <span>60s</span>
                </div>
              </div>
            </div>
            
            {/* Sistema de dicas completamente renovado */}
            {hints.length > 0 && (
              <div className="max-w-3xl mx-auto">
                <div className="bg-gradient-to-br from-indigo-600/90 via-purple-600/80 to-pink-600/70 backdrop-blur-lg rounded-2xl p-5 border border-white/20 shadow-2xl">
                  {/* Cabeçalho das dicas */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl animate-bounce">💡</div>
                      <h3 className="text-white font-bold text-xl">Dicas Disponíveis</h3>
                    </div>
                    <div className="bg-white/20 rounded-full px-3 py-1">
                      <span className="text-white font-semibold text-sm">{hints.length} dica{hints.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  
                  {/* Grid de dicas com animações */}
                  <div className="grid gap-3">
                    {hints.slice(-3).map((hint, index) => (
                      <div 
                        key={index} 
                        className="group bg-white/15 hover:bg-white/25 rounded-xl p-4 border border-white/20 transform hover:scale-105 transition-all duration-300 cursor-pointer"
                        style={{ 
                          animationDelay: `${index * 0.1}s`,
                          animation: 'fadeInUp 0.5s ease-out forwards'
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                              hint.type === 'letters' ? 'bg-blue-500' :
                              hint.type === 'first-letter' ? 'bg-green-500' :
                              'bg-purple-500'
                            }`}>
                              {hint.type === 'letters' ? '📏' : 
                               hint.type === 'first-letter' ? '🅰️' : '🔤'}
                            </div>
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-yellow-300 font-semibold text-sm">
                                Dica {hints.indexOf(hint) + 1}
                              </span>
                              <span className="text-white/60 text-xs">
                                {hint.type === 'letters' ? 'Quantidade de letras' :
                                 hint.type === 'first-letter' ? 'Primeira letra' :
                                 'Letra adicional'}
                              </span>
                            </div>
                            
                            <p className="text-white text-lg font-medium leading-relaxed">
                              {hint.hint}
                            </p>
                            
                            {/* Timestamp da dica */}
                            <div className="text-white/50 text-xs mt-2">
                              {new Date(hint.timestamp).toLocaleTimeString('pt-PT', { 
                                hour: '2-digit', 
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Histórico de dicas */}
                  {hints.length > 3 && (
                    <div className="text-center mt-4 pt-4 border-t border-white/20">
                      <button 
                        onClick={() => setShowHistory(true)}
                        className="text-yellow-300 hover:text-yellow-200 transition-colors font-medium text-sm flex items-center gap-2 mx-auto group"
                      >
                        <span>Ver todas as {hints.length} dicas</span>
                        <span className="group-hover:translate-x-1 transition-transform">→</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Painel de estado do jogo */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {/* Estado da fase */}
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl mb-1">
                      {gameState.phase === 'waiting' ? '⏳' :
                       gameState.phase === 'countdown' ? '⏱️' :
                       gameState.phase === 'drawing' ? '🎨' :
                       gameState.phase === 'revealing' ? '✨' : '🏁'}
                    </div>
                    <p className="text-white font-medium text-sm">
                      {gameState.phase === 'waiting' ? 'Aguardando' :
                       gameState.phase === 'countdown' ? 'Começando' :
                       gameState.phase === 'drawing' ? 'Desenhando' :
                       gameState.phase === 'revealing' ? 'Descoberto' : 'Finalizado'}
                    </p>
                  </div>

                  {/* Progresso da ronda */}
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl mb-1">📊</div>
                    <p className="text-white font-medium text-sm">
                      Ronda {round}/{maxRounds}
                    </p>
                  </div>

                  {/* Número de jogadores */}
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-2xl mb-1">👥</div>
                    <p className="text-white font-medium text-sm">
                      {players.length} jogador{players.length > 1 ? 'es' : ''}
                    </p>
                  </div>

                  {/* Configurações rápidas */}
                  <div className="bg-white/10 rounded-lg p-3">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="text-2xl mb-1 hover:scale-110 transition-transform"
                    >
                      {soundEnabled ? '🔊' : '🔇'}
                    </button>
                    <p className="text-white font-medium text-sm">
                      Som {soundEnabled ? 'ON' : 'OFF'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 p-2">
            <div className="bg-yellow-300 text-blue-900 rounded-xl shadow-2xl p-3 flex flex-col items-center border-4 border-white w-full max-w-sm max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-extrabold mb-2">🏆 Pódio Final 🏆</h2>
              <ol className="text-sm font-bold space-y-1 mb-2">
                {podium.slice(0, 3).map((player, idx) => (
                  <li key={player.id} className={idx === 0 ? 'text-lg text-yellow-600' : idx === 1 ? 'text-base text-gray-700' : 'text-sm text-orange-700'}>
                    {idx === 0 && '🥇 '}
                    {idx === 1 && '🥈 '}
                    {idx === 2 && '🥉 '}
                    {player.name} — {player.score} pts
                  </li>
                ))}
              </ol>
              <div className="text-xs mb-2">Parabéns a todos!</div>
              {isCurrentUserHost && (
                <div className="flex flex-col items-center gap-1 mt-2">
                  <label className="text-blue-900 font-bold text-sm">Número de rondas:</label>
                  {/* Botões para seleção de rondas */}
                  <div className="flex flex-col gap-1">
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map(num => (
                        <button
                          key={num}
                          type="button"
                          className={`p-1 rounded text-xs font-bold transition min-w-6 ${
                            newRounds === num 
                              ? 'bg-yellow-400 text-blue-900 border-2 border-yellow-600' 
                              : 'bg-blue-200 text-blue-900 border-2 border-transparent hover:bg-blue-300'
                          }`}
                          onClick={() => setNewRounds(num)}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1 mb-1">
                      {[6, 7, 8, 9, 10].map(num => (
                        <button
                          key={num}
                          type="button"
                          className={`p-1 rounded text-xs font-bold transition min-w-6 ${
                            newRounds === num 
                              ? 'bg-yellow-400 text-blue-900 border-2 border-yellow-600' 
                              : 'bg-blue-200 text-blue-900 border-2 border-transparent hover:bg-blue-300'
                          }`}
                          onClick={() => setNewRounds(num)}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                    {/* Descrição da duração estimada */}
                    <div className="text-xs text-blue-700 text-center">
                      {newRounds <= 3 && "⚡ Rápida (~3-5 min)"}
                      {newRounds >= 4 && newRounds <= 6 && "⏱️ Média (~6-10 min)"}
                      {newRounds >= 7 && newRounds <= 10 && "🕐 Longa (~12-15 min)"}
                    </div>
                  </div>
                  <button
                    className="bg-green-600 text-white px-4 py-1 rounded-lg font-bold mt-1 hover:bg-green-700 transition text-sm"
                    onClick={() => {
                      // Validar antes de enviar
                      const rounds = newRounds && newRounds >= 1 && newRounds <= 10 ? newRounds : 3;
                      socketService.getSocket().emit('restart-game', { roomCode, rounds });
                      setPodium(null);
                    }}
                  >
                    Nova partida
                  </button>
                </div>
              )}
              {!isCurrentUserHost && (
                <div className="text-blue-900 font-bold mt-2 text-sm text-center">Aguardando o host iniciar nova partida...</div>
              )}
              <button
                className="bg-red-600 text-white px-4 py-1 rounded-lg font-bold mt-2 hover:bg-red-700 transition text-sm"
                onClick={handleLeaveRoom}
              >
                Sair
              </button>
            </div>
          </div>
        )}
        
        {/* Tab de Estatísticas */}
        {activeTab === 'stats' && (
          <GameStats 
            players={players}
            wordHistory={wordHistory}
            currentRound={round}
            maxRounds={maxRounds}
            isGameFinished={!!podium}
          />
        )}
        
        {/* Tab de Conquistas */}
        {activeTab === 'achievements' && (
          <AchievementSystem 
            playerStats={playerStats}
            onAchievementUnlocked={handleAchievementUnlocked}
          />
        )}
      </div>
    </div>
  );
}

export default Sala; 