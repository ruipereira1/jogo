import React, { useState } from 'react';

interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isSpectator?: boolean;
}

interface PlayerManagerProps {
  players: Player[];
  currentUserId: string;
  isHost: boolean;
  gameStatus: 'waiting' | 'playing' | 'paused' | 'finished';
  onPromoteSpectator: (playerId: string) => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onCancelGame: () => void;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({
  players,
  currentUserId,
  isHost,
  gameStatus,
  onPromoteSpectator,
  onPauseGame,
  onResumeGame,
  onCancelGame
}) => {
  const [showControls, setShowControls] = useState(false);
  
  const activePlayers = players.filter(p => !p.isSpectator);
  const spectators = players.filter(p => p.isSpectator);
  const currentUser = players.find(p => p.id === currentUserId);
  const isCurrentUserSpectator = currentUser?.isSpectator || false;

  return (
    <div className="bg-white bg-opacity-10 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-white">
          👥 Jogadores ({activePlayers.length})
        </h3>
        
        {isHost && gameStatus !== 'waiting' && (
          <button
            onClick={() => setShowControls(!showControls)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm transition-all"
          >
            ⚙️ Controles
          </button>
        )}
      </div>

      {/* Status do jogo */}
      <div className="mb-3 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${
          gameStatus === 'playing' ? 'bg-green-500' :
          gameStatus === 'paused' ? 'bg-yellow-500' :
          gameStatus === 'waiting' ? 'bg-blue-500' : 'bg-gray-500'
        }`}></div>
        <span className="text-white text-sm">
          {gameStatus === 'playing' && '🎮 Jogo em andamento'}
          {gameStatus === 'paused' && '⏸️ Jogo pausado'}
          {gameStatus === 'waiting' && '⏳ Aguardando início'}
          {gameStatus === 'finished' && '🏁 Jogo terminado'}
        </span>
        
        {isCurrentUserSpectator && (
          <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs">
            👁️ Espectador
          </span>
        )}
      </div>

      {/* Controles do Host */}
      {isHost && showControls && gameStatus !== 'waiting' && (
        <div className="bg-black bg-opacity-20 rounded-lg p-3 mb-3">
          <h4 className="text-white font-semibold mb-2">🎮 Controles do Anfitrião</h4>
          <div className="flex flex-wrap gap-2">
            {gameStatus === 'playing' && (
              <button
                onClick={onPauseGame}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm transition-all"
              >
                ⏸️ Pausar
              </button>
            )}
            
            {gameStatus === 'paused' && (
              <button
                onClick={onResumeGame}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-all"
              >
                ▶️ Retomar
              </button>
            )}
            
            <button
              onClick={onCancelGame}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-all"
            >
              ❌ Cancelar Jogo
            </button>
          </div>
        </div>
      )}

      {/* Lista de Jogadores Ativos */}
      <div className="space-y-2 mb-4">
        {activePlayers.map((player, index) => (
          <div 
            key={player.id}
            className={`flex items-center justify-between p-2 rounded-lg ${
              player.id === currentUserId ? 'bg-blue-500 bg-opacity-30' : 'bg-white bg-opacity-10'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">
                {index + 1}. {player.name}
              </span>
              {player.isHost && (
                <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs">
                  👑 Anfitrião
                </span>
              )}
              {player.id === currentUserId && (
                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs">
                  Você
                </span>
              )}
            </div>
            <div className="text-white font-bold">
              {player.score} pts
            </div>
          </div>
        ))}
      </div>

      {/* Lista de Espectadores */}
      {spectators.length > 0 && (
        <div>
          <h4 className="text-white font-semibold mb-2">
            👁️ Espectadores ({spectators.length})
          </h4>
          <div className="space-y-1">
            {spectators.map((spectator) => (
              <div 
                key={spectator.id}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  spectator.id === currentUserId ? 'bg-purple-500 bg-opacity-30' : 'bg-white bg-opacity-10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white">👁️ {spectator.name}</span>
                  {spectator.id === currentUserId && (
                    <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-xs">
                      Você
                    </span>
                  )}
                </div>
                
                {isHost && gameStatus === 'paused' && (
                  <button
                    onClick={() => onPromoteSpectator(spectator.id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs transition-all"
                  >
                    ⬆️ Promover
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instruções para espectadores */}
      {isCurrentUserSpectator && (
        <div className="mt-3 bg-purple-500 bg-opacity-20 border border-purple-500 rounded-lg p-3">
          <p className="text-white text-sm">
            👁️ <strong>Modo Espectador:</strong> Você pode assistir ao jogo, mas não pode desenhar ou fazer palpites. 
            {isHost ? ' Use os controles para pausar e promover espectadores.' : ' Aguarde o anfitrião promovê-lo para jogador ativo.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlayerManager; 