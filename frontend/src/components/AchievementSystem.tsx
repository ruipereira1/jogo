/**
 * Sistema de Conquistas e Níveis
 * Gamificação para manter os jogadores engajados
 */

import React, { useState, useEffect, useMemo } from 'react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'bronze' | 'silver' | 'gold' | 'platinum';
  condition: (stats: PlayerGameStats) => boolean;
  points: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
}

interface PlayerGameStats {
  totalGames: number;
  totalCorrectGuesses: number;
  totalDrawnWords: number;
  fastestGuessTime: number;
  longestStreak: number;
  totalScore: number;
  averageScore: number;
  wordsGuessedInOrder: number;
  perfectGames: number; // Jogos onde acertou todas as palavras
  artisticGames: number; // Jogos onde todas suas palavras foram adivinhadas
}

interface Level {
  level: number;
  title: string;
  description: string;
  minXP: number;
  maxXP: number;
  color: string;
  icon: string;
  rewards: string[];
}

interface AchievementSystemProps {
  playerStats: PlayerGameStats;
  onAchievementUnlocked?: (achievement: Achievement) => void;
}

const AchievementSystem: React.FC<AchievementSystemProps> = ({
  playerStats,
  onAchievementUnlocked
}) => {
  const [unlockedAchievements, setUnlockedAchievements] = useState<Achievement[]>([]);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Definir conquistas disponíveis
  const achievements: Achievement[] = useMemo(() => [
    {
      id: 'first_win',
      title: 'Primeira Vitória! 🏆',
      description: 'Ganhe seu primeiro jogo',
      icon: '🏆',
      type: 'bronze',
      condition: (stats) => stats.totalGames > 0 && stats.totalScore > 0,
      points: 50,
      isUnlocked: false
    },
    {
      id: 'speed_demon',
      title: 'Demônio da Velocidade ⚡',
      description: 'Adivinhe uma palavra em menos de 3 segundos',
      icon: '⚡',
      type: 'silver',
      condition: (stats) => stats.fastestGuessTime > 0 && stats.fastestGuessTime < 3000,
      points: 100,
      isUnlocked: false
    },
    {
      id: 'artist',
      title: 'Artista Nato 🎨',
      description: 'Desenhe 10 palavras que foram adivinhadas',
      icon: '🎨',
      type: 'silver',
      condition: (stats) => stats.totalDrawnWords >= 10,
      points: 100,
      isUnlocked: false
    },
    {
      id: 'detective',
      title: 'Detetive 🔍',
      description: 'Acerte 50 palavras',
      icon: '🔍',
      type: 'gold',
      condition: (stats) => stats.totalCorrectGuesses >= 50,
      points: 200,
      isUnlocked: false
    },
    {
      id: 'streak_master',
      title: 'Mestre da Sequência 🔥',
      description: 'Acerte 5 palavras seguidas',
      icon: '🔥',
      type: 'gold',
      condition: (stats) => stats.longestStreak >= 5,
      points: 200,
      isUnlocked: false
    },
    {
      id: 'perfectionist',
      title: 'Perfeccionista 💎',
      description: 'Complete um jogo acertando todas as palavras',
      icon: '💎',
      type: 'platinum',
      condition: (stats) => stats.perfectGames >= 1,
      points: 500,
      isUnlocked: false
    },
    {
      id: 'picasso',
      title: 'Picasso Digital 🖼️',
      description: 'Tenha todas as suas palavras adivinhadas em um jogo',
      icon: '🖼️',
      type: 'platinum',
      condition: (stats) => stats.artisticGames >= 1,
      points: 500,
      isUnlocked: false
    },
    {
      id: 'veteran',
      title: 'Veterano 🎖️',
      description: 'Jogue 100 partidas',
      icon: '🎖️',
      type: 'platinum',
      condition: (stats) => stats.totalGames >= 100,
      points: 1000,
      isUnlocked: false
    }
  ], []);

  // Definir níveis disponíveis
  const levels: Level[] = useMemo(() => [
    { level: 1, title: 'Novato', description: 'Bem-vindo ao ArteRápida!', minXP: 0, maxXP: 100, color: '#8B5CF6', icon: '🌱', rewards: ['Acesso básico'] },
    { level: 2, title: 'Aprendiz', description: 'Está a aprender!', minXP: 100, maxXP: 300, color: '#06B6D4', icon: '📚', rewards: ['Novas cores de pincel'] },
    { level: 3, title: 'Artista', description: 'Tem jeito para isto!', minXP: 300, maxXP: 600, color: '#10B981', icon: '🎨', rewards: ['Ferramentas avançadas'] },
    { level: 4, title: 'Especialista', description: 'Conhece bem o jogo!', minXP: 600, maxXP: 1200, color: '#F59E0B', icon: '⭐', rewards: ['Temas personalizados'] },
    { level: 5, title: 'Mestre', description: 'Um verdadeiro mestre!', minXP: 1200, maxXP: 2000, color: '#EF4444', icon: '👑', rewards: ['Salas VIP'] },
    { level: 6, title: 'Lenda', description: 'Uma lenda do ArteRápida!', minXP: 2000, maxXP: 5000, color: '#7C3AED', icon: '🏆', rewards: ['Status de lenda'] },
    { level: 7, title: 'Imortal', description: 'Alcançou a imortalidade!', minXP: 5000, maxXP: Infinity, color: '#F97316', icon: '💫', rewards: ['Reconhecimento eterno'] }
  ], []);

  // Calcular XP total baseado nas conquistas
  const totalXP = useMemo(() => {
    return unlockedAchievements.reduce((sum, achievement) => sum + achievement.points, 0);
  }, [unlockedAchievements]);

  // Calcular nível atual
  const currentLevel = useMemo(() => {
    return levels.find(level => totalXP >= level.minXP && totalXP < level.maxXP) || levels[levels.length - 1];
  }, [totalXP, levels]);

  // Calcular progresso para próximo nível
  const progressToNextLevel = useMemo(() => {
    if (currentLevel.level === levels.length) return 100; // Nível máximo
    
    const progressInCurrentLevel = totalXP - currentLevel.minXP;
    const totalXPInCurrentLevel = currentLevel.maxXP - currentLevel.minXP;
    
    return (progressInCurrentLevel / totalXPInCurrentLevel) * 100;
  }, [currentLevel, totalXP, levels]);

  // Verificar novas conquistas quando stats mudam
  useEffect(() => {
    achievements.forEach(achievement => {
      const isAlreadyUnlocked = unlockedAchievements.some(unlocked => unlocked.id === achievement.id);
      
      if (!isAlreadyUnlocked && achievement.condition(playerStats)) {
        const unlockedAchievement = {
          ...achievement,
          isUnlocked: true,
          unlockedAt: new Date()
        };
        
        setUnlockedAchievements(prev => [...prev, unlockedAchievement]);
        setNewAchievement(unlockedAchievement);
        setShowAchievementModal(true);
        
        // Notificar parent component
        onAchievementUnlocked?.(unlockedAchievement);
        
        // Auto-fechar modal após 3 segundos
        setTimeout(() => {
          setShowAchievementModal(false);
        }, 3000);
      }
    });
  }, [playerStats, achievements, unlockedAchievements, onAchievementUnlocked]);

  // Obter cor baseada no tipo de conquista
  const getAchievementColor = (type: Achievement['type']) => {
    switch (type) {
      case 'bronze': return 'from-yellow-600 to-yellow-800';
      case 'silver': return 'from-gray-400 to-gray-600';
      case 'gold': return 'from-yellow-400 to-yellow-600';
      case 'platinum': return 'from-purple-400 to-purple-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const LevelDisplay = () => (
    <div className="bg-white rounded-lg p-4 border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{currentLevel.icon}</div>
          <div>
            <h3 className="font-bold text-lg" style={{ color: currentLevel.color }}>
              Nível {currentLevel.level}: {currentLevel.title}
            </h3>
            <p className="text-sm text-gray-600">{currentLevel.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{totalXP}</div>
          <div className="text-xs text-gray-500">XP Total</div>
        </div>
      </div>
      
      {/* Barra de progresso */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${progressToNextLevel}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-gray-500">
        <span>Nível {currentLevel.level}</span>
        {currentLevel.level < levels.length && (
          <span>Próximo nível: {currentLevel.maxXP - totalXP} XP</span>
        )}
      </div>
    </div>
  );

  const AchievementGrid = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {achievements.map(achievement => {
        const isUnlocked = unlockedAchievements.some(unlocked => unlocked.id === achievement.id);
        
        return (
          <div
            key={achievement.id}
            className={`relative p-4 rounded-lg border transition-all duration-300 ${
              isUnlocked 
                ? `bg-gradient-to-br ${getAchievementColor(achievement.type)} text-white shadow-lg transform hover:scale-105`
                : 'bg-gray-100 text-gray-500 border-gray-300'
            }`}
          >
            <div className="text-center">
              <div className={`text-3xl mb-2 ${isUnlocked ? '' : 'grayscale opacity-50'}`}>
                {achievement.icon}
              </div>
              <h4 className={`font-semibold text-sm mb-1 ${isUnlocked ? 'text-white' : 'text-gray-700'}`}>
                {achievement.title}
              </h4>
              <p className={`text-xs ${isUnlocked ? 'text-gray-100' : 'text-gray-500'}`}>
                {achievement.description}
              </p>
              <div className={`mt-2 text-xs font-bold ${isUnlocked ? 'text-yellow-200' : 'text-gray-400'}`}>
                +{achievement.points} XP
              </div>
            </div>
            
            {!isUnlocked && (
              <div className="absolute inset-0 bg-gray-500 bg-opacity-30 rounded-lg flex items-center justify-center">
                <div className="text-2xl">🔒</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Modal de nova conquista
  const AchievementModal = () => (
    showAchievementModal && newAchievement && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-sm mx-4 text-center animate-bounce">
          <div className="text-6xl mb-4">{newAchievement.icon}</div>
          <h2 className="text-2xl font-bold text-yellow-600 mb-2">
            Conquista Desbloqueada!
          </h2>
          <h3 className="text-xl font-semibold mb-2">
            {newAchievement.title}
          </h3>
          <p className="text-gray-600 mb-4">
            {newAchievement.description}
          </p>
          <div className="text-lg font-bold text-blue-600">
            +{newAchievement.points} XP
          </div>
          <button
            onClick={() => setShowAchievementModal(false)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Continuar
          </button>
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <LevelDisplay />
      
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🏆 Conquistas
          <span className="text-sm font-normal text-gray-500">
            ({unlockedAchievements.length}/{achievements.length})
          </span>
        </h2>
        <AchievementGrid />
      </div>

      <AchievementModal />
    </div>
  );
};

export default AchievementSystem; 