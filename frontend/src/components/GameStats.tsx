/**
 * Componente de Estatísticas do Jogo
 * Exibe informações detalhadas sobre performance e pontuação
 */

import React, { useState, useMemo } from 'react';

// Componentes de ícones simples para não depender de heroicons
const ChartBarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const TrophyIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FireIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
  </svg>
);

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  stats?: PlayerStats;
}

interface PlayerStats {
  totalGuesses: number;
  correctGuesses: number;
  averageResponseTime: number;
  fastestGuess: number;
  wordsDrawn: number;
  pointsFromDrawing: number;
  consecutiveCorrect: number;
  bestStreak: number;
}

interface WordHistoryEntry {
  round: number;
  word: string;
  drawer: string;
  guessedBy: string[];
  responseTime?: number;
  difficulty?: string;
}

interface GameStatsProps {
  players: Player[];
  wordHistory: WordHistoryEntry[];
  currentRound: number;
  maxRounds: number;
  isGameFinished: boolean;
  gameStats?: {
    totalWords: number;
    averageGuessTime: number;
    fastestGuess: number;
    slowestGuess: number;
  };
}

const GameStats: React.FC<GameStatsProps> = ({
  players,
  wordHistory,
  currentRound,
  maxRounds
}) => {
  const [activeTab, setActiveTab] = useState<'ranking' | 'history' | 'stats'>('ranking');

  // Calcular estatísticas dos jogadores
  const playerStatistics = useMemo(() => {
    return players.map(player => {
      const playerHistory = wordHistory.filter(entry => 
        entry.guessedBy.includes(player.name)
      );
      
      const responseTimes = playerHistory
        .map(entry => entry.responseTime)
        .filter(time => time !== undefined) as number[];

      const wordsDrawn = wordHistory.filter(entry => entry.drawer === player.name).length;

      return {
        ...player,
        stats: {
          totalGuesses: playerHistory.length,
          correctGuesses: playerHistory.length,
          averageResponseTime: responseTimes.length > 0 
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
            : 0,
          fastestGuess: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
          wordsDrawn,
          accuracy: playerHistory.length > 0 ? 100 : 0,
          pointsPerRound: player.score / Math.max(currentRound, 1)
        }
      };
    });
  }, [players, wordHistory, currentRound]);

  // Ranking ordenado
  const rankedPlayers = useMemo(() => {
    return [...playerStatistics].sort((a, b) => b.score - a.score);
  }, [playerStatistics]);

  // Estatísticas gerais do jogo
  const generalStats = useMemo(() => {
    const totalGuesses = wordHistory.reduce((sum, entry) => sum + entry.guessedBy.length, 0);
    const wordsWithGuesses = wordHistory.filter(entry => entry.guessedBy.length > 0);
    
    return {
      totalWords: wordHistory.length,
      totalGuesses,
      averageGuessesPerWord: wordHistory.length > 0 ? totalGuesses / wordHistory.length : 0,
      wordsGuessed: wordsWithGuesses.length,
      successRate: wordHistory.length > 0 ? (wordsWithGuesses.length / wordHistory.length) * 100 : 0,
      gamesProgress: (currentRound / maxRounds) * 100
    };
  }, [wordHistory, currentRound, maxRounds]);

  // Formatação de tempo
  const formatTime = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    const seconds = (milliseconds / 1000).toFixed(1);
    return `${seconds}s`;
  };



  // Ícone de medalha baseado na posição
  const getMedalIcon = (position: number) => {
    switch (position) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${position}`;
    }
  };

  const RankingTab = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-yellow-500" />
          Ranking
        </h3>
        <div className="text-sm text-gray-500">
          Ronda {currentRound} de {maxRounds}
        </div>
      </div>

      {rankedPlayers.map((player, index) => (
        <div
          key={player.id}
          className={`flex items-center justify-between p-3 rounded-lg border ${
            index === 0 ? 'bg-yellow-50 border-yellow-200' :
            index === 1 ? 'bg-gray-50 border-gray-200' :
            index === 2 ? 'bg-orange-50 border-orange-200' :
            'bg-white border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold">
              {getMedalIcon(index + 1)}
            </span>
            <div>
              <div className="font-semibold flex items-center gap-1">
                {player.name}
                {player.isHost && <span className="text-xs bg-blue-100 text-blue-600 px-1 rounded">HOST</span>}
              </div>
              <div className="text-sm text-gray-500">
                {player.stats?.pointsPerRound.toFixed(1)} pts/ronda
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-bold text-blue-600">
              {player.score}
            </div>
            <div className="text-xs text-gray-500">
              {player.stats?.correctGuesses || 0} acertos
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const HistoryTab = () => (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-blue-500" />
        Histórico de Palavras
      </h3>

      {wordHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhuma palavra foi jogada ainda
        </div>
      ) : (
        wordHistory.slice().reverse().map((entry, index) => (
          <div key={index} className="border rounded-lg p-3 bg-white">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-lg">
                  {entry.word}
                </div>
                <div className="text-sm text-gray-600">
                  Ronda {entry.round} • Desenhado por {entry.drawer}
                </div>
              </div>
              {entry.difficulty && (
                <span className={`px-2 py-1 rounded text-xs ${
                  entry.difficulty === 'facil' ? 'bg-green-100 text-green-600' :
                  entry.difficulty === 'medio' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-red-100 text-red-600'
                }`}>
                  {entry.difficulty}
                </span>
              )}
            </div>
            
            {entry.guessedBy.length > 0 ? (
              <div>
                <div className="text-sm text-gray-600 mb-1">
                  Acertaram ({entry.guessedBy.length}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {entry.guessedBy.map((guesser, idx) => (
                    <span
                      key={idx}
                      className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs"
                    >
                      {guesser}
                    </span>
                  ))}
                </div>
                {entry.responseTime && (
                  <div className="text-xs text-gray-500 mt-1">
                    Tempo médio: {formatTime(entry.responseTime)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-red-500">
                Ninguém acertou 😢
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  const StatsTab = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-green-500" />
        Estatísticas Gerais
      </h3>

      {/* Progresso do jogo */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Progresso do Jogo</span>
          <span className="text-sm text-gray-500">
            {currentRound}/{maxRounds} rondas
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${generalStats.gamesProgress}%` }}
          />
        </div>
      </div>

      {/* Estatísticas numéricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {generalStats.totalWords}
          </div>
          <div className="text-sm text-gray-600">Palavras Totais</div>
        </div>

        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-600">
            {generalStats.successRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Taxa de Sucesso</div>
        </div>

        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {generalStats.totalGuesses}
          </div>
          <div className="text-sm text-gray-600">Palpites Totais</div>
        </div>

        <div className="bg-white border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {generalStats.averageGuessesPerWord.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600">Média/Palavra</div>
        </div>
      </div>

      {/* Top performers */}
      <div className="bg-white border rounded-lg p-4">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <FireIcon className="w-4 h-4 text-red-500" />
          Destaques da Partida
        </h4>
        
        {playerStatistics.length > 0 && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>🏆 Maior pontuação:</span>
              <span className="font-semibold">
                {rankedPlayers[0]?.name} ({rankedPlayers[0]?.score} pts)
              </span>
            </div>
            
            {/* Jogador com mais acertos */}
            {(() => {
              const mostCorrect = playerStatistics.reduce((prev, current) => 
                (prev.stats?.correctGuesses || 0) > (current.stats?.correctGuesses || 0) ? prev : current
              );
              return (
                <div className="flex justify-between">
                  <span>🎯 Mais acertos:</span>
                  <span className="font-semibold">
                    {mostCorrect.name} ({mostCorrect.stats?.correctGuesses || 0})
                  </span>
                </div>
              );
            })()}

            {/* Resposta mais rápida */}
            {(() => {
              const fastest = playerStatistics
                .filter(p => p.stats?.fastestGuess && p.stats.fastestGuess > 0)
                .reduce((prev, current) => 
                  (prev.stats?.fastestGuess || Infinity) < (current.stats?.fastestGuess || Infinity) ? prev : current
                );
              
              return fastest.stats?.fastestGuess ? (
                <div className="flex justify-between">
                  <span>⚡ Mais rápido:</span>
                  <span className="font-semibold">
                    {fastest.name} ({formatTime(fastest.stats.fastestGuess)})
                  </span>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      {/* Tabs */}
      <div className="flex space-x-1 mb-4 bg-white rounded-lg p-1">
        {[
          { id: 'ranking', label: 'Ranking', icon: TrophyIcon },
          { id: 'history', label: 'Histórico', icon: ClockIcon },
          { id: 'stats', label: 'Estatísticas', icon: ChartBarIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'ranking' | 'history' | 'stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo das tabs */}
      <div className="min-h-[300px]">
        {activeTab === 'ranking' && <RankingTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'stats' && <StatsTab />}
      </div>
    </div>
  );
};

export default GameStats; 