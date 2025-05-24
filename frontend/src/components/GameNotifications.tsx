import React, { useState, useEffect } from 'react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
}

interface GameNotificationsProps {
  notifications: Notification[];
  onRemoveNotification: (id: string) => void;
}

const GameNotifications: React.FC<GameNotificationsProps> = ({
  notifications,
  onRemoveNotification
}) => {
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          onRemoveNotification(notification.id);
        }, notification.duration);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications, onRemoveNotification]);

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-400';
      case 'warning':
        return 'bg-yellow-500 border-yellow-400';
      case 'error':
        return 'bg-red-500 border-red-400';
      default:
        return 'bg-blue-500 border-blue-400';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getNotificationStyle(notification.type)} text-white p-4 rounded-lg shadow-lg border-l-4 animate-slide-in`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                <h4 className="font-semibold text-sm">{notification.title}</h4>
              </div>
              <p className="text-sm opacity-90">{notification.message}</p>
            </div>
            
            <button
              onClick={() => onRemoveNotification(notification.id)}
              className="ml-2 text-white hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Hook para gerenciar notificações
export const useGameNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000 // 5 segundos por padrão
    };
    
    setNotifications(prev => [...prev, newNotification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // Funções de conveniência
  const notifyPlayerJoined = (playerName: string, isSpectator = false) => {
    addNotification({
      type: 'success',
      title: isSpectator ? 'Espectador Entrou' : 'Jogador Entrou',
      message: `${playerName} ${isSpectator ? 'entrou como espectador' : 'entrou na sala'}`,
      duration: 3000
    });
  };

  const notifyPlayerLeft = (playerName: string, wasSpectator = false) => {
    addNotification({
      type: 'warning',
      title: wasSpectator ? 'Espectador Saiu' : 'Jogador Saiu',
      message: `${playerName} saiu da sala`,
      duration: 3000
    });
  };

  const notifyDrawerLeft = (drawerName: string) => {
    addNotification({
      type: 'error',
      title: 'Desenhista Saiu',
      message: `${drawerName} (desenhista) saiu da sala. Avançando para próxima ronda...`,
      duration: 5000
    });
  };

  const notifyGamePaused = (reason: string) => {
    addNotification({
      type: 'warning',
      title: 'Jogo Pausado',
      message: reason,
      duration: 0 // Não remove automaticamente
    });
  };

  const notifyGameResumed = () => {
    addNotification({
      type: 'success',
      title: 'Jogo Retomado',
      message: 'O jogo foi retomado!',
      duration: 3000
    });
    
    // Remover notificação de pausa
    setNotifications(prev => prev.filter(n => n.title !== 'Jogo Pausado'));
  };

  const notifyGameCancelled = () => {
    addNotification({
      type: 'error',
      title: 'Jogo Cancelado',
      message: 'O jogo foi cancelado pelo anfitrião',
      duration: 5000
    });
    
    // Limpar outras notificações
    clearNotifications();
  };

  const notifyHostChanged = (newHostName: string) => {
    addNotification({
      type: 'info',
      title: 'Novo Anfitrião',
      message: `${newHostName} é agora o anfitrião da sala`,
      duration: 4000
    });
  };

  const notifySpectatorPromoted = (playerName: string) => {
    addNotification({
      type: 'success',
      title: 'Espectador Promovido',
      message: `${playerName} entrou no jogo!`,
      duration: 3000
    });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    // Funções de conveniência
    notifyPlayerJoined,
    notifyPlayerLeft,
    notifyDrawerLeft,
    notifyGamePaused,
    notifyGameResumed,
    notifyGameCancelled,
    notifyHostChanged,
    notifySpectatorPromoted
  };
};

export default GameNotifications; 