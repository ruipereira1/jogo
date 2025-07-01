/**
 * Dashboard Personalizado do Jogador
 * Estatísticas detalhadas e progresso do jogador
 */

import React, { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';

interface PlayerStats {
  totalGames: number;
  totalWins: number;
  totalCorrectGuesses: number;
  totalDrawnWords: number;
  fastestGuessTime: number;
  longestStreak: number;
  totalScore: number;
  averageScore: number;
  perfectGames: number;
  artisticGames: number;
  favoriteCategory: string;
  totalPlayTime: number;
  weeklyGames: number;
  monthlyGames: number;
  level: number;
  xp: number;
  nextLevelXP: number;
  serverStats?: {
    totalRooms: number;
    privateRooms: number;
    publicRooms: number;
    activeGames: number;
    waitingRooms: number;
    totalPlayers: number;
    averagePlayersPerRoom: number;
  };
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: Date | null;
  progress: number;
  maxProgress: number;
}

interface PlayerDashboardProps {
  playerName: string;
  stats: PlayerStats;
  achievements: Achievement[];
  onClose: () => void;
}

const PlayerDashboard: React.FC<PlayerDashboardProps> = ({
  playerName,
  stats: initialStats,
  achievements,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'achievements' | 'progress'>('overview');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('week');
  const [stats, setStats] = useState<PlayerStats>(initialStats);
  const [loadingServerStats, setLoadingServerStats] = useState(false);

  // Carregar estatísticas do servidor
  useEffect(() => {
    const loadServerStats = async () => {
      try {
        setLoadingServerStats(true);
        const response = await apiService.getGlobalStats();
        
        if (response.success && response.stats) {
          setStats(prevStats => ({
            ...prevStats,
            serverStats: response.stats
          }));
        }
      } catch (error) {
        console.log('Estatísticas do servidor não disponíveis:', error);
      } finally {
        setLoadingServerStats(false);
      }
    };

    loadServerStats();
  }, []);

  // Calcular estatísticas derivadas
  const derivedStats = useMemo(() => {
    const winRate = stats.totalGames > 0 ? (stats.totalWins / stats.totalGames) * 100 : 0;
    const guessAccuracy = stats.totalGames > 0 ? (stats.totalCorrectGuesses / stats.totalGames) * 100 : 0;
    const artistSuccessRate = stats.totalDrawnWords > 0 ? (stats.artisticGames / stats.totalDrawnWords) * 100 : 0;
    const levelProgress = stats.nextLevelXP > 0 ? (stats.xp / stats.nextLevelXP) * 100 : 100;
    
    return {
      winRate,
      guessAccuracy,
      artistSuccessRate,
      levelProgress,
      gamesPerDay: stats.totalGames > 0 ? stats.totalPlayTime / (stats.totalGames * 60) : 0,
      averageGuessTime: stats.totalCorrectGuesses > 0 ? stats.fastestGuessTime : 0
    };
  }, [stats]);

  // Conquistas por categoria
  const achievementCategories = useMemo(() => {
    const categories = {
      gameplay: achievements.filter(a => ['first_win', 'speed_demon', 'streak_master'].includes(a.id)),
      artistic: achievements.filter(a => ['artist', 'picasso', 'perfectionist'].includes(a.id)),
      social: achievements.filter(a => ['veteran', 'ambassador'].includes(a.id)),
      special: achievements.filter(a => !['first_win', 'speed_demon', 'streak_master', 'artist', 'picasso', 'perfectionist', 'veteran', 'ambassador'].includes(a.id))
    };
    
    return categories;
  }, [achievements]);

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Saudação personalizada */}
      <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl">
        <div className="text-4xl mb-2">👋</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Olá, {playerName}!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Você está no nível {stats.level} • {stats.xp} XP
        </p>
        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${derivedStats.levelProgress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {stats.nextLevelXP - stats.xp} XP para o próximo nível
        </p>
      </div>

      {/* Estatísticas principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <div className="text-2xl text-green-500 mb-1">🏆</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalWins}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Vitórias</div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
            {derivedStats.winRate.toFixed(1)}% taxa
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <div className="text-2xl text-blue-500 mb-1">🎯</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCorrectGuesses}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Acertos</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {derivedStats.guessAccuracy.toFixed(1)}% precisão
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <div className="text-2xl text-purple-500 mb-1">🎨</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalDrawnWords}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Desenhos</div>
          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            {derivedStats.artistSuccessRate.toFixed(1)}% sucesso
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
          <div className="text-2xl text-yellow-500 mb-1">⚡</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.longestStreak}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Sequência</div>
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            Melhor série
          </div>
        </div>
      </div>

      {/* Progresso recente */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          📈 Progresso Recente
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-blue-500">{stats.weeklyGames}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Jogos esta semana</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-green-500">{stats.monthlyGames}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Jogos este mês</div>
          </div>
          
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-purple-500">
              {Math.floor(stats.totalPlayTime / 60)}h
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Tempo total</div>
          </div>
        </div>
      </div>

      {/* Conquistas recentes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          🏅 Conquistas Recentes
        </h3>
        
        <div className="space-y-3">
          {achievements
            .filter(a => a.unlockedAt)
            .sort((a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0))
            .slice(0, 3)
            .map(achievement => (
              <div key={achievement.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">{achievement.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{achievement.description}</div>
                </div>
                <div className="text-xs text-gray-400">
                  {achievement.unlockedAt?.toLocaleDateString()}
                </div>
              </div>
            ))}
          
          {achievements.filter(a => a.unlockedAt).length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🎯</div>
              <p>Suas conquistas aparecerão aqui!</p>
              <p className="text-sm">Continue jogando para desbloquear.</p>
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas do servidor */}
      {stats.serverStats && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            🌐 Estado do Servidor
            {loadingServerStats && (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent" />
            )}
          </h3>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {stats.serverStats.activeGames}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">Jogos Ativos</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {stats.serverStats.totalPlayers}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">Jogadores Online</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {stats.serverStats.publicRooms}
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400">Salas Públicas</div>
            </div>
            
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.serverStats.averagePlayersPerRoom.toFixed(1)}
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Média/Sala</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const StatsTab = () => (
    <div className="space-y-6">
      {/* Filtro de tempo */}
      <div className="flex justify-center">
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
          {(['week', 'month', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {range === 'week' ? 'Semana' : range === 'month' ? 'Mês' : 'Tudo'}
            </button>
          ))}
        </div>
      </div>

      {/* Estatísticas detalhadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Performance no jogo */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🎮 Performance</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Taxa de Vitória</span>
              <span className="font-semibold text-green-600">{derivedStats.winRate.toFixed(1)}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Precisão dos Palpites</span>
              <span className="font-semibold text-blue-600">{derivedStats.guessAccuracy.toFixed(1)}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Sucesso como Artista</span>
              <span className="font-semibold text-purple-600">{derivedStats.artistSuccessRate.toFixed(1)}%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Pontuação Média</span>
              <span className="font-semibold text-yellow-600">{stats.averageScore.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Velocidade e timing */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚡ Velocidade</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Palpite Mais Rápido</span>
              <span className="font-semibold text-green-600">
                {stats.fastestGuessTime > 0 ? `${(stats.fastestGuessTime / 1000).toFixed(1)}s` : '-'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Maior Sequência</span>
              <span className="font-semibold text-yellow-600">{stats.longestStreak}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Jogos Perfeitos</span>
              <span className="font-semibold text-purple-600">{stats.perfectGames}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Categoria Favorita</span>
              <span className="font-semibold text-blue-600">{stats.favoriteCategory}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de progresso simulado */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 Progresso ao Longo do Tempo</h3>
        
        <div className="h-32 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="text-2xl mb-2">📈</div>
            <p>Gráfico de progresso</p>
            <p className="text-sm">(Em desenvolvimento)</p>
          </div>
        </div>
      </div>
    </div>
  );

  const AchievementsTab = () => (
    <div className="space-y-6">
      {Object.entries(achievementCategories).map(([category, categoryAchievements]) => (
        <div key={category} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 capitalize">
            {category === 'gameplay' ? '🎮 Jogabilidade' :
             category === 'artistic' ? '🎨 Artístico' :
             category === 'social' ? '👥 Social' : '⭐ Especiais'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryAchievements.map(achievement => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  achievement.unlockedAt
                    ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`text-2xl ${achievement.unlockedAt ? '' : 'grayscale opacity-50'}`}>
                    {achievement.icon}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className={`font-medium ${
                      achievement.unlockedAt ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {achievement.title}
                    </h4>
                    
                    <p className={`text-sm mt-1 ${
                      achievement.unlockedAt ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {achievement.description}
                    </p>
                    
                    {achievement.unlockedAt ? (
                      <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                        ✓ Desbloqueado em {achievement.unlockedAt.toLocaleDateString()}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>Progresso</span>
                          <span>{achievement.progress}/{achievement.maxProgress}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard do Jogador
          </h1>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Visão Geral', icon: '📊' },
              { id: 'stats', label: 'Estatísticas', icon: '📈' },
              { id: 'achievements', label: 'Conquistas', icon: '🏆' },
              { id: 'progress', label: 'Progresso', icon: '🎯' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'overview' | 'stats' | 'achievements' | 'progress')}
                className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'stats' && <StatsTab />}
          {activeTab === 'achievements' && <AchievementsTab />}
          {activeTab === 'progress' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🚧</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Em Desenvolvimento
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Esta funcionalidade estará disponível em breve!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerDashboard;