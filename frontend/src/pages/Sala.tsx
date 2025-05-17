import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  playerId: string; // Alterado de opcional para obrigatório
  reconnectTimeLeft?: number;
}

// Declare interface para window global
declare global {
  interface Window {
    globalPlayers?: any[];
    currentPlayers?: any[];
    forceShowPodium?: () => string;
  }
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
  const pointQueueRef = useRef<{x: number, y: number, pressure?: number, isStartOfLine?: boolean, isSinglePoint?: boolean}[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [points, setPoints] = useState<Array<{x: number, y: number, color?: string, width?: number}>>([]);
  const [receivedPoints, setReceivedPoints] = useState<any[]>([]);
  const lastStateRequestRef = useRef<number>(0); // Ref para throttling de solicitações de estado

  // Ref para garantir valor atualizado de drawing
  const drawingRef = useRef(false);
  const clearingRef = useRef<number>(0);
  const lineStartingRef = useRef(false);

  // Detectar tipo de dispositivo para ajustes de UI
  const [deviceType, setDeviceType] = useState<'mobile'|'tablet'|'desktop'>('desktop');
  
  // Novo estado para jogadores reconectados
  const [playerReconnected, setPlayerReconnected] = useState<{name: string, timeDisconnected: number} | null>(null);
  // Mapa para controlar tempos de reconexão
  const [reconnectTimeouts, setReconnectTimeouts] = useState<{[key: string]: number}>({});

  const lastPointsByClientRef = useRef<{[key: string]: {x: number, y: number} | null}>({});
  const lastPointTimerRef = useRef<number | null>(null);

  // Criar um sistema mais robusto para gerenciar notificações
  const [notifications, setNotifications] = useState<{
    id: string;
    type: 'join' | 'leave' | 'reconnect' | 'drawer-left' | 'host-left';
    message: string;
    timestamp: number;
  }[]>([]);

  // Função para adicionar notificação de forma centralizada
  const addNotification = useCallback((type: 'join' | 'leave' | 'reconnect' | 'drawer-left' | 'host-left', message: string) => {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    setNotifications(prev => {
      // Limitar a 3 notificações visíveis ao mesmo tempo (as mais recentes)
      const filtered = [...prev, { id, type, message, timestamp: Date.now() }];
      if (filtered.length > 3) {
        return filtered.slice(filtered.length - 3);
      }
      return filtered;
    });
    
    // Remover a notificação após um tempo
    const timeout = type === 'drawer-left' || type === 'host-left' ? 5000 : 4000;
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, timeout);
  }, []);

  // Função para enviar lotes de pontos com throttling
  const sendPointsBatch = useCallback(() => {
    if (pointQueueRef.current.length === 0) return;
    
    // Enviar todos os pontos acumulados de uma vez
    console.log(`Enviando lote de ${pointQueueRef.current.length} pontos ao servidor`);
    socketService.getSocket().emit('draw-points-batch', { 
      roomCode, 
      points: pointQueueRef.current,
      color: strokeColor,
      size: strokeWidth,
      timestamp: Date.now()
    });
    
    pointQueueRef.current = []; // Limpar fila após envio
  }, [roomCode, strokeColor, strokeWidth]);

  // Função throttled para solicitar estado da sala
  const requestRoomStateThrottled = useCallback(() => {
    const now = Date.now();
    if (now - lastStateRequestRef.current > 3000) { // Limitar a 1 solicitação a cada 3 segundos
      console.log('Solicitando estado da sala (throttled)');
      lastStateRequestRef.current = now;
      socketService.getSocket().emit('request-room-state', { roomCode });
    } else {
      console.log('Solicitação de estado ignorada (throttling)');
    }
  }, [roomCode]);

  useEffect(() => {
    const socket = socketService.getSocket();
    const user = socketService.getUser();

    if (!user || !roomCode) {
      // Usuário não está logado ou não tem código de sala
      navigate('/');
      return;
    }

    // Verificar se estamos em um ambiente com suporte adequado para canvas
    const canvas = document.createElement('canvas');
    const hasCanvasSupport = !!(canvas.getContext && canvas.getContext('2d'));
    if (!hasCanvasSupport) {
      console.error('Este navegador não suporta canvas HTML5!');
      setError('Este navegador não suporta desenho. Por favor, use um navegador mais recente.');
      return;
    }

    // Pedir estado completo da sala ao entrar/reconectar (usando throttling)
    requestRoomStateThrottled();

    // Efeito para processar o estado inicial da sala quando ele é recebido
    const handleRoomState = (state: any) => {
      console.log('[ESTADO] Estado da sala recebido:', state);
      setPlayers(state.players || []);
      setDrawerId(state.drawerId || null);

      // Garantir que round e maxRounds sejam números válidos
      const currentRound = Number(state.round) || 1;
      const totalRounds = Number(state.maxRounds) || 3;

      console.log(`[ESTADO] Atualizando rodada: ${currentRound}/${totalRounds}`);
      
      // Verificar se o valor de maxRounds é consistente
      if (maxRounds !== totalRounds && totalRounds > 0) {
        console.log(`[CORREÇÃO] Atualizando máximo de rodadas: ${maxRounds} -> ${totalRounds}`);
        setMaxRounds(totalRounds);
      }
      
      // Verificar inconsistências em round
      if (currentRound > totalRounds) {
        console.log(`[ALERTA] Rodada atual (${currentRound}) maior que o máximo (${totalRounds})`);
        
        // Se o jogo ainda está ativo mas a rodada excedeu o máximo, talvez devamos mostrar o pódio
        if (state.status === 'playing' && podium === null) {
          console.log('[CORREÇÃO] Rodada excedeu o máximo, mas pódio não está visível');
          // Dar um tempo para o servidor enviar o pódio
          setTimeout(() => {
            if (podium === null && isGameStarted) {
              console.log('[CORREÇÃO] Forçando exibição do pódio devido a inconsistência de rodada');
              const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
              setPodium(sortedPlayers);
              setIsGameStarted(false);
            }
          }, 2000);
        }
      } else {
        // Definir a rodada apenas se for um valor válido
        setRound(currentRound);
      }
      
      // Se o estado inclui um pódio, mostrar isso
      if (state.status === 'gameEnded' || state.podium) {
        console.log('[ESTADO] Jogo encerrado detectado no estado');
        const sortedPlayers = [...(state.podium || state.players || [])].sort((a, b) => b.score - a.score);
        setPodium(sortedPlayers);
        setIsGameStarted(false);
      } else {
        setIsGameStarted(state.status === 'playing');
        // Remover pódio se o jogo estiver em andamento
        if (state.status === 'playing' && podium !== null) {
          console.log('[CORREÇÃO] Removendo pódio durante jogo ativo');
          setPodium(null);
        }
      }
      
      // Atualizar palavra apenas se for o desenhista
      if (state.drawerId === socket.id) {
        setIsDrawer(true);
        setWord(state.word || null);
        console.log('[ESTADO] Definido como desenhista com palavra:', state.word);
      } else {
        setIsDrawer(false);
        setWord(null);
        console.log('[ESTADO] Definido como não-desenhista');
      }
      
      // Sincronizar linhas e pontos apenas se não for o desenhista atual
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
      
      // Verificar estado do pódio
      if (state.podium) {
        console.log('[ESTADO] Definindo pódio a partir do estado da sala');
        setPodium(state.podium);
      }
      
      // Log completo do estado processado
      console.log('[DIAGNÓSTICO] Estado da sala processado:',
        `jogadores=${state.players?.length || 0}`,
        `desenhista=${state.drawerId?.substring(0, 5) || 'nenhum'}`,
        `rodada=${currentRound}/${totalRounds}`,
        `status=${state.status}`,
        `pódio=${state.podium ? 'sim' : 'não'}`
      );
    };

    // Receber estado completo da sala
    socket.on('room-state', handleRoomState);

    // Ouvir eventos do socket
    socket.on('player-joined', ({ players, playerName }) => {
      setPlayers(players);
      addNotification('join', `${playerName} entrou na sala!`);
      // Garantir sincronização total (com throttling):
      requestRoomStateThrottled();
    });

    socket.on('player-left', ({ players, playerName }) => {
      setPlayers(players);
      addNotification('leave', `${playerName} saiu da sala!`);
      // Pedir estado completo da sala para garantir sincronização (com throttling)
      requestRoomStateThrottled();
    });

    socket.on('players-update', ({ players, drawerId, round, maxRounds }) => {
      setPlayers(players);
      setDrawerId(drawerId);
      
      // Garantir que round e maxRounds sejam números válidos
      if (round !== undefined) {
        const roundNumber = Number(round);
        console.log(`[PLAYERS-UPDATE] Atualizando rodada para ${roundNumber}`);
        
        // Verificar se não há inconsistência 
        if (roundNumber <= maxRounds || (maxRounds === undefined)) {
          setRound(roundNumber);
        } else {
          console.log(`[ALERTA] Ignorando atualização inconsistente de rodada: ${roundNumber}/${maxRounds}`);
        }
      }
      
      if (maxRounds !== undefined) {
        const maxRoundsNumber = Number(maxRounds);
        console.log(`[PLAYERS-UPDATE] Atualizando total de rodadas para ${maxRoundsNumber}`);
        setMaxRounds(maxRoundsNumber);
      }
      
      // Verificar explicitamente fim de jogo se estivermos além da última rodada
      // VERIFICAÇÃO ESTRITA: Pódio só deve ser exibido se a rodada > máximo
      if (round > maxRounds && isGameStarted) {
        console.log('[CORREÇÃO] Rodada excedeu máximo - isso indica fim de jogo');
        // Calcular o pódio localmente
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        setPodium(sortedPlayers);
        setIsGameStarted(false);
      }
    });

    // Adicionando listener para evento explícito de atualização de rodada
    socket.on('round-update', ({ round, maxRounds }) => {
      console.log(`[EVENTO] Recebido evento round-update: ${round}/${maxRounds}`);
      
      if (round !== undefined && maxRounds !== undefined) {
        // Verificar a validade dos valores
        const roundNumber = Number(round);
        const maxRoundsNumber = Number(maxRounds);
        
        if (!isNaN(roundNumber) && !isNaN(maxRoundsNumber)) {
          // Garantir que a rodada nunca seja maior que o máximo
          if (roundNumber <= maxRoundsNumber) {
            console.log(`[ROUND-UPDATE] Atualizando para rodada ${roundNumber}/${maxRoundsNumber}`);
            setRound(roundNumber);
            setMaxRounds(maxRoundsNumber);
          } else {
            console.log(`[ALERTA] Atualização de rodada inválida: ${roundNumber}/${maxRoundsNumber}`);
          }
        } else {
          console.log(`[ERRO] Valores de rodada não numéricos: round=${round}, maxRounds=${maxRounds}`);
        }
      }
    });

    socket.on('game-started', (data) => {
      setIsGameStarted(true);
      console.log('[EVENTO] Jogo iniciado!', data);
      
      // Atualizar informações das rodadas se disponíveis nos dados
      if (data) {
        if (data.round !== undefined) {
          console.log(`[GAME-STARTED] Definindo rodada inicial: ${data.round}`);
          setRound(Number(data.round));
        }
        
        if (data.maxRounds !== undefined) {
          console.log(`[GAME-STARTED] Definindo total de rodadas: ${data.maxRounds}`);
          setMaxRounds(Number(data.maxRounds));
        }
      }
      
      // Limpar canvas e pódio
      setPodium(null);
      setReceivedPoints([]);
      setLines([]);
      setGuesses([]);
      
      // Garantir que o estado seja atualizado imediatamente
      setTimeout(() => {
        console.log('Verificando estado do jogo após início:', {
          isGameStarted: true,
          round,
          maxRounds
        });
      }, 100);

      // Verificar se o evento round-start vai ser chamado ou se precisamos fazer a transição manualmente
      setTimeout(() => {
        // Se após 3 segundos o desenhista ainda não foi definido, solicitar o estado da sala novamente
        if (!isDrawer && !drawerId) {
          console.log('Timeout: Solicitando estado da sala após iniciar jogo');
          requestRoomStateThrottled();
        }
      }, 3000);
    });

    socket.on('round-start', ({ isDrawer, word }) => {
      console.log('[ROUND START] Iniciando rodada', round, 'de', maxRounds);
      
      // Verificar e corrigir inconsistências
      if (podium !== null) {
        console.log('[CORREÇÃO] Removendo pódio exibido incorretamente durante jogo ativo');
        setPodium(null);
      }
      
      setIsDrawer(isDrawer);
      setWord(isDrawer ? word : null);
      setGuesses([]);
      setGuessedCorrectly(false);
      setWinnerName(null);
      
      // Limpar o canvas quando começa uma nova rodada (para TODOS os jogadores)
      setReceivedPoints([]);
      setLines([]);
      setPoints([]);
      
      // Abordagem diferente: enviar evento para limpar canvas apenas para o desenhista novo
      // Os não-desenhistas já terão limpado o canvas com os eventos do servidor
      if (isDrawer) {
        // Enviar eventos de limpeza apenas se for o desenhista atual
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
            socketService.endGame(roomCode).catch(error => {
              console.error('Erro ao encerrar jogo:', error);
            });
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
      console.log('Timer atualizado:', timeLeft);
      setTimer(timeLeft);
      
      // Se o timer começou mas não temos desenhista, solicitar estado da sala
      if (timeLeft > 0 && !drawerId) {
        console.log('Timer ativo mas sem desenhista definido, solicitando estado');
        requestRoomStateThrottled();
      }
      
      // Verificar se a rodada está prestes a terminar
      if (timeLeft <= 3 && timeLeft > 0 && round >= maxRounds) {
        console.log('ALERTA: Última rodada prestes a terminar!');
      }
    });

    socket.on('round-ended', ({ reason }) => {
      if (reason === 'timeout') {
        setRoundEnded(true);
        
        console.log(`[ROUND ENDED] Rodada ${round} de ${maxRounds} terminou por timeout`);
        
        // Verificar se era a última rodada - comparação ESTRITA
        if (round === maxRounds) {
          console.log('[ÚLTIMA RODADA] Última rodada terminou por timeout! Encerrando jogo...');
          
          // Após mostrar a mensagem de tempo esgotado, mostrar o pódio final
          setTimeout(() => {
            // Calcular o pódio localmente
            const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
            console.log('[PÓDIO] Exibindo pódio final após timeout na última rodada', sortedPlayers);
            
            // Forcefully show podium APENAS se realmente for a última rodada
            setPodium(sortedPlayers);
            setRoundEnded(false);
            setIsGameStarted(false);
            
            // Notificar o servidor sobre o fim do jogo para sincronização
            if (isCurrentUserHost) {
              console.log('[HOST] Host solicitando encerramento de jogo após última rodada');
              socketService.endGame(roomCode).catch(error => {
                console.error('Erro ao encerrar jogo:', error);
              });
            }
          }, 4000); // Mostrar após a mensagem de tempo esgotado
        } else {
          // Para rodadas não-finais, apenas esconder a mensagem
          console.log(`[RODADA NORMAL] Rodada ${round} terminou, mas não é a última (${maxRounds})`);
          setTimeout(() => setRoundEnded(false), 4000); // Esconde a mensagem após 4 segundos
        }
      }
    });

    socket.on('countdown', ({ value, round: countdownRound, maxRounds: countdownMaxRounds }) => {
      setCountdown(value > 0 ? value : null);
      // Verificar se estamos na última rodada (countdownRound é a rodada que vai começar)
      const isLastRound = countdownRound === countdownMaxRounds;
      console.log(`Contagem regressiva: ${value}, rodada: ${countdownRound}/${countdownMaxRounds}, última rodada: ${isLastRound}`);
      
      setIsLastRoundCountdown(isLastRound && value > 0);
      
      // Se estamos entrando na última rodada, exibir mensagem especial
      if (isLastRound && value === 3) {
        console.log('Iniciando última rodada!');
      }
    });

    socket.on('game-ended', ({ players: receivedPlayers }) => {
      console.log('[FIM DO JOGO] Evento game-ended recebido com jogadores:', receivedPlayers?.length || 0);
      
      // Garantir que temos jogadores válidos
      let finalPlayers = receivedPlayers;
      if (!finalPlayers || finalPlayers.length === 0) {
        console.error('[ERRO] Evento game-ended sem jogadores válidos');
        // Tentar usar os jogadores atuais
        finalPlayers = window.globalPlayers || window.currentPlayers || players || [];
      }
      
      // Salvar jogadores globalmente para debug/recuperação
      window.globalPlayers = finalPlayers;
      
      // Definir os jogadores no estado
      setPlayers(finalPlayers || []);
      
      // Ordenar por pontuação decrescente
      const sorted = [...(finalPlayers || [])].sort((a, b) => b.score - a.score);
      console.log('[FIM DO JOGO] Pódio final:', sorted.map(p => `${p.name}: ${p.score}`).join(', '));
      
      // Forcefully set podium and clear game state
      setPodium(sorted);
      setRoundEnded(false);
      setIsGameStarted(false);
      setTimer(0);
      setCountdown(null);
      setWord(null);
      setIsDrawer(false);
      
      // Adicionar uma verificação extra em caso de falha na exibição do pódio
      setTimeout(() => {
        if (podium === null) {
          console.log('[CORREÇÃO] Aplicando correção para exibir pódio que não foi mostrado');
          setPodium(sorted);
        }
      }, 1000);
    });

    socket.on('game-restarted', (data) => {
      console.log('[EVENTO] Jogo reiniciado:', data);
      
      // Limpar estado do jogo
      setPodium(null);
      setRoundEnded(false);
      setCountdown(null);
      setTimer(0);
      setWinnerName(null);
      setGuesses([]);
      
      // Atualizar jogadores se recebidos do backend
      if (data?.players) {
        setPlayers(data.players);
      }
      
      // Atualizar informações das rodadas
      if (data?.round !== undefined) {
        setRound(Number(data.round));
        console.log(`[GAME-RESTARTED] Rodada definida para ${data.round}`);
      }
      
      if (data?.maxRounds !== undefined) {
        setMaxRounds(Number(data.maxRounds));
        console.log(`[GAME-RESTARTED] Total de rodadas definido para ${data.maxRounds}`);
      }
      
      // Mudar para o estado de jogo ativo
      setIsGameStarted(true);
      
      // Limpar canvas e pontos
      setReceivedPoints([]);
      setLines([]);
      setPoints([]);
      
      console.log('[GAME-RESTARTED] Estado do jogo resetado e pronto para recomeçar');
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

    // Adicionar suporte para receber lotes de pontos
    socket.on('draw-points-batch', (data) => {
      if (isDrawer) return; // O desenhista não precisa processar pontos que ele mesmo enviou
      
      console.log(`Recebido lote de ${data.points?.length || 0} pontos`);
      
      // Adicionar os pontos ao array de pontos recebidos
      setReceivedPoints(prev => {
        // Limitar o número de pontos armazenados para evitar problemas de performance
        const maxPoints = 2000;
        const newPoints = [...prev, ...data.points.map((p: {x: number, y: number, pressure?: number, isStartOfLine?: boolean, isSinglePoint?: boolean}) => ({
          ...p,
          color: data.color,
          size: data.size
        }))];
        
        if (newPoints.length > maxPoints) {
          // Se exceder o limite, manter apenas os mais recentes
          return newPoints.slice(newPoints.length - maxPoints);
        }
        return newPoints;
      });
    });

    // Atualizar o ouvinte original de draw-point para ser compatível com o batching
    socket.on('draw-point', (data) => {
      // Apenas espectadores devem processar os pontos recebidos
      if (isDrawer) return;
      
      // Processar comando de limpeza imediatamente se presente
      if (data.isClearCanvas) {
        console.log('Recebido comando para limpar canvas');
        setReceivedPoints([]);
        return;
      }
      
      // Otimizar: converter coordenadas para valores normalizados mais precisos
      // e adicionar flag para indicar se é início de linha
      if (typeof data.x === 'number' && typeof data.y === 'number') {
        // Garantir que dados importantes sejam sempre definidos
        const enhancedPoint = {
          ...data,
          x: Math.max(0, Math.min(1, data.x || 0)),
          y: Math.max(0, Math.min(1, data.y || 0)),
          color: data.color || strokeColor,
          size: data.size || strokeWidth,
          pressure: data.pressure || 0.5
        };
        
        // Adicionar o ponto ao array de pontos recebidos usando técnica de acumulação
        setReceivedPoints(prev => {
          // Limitar o número de pontos armazenados para evitar problemas de performance
          const maxPoints = 1000;
          const newPoints = [...prev, enhancedPoint]; 
          
          // Se exceder o limite, manter apenas os mais recentes
          if (newPoints.length > maxPoints) {
            return newPoints.slice(newPoints.length - maxPoints);
          }
          return newPoints;
        });
      } else {
        console.warn('Recebido ponto de desenho inválido:', data);
      }
    });

    setIsLoading(false);

    // Configurar intervalo para enviar lotes de pontos se for o desenhista
    // Desativado temporariamente até o servidor suportar batching
    /*
    let batchInterval: ReturnType<typeof setInterval> | null = null;
    if (isDrawer) {
      batchInterval = setInterval(sendPointsBatch, 100); // Enviar lotes a cada 100ms
    }
    */

    // Adicionar manipulador para evento player-offline
    socket.on('player-offline', (data) => {
      console.log('Jogador offline:', data);
      addNotification('leave', `${data.playerName} desconectou-se.`);
      
      // Atualizar a lista de jogadores
      if (data.players) {
        setPlayers(data.players);
      }
      
      // Guardar informações de timeout para reconexão
      if (data.players && data.timeoutSeconds) {
        const newTimeouts: {[key: string]: number} = {};
        data.players.forEach((player: any) => {
          if (player.reconnectTimeLeft && player.playerId) {
            newTimeouts[player.playerId] = player.reconnectTimeLeft;
          }
        });
        setReconnectTimeouts(prev => ({ ...prev, ...newTimeouts }));
      }
      
      // Se era o desenhista, mostrar notificação específica
      if (data.playerId === drawerId) {
        addNotification('drawer-left', `⚠️ ${data.playerName} (desenhista) desconectou-se! Aguardando reconexão...`);
      }
    });
    
    // Adicionar manipulador para atualizações de timeout
    socket.on('player-timeout-update', (data) => {
      console.log('Atualização de timeout:', data);
      
      // Verificar se o playerId existe
      if (data.playerId) {
        // Atualizar o tempo restante no mapa de timeouts
        setReconnectTimeouts(prev => ({
          ...prev,
          [data.playerId]: data.timeLeft
        }));
      }
    });
    
    // Adicionar manipulador para reconexão de jogador
    socket.on('player-reconnected', (data) => {
      console.log('Jogador reconectado:', data);
      
      // Mostrar notificação de reconexão
      addNotification('reconnect', `${data.playerName} reconectou após ${data.timeDisconnected} segundos!`);
      
      // Remover do mapa de timeouts se o playerId existir
      if (data.playerId) {
        setReconnectTimeouts(prev => {
          const newTimeouts = { ...prev };
          delete newTimeouts[data.playerId];
          return newTimeouts;
        });
      }
    });

    socket.on('drawer-left', ({ drawerName }) => {
      addNotification('drawer-left', `⚠️ ${drawerName} (desenhista) desconectou-se!`);
    });

    socket.on('host-left', ({ newHostName }) => {
      addNotification('host-left', `${newHostName} é o novo host da sala!`);
    });

    // Efeito para configurar eventos de desenho
    useEffect(() => {
      const socket = socketService.getSocket();
      
      // Manipulador para pontos de desenho individuais
      const handleDrawPointEvent = (data: any) => {
        // Adicionar timestamp se não existir
        const pointWithTime = {
          ...data,
          timestamp: data.timestamp || Date.now()
        };
        
        // Se for um comando de limpeza, limpar tudo
        if (data.isClearCanvas) {
          console.log('Limpeza de canvas solicitada por:', data.clientId);
          setReceivedPoints([]);
          setPoints([]);
          return;
        }
        
        // Se o ponto é do próprio cliente e é o desenhista, ignorar (já foi processado localmente)
        if (data.clientId === socket.id && isDrawer) {
          return;
        }
        
        // Log para diagnóstico se as coordenadas forem suspeitamente zeradas
        if (data.x === 0 && data.y === 0 && !data.isClearCanvas) {
          console.warn('Recebido ponto com coordenadas zeradas:', data);
        }
        
        // Adicionar ponto à lista de pontos recebidos para renderização
        setReceivedPoints(prev => {
          // Limitar o número de pontos armazenados para evitar problemas de memória
          const MAX_RECEIVED_POINTS = 1000;
          
          const updated = [...prev, pointWithTime];
          if (updated.length > MAX_RECEIVED_POINTS) {
            console.log(`Limitando pontos recebidos de ${updated.length} para ${MAX_RECEIVED_POINTS}`);
            return updated.slice(-MAX_RECEIVED_POINTS);
          }
          return updated;
        });
      };
      
      // Manipulador para limpeza de canvas
      const handleClearCanvasEvent = () => {
        console.log('Solicitação explícita de limpeza de canvas recebida');
        setReceivedPoints([]);
        setPoints([]);
        
        // Enviar ponto especial de limpeza para garantir que o DrawingCanvas processe
        const clearPoint = { 
          x: 0, 
          y: 0, 
          clientId: 'server', 
          isClearCanvas: true,
          timestamp: Date.now()
        };
        setReceivedPoints([clearPoint]);
      };
      
      // Eventos de desenho
      socket.on('draw-point', handleDrawPointEvent);
      socket.on('clear-canvas', handleClearCanvasEvent);
      
      return () => {
        socket.off('draw-point', handleDrawPointEvent);
        socket.off('clear-canvas', handleClearCanvasEvent);
      };
    }, [roomCode, isDrawer]);

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
      socket.off('draw-points-batch'); 
      socket.off('player-timeout-update');
      socket.off('player-reconnected');
    };
  }, [roomCode, navigate, isDrawer, requestRoomStateThrottled, sendPointsBatch, drawerId, addNotification]);

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
    
    // Notificar o servidor antes de desconectar
    if (roomCode) {
      console.log('Enviando notificação de saída da sala');
      socketService.leaveRoom(roomCode)
        .then(() => {
          console.log('Saída da sala notificada com sucesso');
          socketService.disconnect();
          localStorage.removeItem('playerId');
          navigate('/');
        })
        .catch(error => {
          console.error('Erro ao notificar saída da sala:', error);
          // Mesmo com erro, prosseguir com a saída local
          socketService.disconnect();
          localStorage.removeItem('playerId');
          navigate('/');
        });
    } else {
      socketService.disconnect();
      localStorage.removeItem('playerId');
      navigate('/');
    }
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

  // Função otimizada para desenhar ponto - agora usa o sistema de batching
  const handleDrawPoint = (point: { x: number; y: number; pressure?: number }) => {
    if (!isDrawer) return;
    
    // Normalizar coordenadas e garantir limites corretos
    const normalizedPoint = {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
      pressure: point.pressure || 0.5,
      isStartOfLine: lineStartingRef.current,
      isSinglePoint: lineStartingRef.current && !drawingRef.current
    };
    
    // Adicionar ponto à fila para possível envio em lote futuro
    pointQueueRef.current.push(normalizedPoint);
    
    // Enviar o ponto individual para compatibilidade com o sistema atual
    socketService.getSocket().emit('draw-point', { 
      roomCode, 
      x: normalizedPoint.x, 
      y: normalizedPoint.y,
      pressure: normalizedPoint.pressure,
      color: strokeColor, 
      size: strokeWidth,
      isStartOfLine: normalizedPoint.isStartOfLine,
      isSinglePoint: normalizedPoint.isSinglePoint,
      timestamp: Date.now()
    });
    
    // Para pontos de início de linha, resetar a flag
    if (lineStartingRef.current) {
      lineStartingRef.current = false;
    }
    
    // Se a fila ficar muito grande, limpar para evitar problemas de memória
    if (pointQueueRef.current.length > 100) {
      // Manter apenas os últimos 20 pontos
      pointQueueRef.current = pointQueueRef.current.slice(-20);
    }
  };

  // Função para o fim de uma linha (mantida para compatibilidade)
  const handleEndLine = () => {
    if (!isDrawer) return;
    setDrawing(false);
    drawingRef.current = false;
  };

  // Função para limpar o canvas - otimizada para evitar chamadas duplicadas
  const handleClearCanvas = () => {
    if (!isDrawer) return;
    
    // Evitar chamadas duplicadas usando timestamp
    const now = Date.now();
    if (clearingRef.current && now - clearingRef.current < 500) {
      console.log('Ignorando solicitação de limpeza duplicada');
      return;
    }
    
    clearingRef.current = now;
    
    // Limpar arrays locais imediatamente para resposta visual rápida
    setPoints([]);
    setReceivedPoints([]);
    setLines([]);
    pointQueueRef.current = []; // Limpar fila de pontos pendentes
    
    // Enviar o comando de limpeza normal
    socketService.getSocket().emit('clear-canvas', { roomCode });
    
    // Enviar um ponto especial com flag de limpeza
    // Este é um mecanismo redundante para garantir a sincronização
    socketService.getSocket().emit('draw-point', { 
      roomCode, 
      x: 0, 
      y: 0,
      isClearCanvas: true,
      timestamp: now
    });
    
    // Enviar um segundo comando de limpeza com pequeno atraso
    // Isso aumenta a chance de pelo menos um comando ser recebido por todos os clientes
    setTimeout(() => {
      socketService.getSocket().emit('draw-point', { 
        roomCode, 
        x: 0, 
        y: 0,
        isClearCanvas: true,
        timestamp: now + 50
      });
    }, 50);
    
    // Resetar flag após um delay
    setTimeout(() => {
      clearingRef.current = 0;
    }, 500);
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

  // Garantir que o canvas seja exibido corretamente
  useEffect(() => {
    if (isGameStarted) {
      console.log('Jogo iniciado, atualizando estado do canvas...');
      // Pequeno atraso para garantir que os estados estejam atualizados
      const timer = setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          console.log('Canvas encontrado, dimensões:', {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            style: canvas.getAttribute('style')
          });
        } else {
          console.error('Canvas não encontrado após início do jogo!');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isGameStarted]);

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
      console.error('Conexão com o servidor perdida. Tentando reconectar...');
    };
    const handleConnect = () => {
      setIsReconnecting(false);
      console.log('Conexão com o servidor restabelecida!');
      
      // Solicitar estado atualizado da sala
      if (roomCode) {
        socket.emit('request-room-state', { roomCode });
      }
    };
    socket.on('disconnect', handleDisconnect);
    socket.on('connect', handleConnect);
    
    // Adicionar tratamento para erros de conexão
    const handleConnectError = (error: any) => {
      console.error('Erro de conexão:', error);
    };
    socket.on('connect_error', handleConnectError);
    
    return () => {
      socket.off('disconnect', handleDisconnect);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [roomCode]);

  // Diagnóstico: logar sempre que isDrawer muda
  useEffect(() => {
    console.log('isDrawer mudou:', isDrawer);
    console.log('isGameStarted:', isGameStarted);
    console.log('receivedPoints:', receivedPoints.length);
    console.log('podium:', podium);
  }, [isDrawer, isGameStarted, receivedPoints, podium]);

  // Adicionar useEffect para monitorar mudanças no desenhista
  useEffect(() => {
    if (drawerId) {
      console.log('Desenhista definido:', drawerId);
      console.log('Este cliente é o desenhista?', drawerId === socket.id);
      
      // Se o jogo estiver em andamento e o desenhista for definido, mas isDrawer não
      // estiver sincronizado, atualizar isDrawer
      if (isGameStarted && drawerId === socket.id && !isDrawer) {
        console.log('Corrigindo estado: este cliente deveria ser o desenhista');
        setIsDrawer(true);
        
        // Solicitar palavra se necessário
        if (!word) {
          console.log('Solicitando palavra como desenhista');
          socketService.getSocket().emit('request-room-state', { roomCode });
        }
      } else if (isGameStarted && drawerId !== socket.id && isDrawer) {
        console.log('Corrigindo estado: este cliente não deveria ser o desenhista');
        setIsDrawer(false);
      }
    }
  }, [drawerId, isGameStarted, isDrawer, socket.id, word, roomCode]);

  // Corrigir o useEffect específico para monitoring da última rodada
  useEffect(() => {
    // Verificar se estamos na última rodada
    const isLastRoundCheck = round >= maxRounds;
    if (isLastRoundCheck && isGameStarted) {
      console.log('Estamos na última rodada!', {round, maxRounds});
      
      // Se o round estiver além do maxRounds, algo deu errado, forçar fim de jogo
      if (round > maxRounds && isCurrentUserHost) {
        console.log('Rodada excedeu o máximo - forçando fim de jogo');
        socketService.getSocket().emit('end-game', { roomCode });
      }
    }
  }, [round, maxRounds, isGameStarted, isCurrentUserHost, roomCode]);

  // Adicionar debug para rodadas/timer não estarem corretos
  useEffect(() => {
    console.log(`[DEBUG] Estado atual: rodada=${round}/${maxRounds}, timer=${timer}, jogo_iniciado=${isGameStarted}, podium=${podium !== null}`);
  }, [round, maxRounds, timer, isGameStarted, podium]);

  // Adicionar função de utilidade para verificar rodada
  const isLastRoundCheck = () => {
    // Verificação ESTRITA para última rodada
    const result = round === maxRounds;
    console.log(`[CHECK] É última rodada? ${result} (${round}/${maxRounds}) - verificação estrita`);
    return result;
  };

  // Melhor diagnóstico quando a rodada mudar
  useEffect(() => {
    console.log(`[RODADA] Rodada alterada para ${round}/${maxRounds}`);
    
    // Verificar se estamos na última rodada
    if (round >= maxRounds && isGameStarted) {
      console.log('[ALERTA] Iniciando ÚLTIMA rodada!');
    }
    
    // Verificar se excedemos a última rodada
    if (round > maxRounds && isGameStarted && !podium) {
      console.log('[ERRO] Rodada excedeu o máximo sem exibir pódio!');
      
      // Força mostrar pódio se somos o host
      if (isCurrentUserHost) {
        console.log('[CORREÇÃO] Host forçando encerramento por rodada excedida');
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        setPodium(sortedPlayers);
        
        // Notificar outros usuários
        setTimeout(() => {
          socketService.getSocket().emit('end-game', { roomCode });
        }, 1000);
      }
    }
  }, [round, maxRounds, isGameStarted, isCurrentUserHost, players, podium, roomCode]);

  // Adicionar verificação do timer para controle de final de jogo
  useEffect(() => {
    if (isGameStarted && round >= maxRounds && timer === 0 && !podium && !countdown) {
      console.log('[VERIFICAÇÃO] Última rodada com timer zerado - verificando se deveria mostrar pódio');
      
      // Se encerra a última rodada e o timer zerou, mas não mostramos o pódio, provavelmente
      // temos um problema e precisamos forçar o fim do jogo
      if (isCurrentUserHost) {
        console.log('[CORREÇÃO] Host forçando fim de jogo por fim de timer na última rodada');
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        
        // Aguardar um pouco para verificar se o servidor vai enviar o pódio
        setTimeout(() => {
          if (!podium) {
            console.log('[CORREÇÃO] Aplicando correção para mostrar pódio');
            setPodium(sortedPlayers);
            socketService.getSocket().emit('end-game', { roomCode });
          }
        }, 3000);
      }
    }
  }, [timer, isGameStarted, round, maxRounds, podium, countdown, isCurrentUserHost, players, roomCode]);
  
  // Adicionar evento explícito para último round
  socket.on('last-round', () => {
    console.log('[ÚLTIMA RODADA] Servidor indicou que estamos na última rodada');
    // Verificar se a rodada atual corresponde ao máximo
    if (round !== maxRounds) {
      console.log(`[CORREÇÃO] Atualizando rodada para corresponder à última: ${round} -> ${maxRounds}`);
      setRound(maxRounds);
    }
  });

  // Force final game status check on timer change - apenas na ÚLTIMA rodada (comparação ESTRITA)
  useEffect(() => {
    if (timer === 0 && isGameStarted && round === maxRounds) {
      console.log('[VERIFICAÇÃO] Timer zerado na última rodada - verificando fim de jogo');
      
      // Wait a bit to see if server sends game-ended
      setTimeout(() => {
        if (isGameStarted && !podium && round === maxRounds) {
          console.log('[CORREÇÃO] Forçando fim de jogo devido a timer zerado na última rodada');
          
          // Force show podium
          const finalPlayers = [...players].sort((a, b) => b.score - a.score);
          setPodium(finalPlayers);
          setIsGameStarted(false);
          
          // If host, notify server
          if (isCurrentUserHost) {
            console.log('[HOST] Notificando servidor sobre fim forçado do jogo');
            socketService.getSocket().emit('end-game', { roomCode });
          }
        }
      }, 3000);
    }
  }, [timer, round, maxRounds, isGameStarted, podium, isCurrentUserHost, players, roomCode]);

  // Add hacky global access to force show podium in case of problems
  useEffect(() => {
    // @ts-ignore
    window.forceShowPodium = () => {
      const forcedPodium = [...players].sort((a, b) => b.score - a.score);
      console.log('[HACK] Forçando exibição do pódio', forcedPodium);
      setPodium(forcedPodium);
      setIsGameStarted(false);
      return 'Pódio mostrado! Recarregue a página para voltar ao lobby.';
    };
    
    return () => {
      // @ts-ignore
      window.forceShowPodium = undefined;
    };
  }, [players]);

  // Utility function to force end game (callable from other hooks)
  const forceEndGame = useCallback(() => {
    console.log('[FORÇA] Forçando fim de jogo');
    const forcedPodium = [...players].sort((a, b) => b.score - a.score);
    setPodium(forcedPodium);
    setIsGameStarted(false);
    setIsDrawer(false);
    
    if (isCurrentUserHost) {
      socketService.getSocket().emit('end-game', { roomCode });
    }
  }, [players, isCurrentUserHost, roomCode]);

  // Add explicit monitoring for situations where game should have ended - comparação ESTRITA
  useEffect(() => {
    if (isGameStarted && round > maxRounds && !podium) {
      console.log('[CORREÇÃO] Rodada excedeu máximo sem exibir pódio - forçando fim');
      forceEndGame();
    }
  }, [round, maxRounds, isGameStarted, podium, forceEndGame]);

  // Adicionar função de diagnóstico completo para ajudar a depurar
  const logGameState = () => {
    console.log(`
      [DIAGNÓSTICO COMPLETO]
      Rodada atual: ${round}
      Total de rodadas: ${maxRounds}
      É última rodada? ${round === maxRounds}
      Jogo iniciado? ${isGameStarted}
      Pódio visível? ${podium !== null}
      Timer: ${timer}
      Desenhista: ${drawerId?.substring(0, 6) || 'nenhum'}
      Este cliente é desenhista? ${isDrawer}
      Este cliente é host? ${isCurrentUserHost}
      Número de jogadores: ${players.length}
    `);
  };

  // Registrar o estado a cada alteração de round ou maxRounds
  useEffect(() => {
    console.log(`[MUDANÇA DE RODADA] Rodada: ${round}/${maxRounds}`);
    logGameState();
  }, [round, maxRounds]);

  // Modify renderGameArea to ensure podium is always shown correctly
  const renderGameArea = () => {
    const isLastRoundActive = isLastRoundCheck();
    
    console.log('[RENDER] Área de jogo:', {
      isGameStarted,
      isDrawer,
      podium: podium ? true : false,
      timer,
      round,
      maxRounds,
      isLastRound: isLastRoundActive
    });
    
    // Verificar a consistência: se o jogo estiver em andamento mas o pódio estiver visível
    if (isGameStarted && podium !== null) {
      console.log('[CORREÇÃO] Pódio visível durante jogo ativo - isto não deveria acontecer');
      // Não renderizar o pódio neste caso
      return renderActiveGameArea();
    }
    
    // Mostrar pódio quando o jogo acabou
    if (podium) {
      return renderPodium();
    }
    
    return renderActiveGameArea();
  };

  // Função separada para renderizar o pódio
  const renderPodium = () => {
    console.log('[RENDER] Exibindo pódio final com', podium?.length || 0, 'jogadores');
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center relative">
        {/* Efeito especial para o fim do jogo */}
        <div className="absolute -top-6 left-0 right-0 text-center">
          <div className="inline-block bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400 text-white px-4 py-1 rounded-full font-bold animate-pulse">
            FIM DO JOGO
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-yellow-300 mb-4">🏆 Fim do Jogo 🏆</h2>
        
        <div className="bg-blue-900/50 rounded-lg p-4 mb-4">
          <h3 className="text-xl font-bold mb-3 text-white">Pontuações Finais</h3>
          
          <div className="grid gap-3">
            {podium && podium.length > 0 ? (
              podium.map((player, index) => (
                <div 
                  key={player.id || index} 
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
              ))
            ) : (
              <div className="text-yellow-300 p-4 text-center">
                Nenhum jogador encontrado. Algo deu errado!
              </div>
            )}
          </div>
        </div>
        
        {isCurrentUserHost && (
          <button
            onClick={() => {
              console.log('[HOST] Reiniciando jogo com', newRounds, 'rodadas');
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
  };

  // Função separada para renderizar a área de jogo ativa
  const renderActiveGameArea = () => {
    if (!isGameStarted) {
      // Jogo não iniciado
      return (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          <p className="text-xl mb-4">Aguardando início do jogo...</p>
          
          {/* Canvas invisível para pré-carregar */}
          <div className="hidden">
            <DrawingCanvas
              isDrawer={false}
              strokeColor={strokeColor}
              strokeWidth={strokeWidth}
              receivedPoints={[]}
            />
          </div>
          
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
      // Modo desenhista
      return (
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
            <p className="text-xl text-green-300 font-bold">Você é o desenhista!</p>
            <p className="text-xl mt-1 md:mt-0">
              <span className="mr-2">Palavra:</span>
              <span className="font-mono bg-yellow-200 text-blue-900 px-2 py-1 rounded">{word}</span>
            </p>
            {timer > 0 && (
              <div className="mt-2 md:mt-0 md:ml-2">
                <span className={`${round === maxRounds ? 'bg-orange-400' : 'bg-yellow-300'} text-blue-900 px-3 py-1 rounded-lg font-bold`}>
                  {round === maxRounds && <span className="mr-1">🔥</span>}
                  {timer}s
                  {round === maxRounds && <span className="ml-1">🔥</span>}
                </span>
                {round === maxRounds && (
                  <div className="mt-1 text-xs text-orange-300 font-bold animate-pulse">
                    ÚLTIMA RODADA!
                  </div>
                )}
              </div>
            )}
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
    
    // Modo espectador/adivinhação
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
        <p className="text-xl mb-2 text-blue-200 font-bold">
          {timer > 0 
            ? 'Adivinhe o desenho!' 
            : drawerId 
              ? 'Aguardando o desenhista desenhar...' 
              : 'Aguardando definição do desenhista...'}
        </p>
        
        {timer > 0 && (
          <div className="mt-1 mb-2">
            <span className={`${round === maxRounds ? 'bg-orange-400' : 'bg-yellow-300'} text-blue-900 px-3 py-1 rounded-lg font-bold`}>
              {round === maxRounds && <span className="mr-1">🔥</span>}
              {timer}s
              {round === maxRounds && <span className="ml-1">🔥</span>}
            </span>
            {round === maxRounds && (
              <div className="mt-1 text-xs text-orange-300 font-bold animate-pulse">
                ÚLTIMA RODADA!
              </div>
            )}
          </div>
        )}
        
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

  // Atualizar renderização do header para mostrar claramente a rodada atual
  const renderHeaderControls = () => {
    // Definir isLastRound dentro desta função para uso local
    const isLastRoundIndicator = round >= maxRounds;
    
    return (
      <div className={`flex flex-col items-center justify-center ${deviceType === 'mobile' ? 'gap-1 mb-1' : 'gap-2 mb-4'}`}>
        <div className={`flex ${deviceType === 'mobile' ? 'flex-row gap-1' : 'flex-row gap-3'} justify-center w-full`}>
          <div className="flex gap-2 justify-center">
            <button
              className={`bg-green-400 text-white ${deviceType === 'mobile' ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} rounded font-bold shadow hover:bg-green-500 transition flex items-center gap-1`}
              onClick={() => {
                const url = `https://desenharapido.netlify.app/entrar-sala?codigo=${roomCode}`;
                const texto = `Junta-te à minha sala! Clica aqui para entrar: ${url}`;
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(texto)}`;
                window.open(whatsappUrl, '_blank');
              }}
              title="Partilhar no WhatsApp"
            >
              <span role="img" aria-label="share">📱</span>
              <span>{deviceType === 'mobile' ? 'Convidar' : 'Convidar amigos'}</span>
            </button>
          </div>
          <button
            onClick={handleLeaveRoom}
            className={`bg-red-500 text-white ${deviceType === 'mobile' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'} rounded hover:bg-red-600 transition font-bold shadow flex items-center gap-1`}
          >
            <span role="img" aria-label="sair">🚪</span> {deviceType === 'mobile' ? 'Sair' : 'Sair da Sala'}
          </button>
        </div>
        
        <div className="flex flex-col items-center">
          <span className={`bg-blue-800 text-white ${deviceType === 'mobile' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} rounded-lg font-medium shadow flex items-center gap-1`}>
            <span role="img" aria-label="jogadores">👥</span> {players.length} {deviceType !== 'mobile' && 'jogadores'}
          </span>
          
          {isGameStarted && (
            <div className={`${deviceType === 'mobile' ? 'mt-1 text-sm' : 'mt-2 text-base'} font-bold ${isLastRoundIndicator ? 'text-orange-300' : 'text-yellow-200'}`}>
              Rodada: {round}/{maxRounds}
              {isLastRoundIndicator && <span className="ml-1 animate-pulse">🔥 ÚLTIMA! 🔥</span>}
            </div>
          )}
          
          <h1 className={`font-bold text-center ${deviceType === 'mobile' ? 'mt-0.5 text-base' : 'mt-1 text-xl sm:text-2xl'} break-all`}>
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

  // Adicionar função de renderização da lista de jogadores
  const renderPlayersList = () => {
    const socket = socketService.getSocket();
    const currentPlayerId = socket.id;
    
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
        <h2 className={`${deviceType === 'mobile' ? 'text-lg' : 'text-xl'} font-bold mb-2 text-center`}>Jogadores</h2>
        
        <div className={`overflow-y-auto ${deviceType === 'mobile' ? 'max-h-32' : 'max-h-96'}`}>
          {players.length === 0 ? (
            <p className="text-center py-2 text-white/60">Nenhum jogador na sala...</p>
          ) : (
            <div className="grid gap-2">
              {players.map((player) => {
                // Verificar se este jogador tem timer de reconexão e garantir que playerId existe
                const hasReconnectTimer = player.playerId && reconnectTimeouts[player.playerId] > 0;
                const reconnectTime = hasReconnectTimer ? reconnectTimeouts[player.playerId] : 0;
                
                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      player.online === false ? 'bg-red-500/20' : 
                      player.id === drawerId ? 'bg-green-500/30' : 
                      'bg-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {player.online === false && (
                        <span className="text-red-300" title="Desconectado">⚠️</span>
                      )}
                      {player.id === drawerId && (
                        <span className="text-green-300" title="Desenhista">✏️</span>
                      )}
                      <span className={`${player.online === false ? 'text-gray-400' : ''}`}>
                        {player.name}
                      </span>
                      {player.isHost && (
                        <span className="bg-yellow-300 text-blue-900 text-xs px-1 py-0.5 rounded">HOST</span>
                      )}
                      {/* Mostrar timer de reconexão para jogadores offline */}
                      {player.online === false && hasReconnectTimer && (
                        <span className="text-xs bg-red-800/50 text-white px-1 py-0.5 rounded">
                          {reconnectTime}s
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{player.score}</span>
                      {/* Adicionar botão de remover jogador quando usuário atual for host */}
                      {isCurrentUserHost && player.id !== currentPlayerId && (
                        <button 
                          onClick={() => handleRemovePlayer(player.id)}
                          className="text-red-400 hover:text-red-300 text-sm p-1"
                          title="Remover jogador"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Adicionar função para remover jogador (só pode ser chamada pelo host)
  const handleRemovePlayer = (playerId: string) => {
    if (!isCurrentUserHost || !roomCode) return;
    
    // Confirmar antes de remover
    if (window.confirm('Tem certeza que deseja remover este jogador?')) {
      console.log(`Host está removendo jogador ${playerId}`);
      socketService.removePlayer(roomCode, playerId)
        .then(() => console.log('Jogador removido com sucesso'))
        .catch(err => console.error('Erro ao remover jogador:', err));
    }
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
      
      {playerReconnected && (
        <div className="fixed top-0 left-0 w-full bg-green-500 text-white text-center py-2 z-50 font-bold animate-pulse">
          {playerReconnected.name} reconectou após {playerReconnected.timeDisconnected} segundos!
        </div>
      )}
      
      <div className={`flex-1 flex items-center justify-center w-full p-2 ${deviceType === 'mobile' ? 'py-1 px-1' : 'p-4'}`}>
        <div className={`w-full max-w-4xl flex flex-col items-center justify-center ${deviceType === 'mobile' ? 'space-y-1' : 'space-y-4'}`}>
          {/* Cabeçalho com controles */}
          {renderHeaderControls()}
          
          {/* Layout principal */}
          <div className={`w-full grid ${deviceType === 'desktop' ? 'grid-cols-[1fr_2fr]' : 'grid-cols-1'} ${deviceType === 'mobile' ? 'gap-2' : 'gap-4'}`}>
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
          {isGameStarted && timer > 0 && (
            <div className={`${deviceType === 'mobile' ? 'mb-1 text-xl' : 'mb-4 text-2xl'} font-bold text-yellow-300`}>
              Tempo restante: {timer}s
            </div>
          )}
        </div>
      </div>
      
      {/* Sistema unificado de notificações */}
      <div className="fixed z-40 bottom-4 right-4 flex flex-col gap-2 max-w-xs">
        {notifications.map(notification => {
          // Selecionar a cor com base no tipo
          const bgColorClass = 
            notification.type === 'join' || notification.type === 'reconnect' ? 'bg-green-500' :
            notification.type === 'leave' ? 'bg-red-500' :
            notification.type === 'drawer-left' ? 'bg-orange-500' :
            notification.type === 'host-left' ? 'bg-yellow-500' : 'bg-blue-500';
            
          const textColorClass = 
            notification.type === 'host-left' ? 'text-blue-900' : 'text-white';
            
          return (
            <div 
              key={notification.id}
              className={`${bgColorClass} ${textColorClass} px-4 py-2 rounded-lg shadow-lg animate-fade-in-out flex items-center`}
            >
              <span>{notification.message}</span>
            </div>
          );
        })}
      </div>
      
      {/* Componentes de overlay (modais, notificações) */}
      {winnerName && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`bg-green-500 text-white font-extrabold px-12 py-8 rounded-xl shadow-2xl border-4 border-white animate-pulse ${deviceType === 'mobile' ? 'text-2xl' : 'text-4xl'}`}>
            {winnerName} acertou a palavra!
          </div>
        </div>
      )}
      
      {/* Notificação quando jogador entra na sala */}
      {lastJoined && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-fade-in-out">
          {lastJoined} entrou na sala!
        </div>
      )}
      
      {/* Notificação quando jogador sai da sala */}
      {lastLeft && (
        <div className="fixed bottom-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-fade-in-out">
          {lastLeft} saiu da sala!
        </div>
      )}
      
      {/* Notificação quando desenhista sai */}
      {drawerLeft && (
        <div className="fixed top-16 inset-x-0 mx-auto w-fit bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-40 animate-bounce">
          ⚠️ {drawerLeft} desconectou-se! Aguardando reconexão...
        </div>
      )}
      
      {/* Notificação quando host sai */}
      {hostLeft && (
        <div className="fixed top-16 inset-x-0 mx-auto w-fit bg-yellow-500 text-blue-900 px-6 py-3 rounded-lg shadow-lg z-40 font-bold">
          {hostLeft} é o novo host da sala!
        </div>
      )}
      
      {roundEnded && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`bg-red-500 text-white font-extrabold px-12 py-8 rounded-xl shadow-2xl border-4 border-white animate-pulse ${deviceType === 'mobile' ? 'text-2xl' : 'text-4xl'}`}>
            Tempo esgotado!
          </div>
        </div>
      )}

      {/* Countdown entre rodadas com efeito visual atraente */}
      {countdown !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className={`flex flex-col items-center justify-center gap-4`}>
            <div className={`relative rounded-full flex items-center justify-center ${isLastRoundCountdown ? 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500' : 'bg-yellow-300'} text-blue-900 font-extrabold ${deviceType === 'mobile' ? 'w-36 h-36 text-6xl' : 'w-48 h-48 text-7xl'} ${countdown === 1 ? 'animate-bounce' : 'animate-pulse'}`} style={{ boxShadow: isLastRoundCountdown ? '0 0 20px 5px rgba(255, 165, 0, 0.5)' : 'none' }}>
              <div className="absolute inset-0 rounded-full opacity-20 animate-ping bg-white"></div>
              <div className={`absolute inset-0 rounded-full animate-spin-slow border-4 border-dashed ${isLastRoundCountdown ? 'border-orange-300' : 'border-white'} opacity-70`}></div>
              {countdown}
            </div>
            
            <div className={`text-white font-bold text-center ${deviceType === 'mobile' ? 'text-xl' : 'text-2xl'} transform ${isLastRoundCountdown ? 'scale-110' : ''} transition-transform`}>
              {isLastRoundCountdown ? (
                <span className="animate-pulse text-yellow-300" style={{ textShadow: '0 0 10px rgba(255, 165, 0, 0.8)' }}>
                  🔥 ÚLTIMA RODADA 🔥
                </span>
              ) : (
                <span>
                  Preparar para a rodada {round}/{maxRounds}
                  {round === maxRounds - 1 && <span className="mt-1 block text-sm text-yellow-300">(Próxima será a última!)</span>}
                </span>
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