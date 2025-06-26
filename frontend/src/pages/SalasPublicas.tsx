/**
 * Página de Salas Públicas
 * Visualizar e entrar em salas públicas disponíveis
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socket';
import { apiService, PublicRoom } from '../services/api';

function SalasPublicas() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState({
    difficulty: 'all',
    category: 'all',
    hasSpace: false
  });

  useEffect(() => {
    loadPublicRooms();
    
    // Atualizar a cada 10 segundos
    const interval = setInterval(loadPublicRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadPublicRooms = async () => {
    try {
      setRefreshing(true);
      
      // Usar o service da API
      const response = await apiService.getPublicRooms();
      
      if (response.success && response.rooms) {
        setRooms(response.rooms);
        setError('');
      } else {
        setError(response.error || 'Erro ao carregar salas');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
      console.error('Erro ao carregar salas públicas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const joinRoom = async (roomCode: string) => {
    const user = socketService.getUser();
    if (!user) {
      navigate('/');
      return;
    }

    try {
      navigate(`/entrar-sala/${roomCode}`);
    } catch (err) {
      setError('Erro ao entrar na sala');
      console.error(err);
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    return apiService.formatDifficulty(difficulty);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'facil': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'medio': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'dificil': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getCategoryLabel = (category: string) => {
    return apiService.formatCategory(category);
  };

  const getTimeAgo = (timestamp: number) => {
    return apiService.formatTimeAgo(timestamp);
  };

  // Filtrar salas
  const filteredRooms = rooms.filter(room => {
    if (filter.difficulty !== 'all' && room.difficulty !== filter.difficulty) return false;
    if (filter.category !== 'all' && room.category !== filter.category) return false;
    if (filter.hasSpace && room.players >= room.maxPlayers) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-700 to-blue-400 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">🌐 Salas Públicas</h1>
            <p className="text-blue-100">Encontre e entre em salas abertas para jogar!</p>
          </div>
          
          <button
            onClick={() => navigate('/')}
            className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2"
          >
            ← Voltar
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6">
          <h3 className="font-semibold mb-3">Filtros</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Dificuldade */}
            <div>
              <label className="block text-sm font-medium mb-2">Dificuldade</label>
              <select
                value={filter.difficulty}
                onChange={(e) => setFilter(prev => ({ ...prev, difficulty: e.target.value }))}
                className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/70"
              >
                <option value="all" className="text-gray-900">Todas</option>
                <option value="facil" className="text-gray-900">Fácil</option>
                <option value="medio" className="text-gray-900">Médio</option>
                <option value="dificil" className="text-gray-900">Difícil</option>
              </select>
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-medium mb-2">Categoria</label>
              <select
                value={filter.category}
                onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
                className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/70"
              >
                <option value="all" className="text-gray-900">Todas</option>
                <option value="animais" className="text-gray-900">Animais</option>
                <option value="objetos" className="text-gray-900">Objetos</option>
                <option value="comida" className="text-gray-900">Comida</option>
                <option value="profissoes" className="text-gray-900">Profissões</option>
                <option value="lugares" className="text-gray-900">Lugares</option>
                <option value="transporte" className="text-gray-900">Transporte</option>
                <option value="tecnologia" className="text-gray-900">Tecnologia</option>
              </select>
            </div>

            {/* Opções */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.hasSpace}
                  onChange={(e) => setFilter(prev => ({ ...prev, hasSpace: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Apenas com vagas</span>
              </label>
              
              <button
                onClick={loadPublicRooms}
                disabled={refreshing}
                className="ml-auto bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {refreshing ? '🔄' : '🔄'} Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* Lista de Salas */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <p>Carregando salas...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-red-200 mb-4">{error}</p>
            <button
              onClick={loadPublicRooms}
              className="bg-red-500 hover:bg-red-600 px-6 py-2 rounded-lg transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🏠</div>
            <p className="mb-2">Nenhuma sala encontrada</p>
            <p className="text-blue-200 text-sm">Tente ajustar os filtros ou criar uma nova sala</p>
            <button
              onClick={() => navigate('/criar-sala')}
              className="mt-4 bg-yellow-500 hover:bg-yellow-600 px-6 py-2 rounded-lg transition-colors text-gray-900 font-medium"
            >
              Criar Nova Sala
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRooms.map((room) => (
              <div
                key={room.code}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">#{room.code}</h3>
                      
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(room.difficulty)}`}>
                        {getDifficultyLabel(room.difficulty)}
                      </span>
                      
                      {room.category !== 'all' && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 rounded-full text-xs font-medium">
                          {getCategoryLabel(room.category)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-blue-100">
                      <span>👥 {room.players}/{room.maxPlayers} jogadores</span>
                      <span>🎮 Host: {room.host}</span>
                      <span>⏰ {getTimeAgo(room.createdAt)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => joinRoom(room.code)}
                    disabled={room.players >= room.maxPlayers}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      room.players >= room.maxPlayers
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {room.players >= room.maxPlayers ? 'Cheia' : 'Entrar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estatísticas */}
        <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{rooms.length}</div>
              <div className="text-sm text-blue-200">Salas Disponíveis</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">
                {rooms.reduce((sum, room) => sum + room.players, 0)}
              </div>
              <div className="text-sm text-blue-200">Jogadores Online</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">
                {filteredRooms.filter(room => room.players < room.maxPlayers).length}
              </div>
              <div className="text-sm text-blue-200">Com Vagas</div>
            </div>
            
            <div>
              <div className="text-2xl font-bold">
                {rooms.length > 0 ? Math.round(rooms.reduce((sum, room) => sum + room.players, 0) / rooms.length) : 0}
              </div>
              <div className="text-sm text-blue-200">Média/Sala</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalasPublicas; 