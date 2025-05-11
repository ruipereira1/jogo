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

  // Funções de desenho
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawer) return;
    setDrawing(true);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLines(prev => [...prev, { points: [{ x, y }] }]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawer || !drawing) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setLines(prev => {
      const newLines = [...prev];
      newLines[newLines.length - 1].points.push({ x, y });
      return newLines;
    });
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
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    });
  }, [lines]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-400 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Sala: {roomCode}</h1>
          <span className="bg-blue-800 text-white px-4 py-2 rounded-lg font-semibold shadow ml-4">
            Jogadores na sala: {players.length}
          </span>
          <div className="flex gap-2">
            {isCurrentUserHost && !isGameStarted && (
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
              >
                Iniciar Jogo
              </button>
            )}
            <button 
              onClick={handleLeaveRoom}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            >
              Sair da Sala
            </button>
          </div>
        </div>

        {/* Lista de jogadores */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
          <h2 className="font-semibold mb-3">Jogadores ({players.length})</h2>
          <ul className="space-y-2">
            {players.map(player => (
              <li 
                key={player.id} 
                className={`flex items-center gap-2 p-2 bg-white/10 rounded ${drawerId === player.id ? 'border-2 border-yellow-300' : ''}`}
              >
                <span className="flex-1">{player.name}</span>
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
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={350}
                  className="border-2 border-yellow-300 bg-white rounded mb-4 cursor-crosshair"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
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
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={350}
                  className="border-2 border-yellow-300 bg-white rounded mb-4"
                  style={{ cursor: 'not-allowed' }}
                />
                <p className="text-sm opacity-70">O desenho aparecerá aqui em tempo real!</p>
                {/* Campo de palpite */}
                <form onSubmit={handleGuessSubmit} className="flex gap-2 mt-4 justify-center">
                  <input
                    type="text"
                    className="p-2 rounded text-blue-900 w-64"
                    placeholder={guessedCorrectly ? "Você já acertou!" : "Digite seu palpite..."}
                    value={guess}
                    onChange={e => setGuess(e.target.value)}
                    disabled={guessedCorrectly}
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    className="bg-yellow-300 text-blue-900 px-4 py-2 rounded font-semibold shadow hover:bg-yellow-400 transition"
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
              <div className={`order-1 text-7xl font-extrabold px-16 py-10 rounded-xl shadow-2xl border-4 border-white mb-2 ${round === maxRounds ? 'bg-gradient-to-r from-pink-500 via-yellow-400 to-red-500 text-white animate-bounce' : 'bg-blue-800 text-white animate-pulse'}`}
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
                  <div className="relative flex flex-col items-center">
                    <div className="absolute inset-0 bg-black/80 rounded-xl animate-pulse"></div>
                    <div className="relative z-10 px-12 py-8 rounded-xl border-8 border-pink-400 shadow-2xl bg-gradient-to-r from-yellow-400 via-pink-500 to-red-500 animate-bounce flex flex-col items-center">
                      <span className="text-7xl font-extrabold text-white drop-shadow-lg mb-4 flex items-center gap-4">
                        <span role='img' aria-label='trophy'>🏆</span>
                        ÚLTIMA RONDA!
                        <span role='img' aria-label='trophy'>🏆</span>
                      </span>
                      <span className="text-2xl text-yellow-100 font-bold mt-2 text-center">Dê o seu melhor, esta é a última chance!</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pódio final */}
        {podium && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/80">
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
      </div>
    </div>
  );
}

export default Sala; 