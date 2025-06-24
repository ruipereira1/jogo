import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socketService from '../services/socket';

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
}

interface DrawingLine {
  points: { x: number; y: number }[];
}

interface WordHistoryEntry {
  round: number;
  word: string;
  drawer: string;
  guessedBy: string[];
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
  
  // Novos estados para melhorias
  const [hints, setHints] = useState<{ hint: string; type: string }[]>([]);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ name: string; message: string; timestamp: number }[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [wordHistory, setWordHistory] = useState<WordHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');
  const [isHorizontalMode, setIsHorizontalMode] = useState(false);

  // Refs para armazenar timeouts e intervalos para limpeza
  const timeoutRefs = useRef<number[]>([]);

  // Função auxiliar para adicionar timeout com limpeza automática
  const addTimeout = (callback: () => void, delay: number) => {
    const timeoutId = window.setTimeout(() => {
      callback();
      // Remover o timeout da lista após execução
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
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      let newWidth, newHeight;
      
      if (isHorizontalMode) {
        // Modo horizontal: usar quase toda a largura disponível
        newWidth = Math.min(containerWidth - 10, screenWidth - 20);
        newHeight = Math.floor(Math.min(newWidth * 0.6, screenHeight * 0.4)); // Proporção mais larga
      } else {
        // Modo vertical normal
        if (screenWidth < 480) { // Telefones pequenos
          newWidth = Math.min(300, containerWidth - 10);
        } else if (screenWidth < 768) { // Telefones maiores
          newWidth = Math.min(400, containerWidth - 15);
        } else { // Tablets e desktop
          newWidth = Math.min(500, containerWidth - 20);
        }
        newHeight = Math.floor(newWidth * 0.7); // Manter proporção de aspecto normal
      }
      
      setCanvasSize({ width: newWidth, height: newHeight });
    }
  };

  // Atualizar o tamanho do canvas quando a janela for redimensionada
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Atualizar canvas quando o modo horizontal mudar
  useEffect(() => {
    updateCanvasSize();
  }, [isHorizontalMode]);

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
        addTimeout(() => setRoundEnded(false), 4000); // Esconde a mensagem após 4 segundos
      } else if (reason === 'drawer-left') {
        // Mostrar mensagem especial quando o desenhista sai
        setToastMessage(message || 'O desenhista saiu da sala. Avançando para próxima ronda...');
        setShowToast(true);
        addTimeout(() => setShowToast(false), 4000);
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
    
    // Novos listeners para as melhorias
    socket.on('hint', ({ hint, type }) => {
      setHints(prev => [...prev, { hint, type }]);
      setToastMessage(hint);
      setShowToast(true);
      addTimeout(() => setShowToast(false), 4000);
    });

    socket.on('word-reveal', ({ word }) => {
      setRevealedWord(word);
      setToastMessage(`A palavra era: ${word}`);
      setShowToast(true);
      addTimeout(() => {
        setShowToast(false);
        setRevealedWord(null);
      }, 5000);
    });

    socket.on('chat-message', ({ name, message, timestamp }) => {
      setChatMessages(prev => [...prev, { name, message, timestamp }]);
    });

    // Sistema de reconexão
    socket.on('connect', () => {
      setConnectionStatus('connected');
      setIsReconnecting(false);
      if (roomCode && user) {
        // Tentar reentrar na sala após reconexão
        socket.emit('join-room', { userName: user.name, roomCode }, (response: { success: boolean; error?: string }) => {
          if (!response.success) {
            setError('Erro ao reconectar à sala');
          }
        });
      }
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setIsReconnecting(true);
    });

    socket.on('reconnect', () => {
      setConnectionStatus('connected');
      setIsReconnecting(false);
    });

    // Novos eventos para melhor handling de desconexões
    socket.on('player-temporarily-disconnected', ({ playerId, playerName }) => {
      setToastMessage(`${playerName} foi temporariamente desconectado`);
      setShowToast(true);
      addTimeout(() => setShowToast(false), 3000);
    });

    socket.on('player-reconnected', ({ playerId, playerName, players }) => {
      setPlayers(players);
      setToastMessage(`${playerName} reconectou!`);
      setShowToast(true);
      addTimeout(() => setShowToast(false), 3000);
    });

    // Event listener para reconexão automática de sala
    const handleRoomReconnected = (event: CustomEvent) => {
      const { gameState } = event.detail;
      if (gameState) {
        setRound(gameState.round);
        setMaxRounds(gameState.maxRounds);
        setDrawerId(gameState.currentDrawer);
        setIsDrawer(gameState.isDrawer);
        setTimer(gameState.timeLeft);
        
        setToastMessage('Reconectado à sala com sucesso!');
        setShowToast(true);
        addTimeout(() => setShowToast(false), 3000);
      }
    };

    const handleConnectionError = () => {
      setError('Falha na conexão. Tentando reconectar...');
      addTimeout(() => {
        if (connectionStatus === 'disconnected') {
          navigate('/');
        }
      }, 10000); // Redirecionar para home após 10 segundos se não reconectar
    };

    // Adicionar event listeners customizados
    window.addEventListener('roomReconnected', handleRoomReconnected as EventListener);
    window.addEventListener('connectionError', handleConnectionError);

    setIsLoading(false);

    return () => {
      // Limpar timeouts ativos
      clearAllTimeouts();
      
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
      socket.off('hint');
      socket.off('word-reveal');
      socket.off('chat-message');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('player-temporarily-disconnected');
      socket.off('player-reconnected');
      
      // Remover event listeners customizados
      window.removeEventListener('roomReconnected', handleRoomReconnected as EventListener);
      window.removeEventListener('connectionError', handleConnectionError);
    };
  }, [roomCode, navigate, connectionStatus]);

  const handleLeaveRoom = () => {
    // Limpar dados de sala e desconectar do socket
    socketService.leaveRoom();
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

  // Função para compartilhar sala via WhatsApp
  const handleShareWhatsApp = async () => {
    try {
      // Criar URL para a página de entrada direta com o código da sala
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/entrar-sala/${roomCode}`;
      
      const shareText = `Venha jogar ArteRápida comigo! Basta entrar com seu nome:\n\n${shareUrl}`;
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
      
      const newWindow = window.open(whatsappUrl, '_blank');
      
      // Verificar se a janela foi aberta com sucesso
      if (newWindow) {
        setToastMessage('Link para WhatsApp aberto!');
      } else {
        setToastMessage('Não foi possível abrir o WhatsApp. Verifique se pop-ups estão habilitados.');
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
      
      {/* Toast de notificação */}
      {showToast && (
        <div className="fixed top-2 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-3 py-1 rounded-lg shadow-lg z-50 text-xs animate-fade-in-out">
          {toastMessage}
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
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/entrar-sala/${roomCode}`;
                      navigator.share({
                        title: 'ArteRápida - Jogo de Desenho',
                        text: `Venha jogar ArteRápida comigo! Basta entrar com seu nome.`,
                        url: shareUrl
                      })
                      .then(() => {
                        setToastMessage('Compartilhado!');
                        setShowToast(true);
                        addTimeout(() => setShowToast(false), 3000);
                      })
                      .catch(err => {
                        if (import.meta.env.DEV) {
                          console.error('Erro ao compartilhar:', err);
                        }
                      });
                    }}
                    className="bg-blue-600 text-white px-3 py-2 rounded font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1 text-xs"
                  >
                    📤 Mais
                  </button>
                )}
              </div>
              
              <div className="mt-3">
                <p className="text-gray-600 text-xs mb-1">QR Code:</p>
                <div className="bg-white p-1 rounded-lg inline-block">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${window.location.origin}/entrar-sala/${roomCode}`)}`} 
                    alt="QR Code da sala" 
                    className="w-24 h-24 mx-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML = '<p class="text-gray-500 text-xs p-2">QR indisponível</p>';
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-1 mb-2">
          {/* Linha 1: Título e contador de jogadores */}
          <div className="flex justify-between items-center">
            <h1 className="text-base sm:text-lg font-bold">Sala: {roomCode}</h1>
            <span className="bg-blue-800 text-white px-2 py-1 rounded text-xs font-semibold">
              {players.length} jogador{players.length !== 1 ? 'es' : ''}
            </span>
          </div>
          
          {/* Linha 2: Botões de ação - mais compactos */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setShowChat(true)}
              className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 transition flex items-center gap-1"
            >
              💬
              {chatMessages.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] rounded-full px-1">
                  {chatMessages.length}
                </span>
              )}
            </button>
            
            <button
              onClick={handleGetWordHistory}
              className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 transition"
            >
              📚
            </button>
            
            <button
              onClick={handleOpenShareModal}
              className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition"
            >
              🔗
            </button>
            
            {isCurrentUserHost && !isGameStarted && (
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 transition"
              >
                ▶️ Iniciar
              </button>
            )}
            
            <button 
              onClick={handleLeaveRoom}
              className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 transition flex items-center gap-1"
              title="Sair da sala"
              aria-label="Sair da sala"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Layout responsivo para todos os dispositivos */}
        <div className="flex flex-col gap-2">
          {/* Lista de jogadores - mais compacta */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
            <div className="flex justify-between items-center mb-1">
              <h2 className="font-semibold text-sm">Jogadores ({players.length})</h2>
              <div className="text-xs text-yellow-200">Ronda: {round || 0}/{maxRounds || 1}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 text-xs">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-1 bg-white/10 rounded ${drawerId === player.id ? 'border border-yellow-300' : ''}`}
                >
                  <span className="truncate flex-1 mr-1">{player.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-300">{player.score}</span>
                    {player.isHost && <span className="text-yellow-300 text-[10px]">👑</span>}
                    {drawerId === player.id && <span className="text-green-300 text-[10px]">✏️</span>}
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
                  <div className={`flex ${isHorizontalMode ? 'flex-col' : 'flex-col sm:flex-row'} justify-between items-center mb-2 gap-1`}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-green-300 font-bold">Você está desenhando!</p>
                      {/* Botão toggle horizontal */}
                      <button
                        onClick={() => setIsHorizontalMode(!isHorizontalMode)}
                        className={`px-2 py-1 rounded text-xs font-bold transition ${
                          isHorizontalMode 
                            ? 'bg-yellow-300 text-blue-900' 
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                        title={isHorizontalMode ? 'Modo Normal' : 'Modo Horizontal'}
                      >
                        {isHorizontalMode ? '📱' : '📺'}
                      </button>
                    </div>
                    <p className="text-sm">Palavra: <span className="font-mono bg-yellow-200 text-blue-900 px-1 py-0.5 rounded text-xs">{word}</span></p>
                  </div>
                  
                  <div 
                    ref={canvasContainerRef} 
                    className={`w-full mb-2 ${isHorizontalMode ? 'flex justify-center' : ''}`}
                  >
                    <canvas
                      ref={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className="border-2 border-yellow-300 bg-white rounded cursor-crosshair"
                      style={{ 
                        touchAction: "none",
                        maxWidth: "100%",
                        height: "auto" 
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      aria-label={isDrawer ? `Canvas para desenhar a palavra: ${word}` : "Canvas mostrando o desenho atual"}
                      role={isDrawer ? "application" : "img"}
                    />
                  </div>
                  
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={handleClearCanvas}
                      className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600 transition"
                      aria-label="Limpar desenho do canvas"
                    >
                      🗑️ Apagar
                    </button>
                    {isHorizontalMode && (
                      <div className="text-xs text-yellow-200 flex items-center">
                        💡 Modo horizontal ativo - mais espaço para desenhar!
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-blue-200 font-bold mb-2">Adivinhe o desenho!</p>
                  
                  <div ref={canvasContainerRef} className="w-full mb-2">
                    <canvas
                      ref={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      className="border-2 border-yellow-300 bg-white rounded mx-auto"
                      style={{ 
                        touchAction: "none", 
                        cursor: 'not-allowed',
                        maxWidth: "100%",
                        height: "auto"
                      }}
                    />
                  </div>
                  
                  {/* Campo de palpite */}
                  <form onSubmit={handleGuessSubmit} className="flex gap-1 mb-2">
                    <input
                      type="text"
                      className="p-1 rounded text-blue-900 flex-1 text-sm"
                      placeholder={guessedCorrectly ? "Você acertou!" : "Digite seu palpite..."}
                      value={guess}
                      onChange={e => setGuess(e.target.value)}
                      disabled={guessedCorrectly}
                      autoComplete="off"
                      aria-label="Campo para digitar palpite do desenho"
                      role="textbox"
                    />
                    <button
                      type="submit"
                      className="bg-yellow-300 text-blue-900 px-2 py-1 rounded font-semibold text-xs hover:bg-yellow-400 transition"
                      disabled={guessedCorrectly}
                      aria-label="Enviar palpite"
                    >
                      ➤
                    </button>
                  </form>
                  
                  {/* Feed de palpites - mais compacto */}
                  <div 
                    className="max-h-20 overflow-y-auto bg-white/20 rounded p-1 text-left text-xs"
                    role="log"
                    aria-live="polite"
                    aria-label="Lista de palpites dos jogadores"
                  >
                    {guesses.slice(-5).map((g, i) => (
                      <div key={i} className={g.correct ? "text-green-300 font-bold" : "text-white"}>
                        <span className="font-semibold">{g.name}:</span> {g.text}
                        {g.correct && <span className="ml-1 text-[10px]" role="img" aria-label="correto">✓</span>}
                      </div>
                    ))}
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

        {/* Cronómetro da ronda - mais compacto */}
        {isGameStarted && (
          <div className="mt-2 text-center">
            <div className="text-lg font-bold text-yellow-300">⏱️ {timer}s</div>
            
            {/* Área de dicas - mais compacta */}
            {hints.length > 0 && (
              <div className="mt-1 bg-blue-800/50 rounded-lg p-1 max-w-sm mx-auto">
                <div className="text-yellow-200 text-xs">
                  {hints.slice(-1)[0]?.hint}
                </div>
              </div>
            )}
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
      </div>
    </div>
  );
}

export default Sala; 