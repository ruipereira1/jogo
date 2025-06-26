/**
 * Tutorial Interativo do ArteRápida
 * Guia passo a passo para novos jogadores
 */

import React, { useState, useEffect } from 'react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    type: 'click' | 'input' | 'wait';
    message: string;
  };
  skip?: boolean;
}

interface TutorialOverlayProps {
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentPage: 'home' | 'create-room' | 'join-room' | 'game';
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isActive,
  onComplete,
  onSkip,
  currentPage
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Passos do tutorial por página
  const tutorialSteps: Record<string, TutorialStep[]> = {
    home: [
      {
        id: 'welcome',
        title: 'Bem-vindo ao ArteRápida! 🎨',
        description: 'Este é um jogo divertido onde você desenha e adivinha palavras com amigos!',
        target: '',
        position: 'center'
      },
      {
        id: 'create-room',
        title: 'Criar uma Sala',
        description: 'Clique aqui para criar uma nova sala e convidar amigos para jogar.',
        target: '[data-tutorial="create-room"]',
        position: 'bottom',
        action: {
          type: 'click',
          message: 'Clique no botão "Criar Sala"'
        }
      },
      {
        id: 'join-room',
        title: 'Entrar em Sala',
        description: 'Se você tem um código de sala, clique aqui para entrar em uma partida existente.',
        target: '[data-tutorial="join-room"]',
        position: 'bottom'
      },
      {
        id: 'features',
        title: 'Funcionalidades',
        description: 'O jogo suporta até 8 jogadores, tem 3 níveis de dificuldade e funciona perfeitamente no celular!',
        target: '[data-tutorial="features"]',
        position: 'top'
      }
    ],
    'create-room': [
      {
        id: 'room-settings',
        title: 'Configurações da Sala',
        description: 'Aqui você pode definir o número de rodadas e a dificuldade das palavras.',
        target: '[data-tutorial="room-settings"]',
        position: 'right'
      },
      {
        id: 'difficulty',
        title: 'Níveis de Dificuldade',
        description: 'Fácil: palavras simples • Médio: um pouco mais difícil • Difícil: desafio máximo!',
        target: '[data-tutorial="difficulty"]',
        position: 'bottom'
      },
      {
        id: 'create-button',
        title: 'Criar a Sala',
        description: 'Quando estiver pronto, clique aqui para criar sua sala de jogo.',
        target: '[data-tutorial="create-button"]',
        position: 'top'
      }
    ],
    'join-room': [
      {
        id: 'room-code',
        title: 'Código da Sala',
        description: 'Digite o código de 6 caracteres que seu amigo compartilhou com você.',
        target: '[data-tutorial="room-code"]',
        position: 'bottom',
        action: {
          type: 'input',
          message: 'Digite um código de sala'
        }
      },
      {
        id: 'player-name',
        title: 'Seu Nome',
        description: 'Escolha um nome que os outros jogadores verão durante a partida.',
        target: '[data-tutorial="player-name"]',
        position: 'bottom'
      }
    ],
    game: [
      {
        id: 'game-overview',
        title: 'Como Jogar',
        description: 'Em cada rodada, um jogador desenha uma palavra enquanto os outros tentam adivinhar!',
        target: '',
        position: 'center'
      },
      {
        id: 'canvas',
        title: 'Área de Desenho',
        description: 'Quando for sua vez, use esta área para desenhar a palavra que aparecer.',
        target: '[data-tutorial="canvas"]',
        position: 'right'
      },
      {
        id: 'drawing-tools',
        title: 'Ferramentas de Desenho',
        description: 'Use estas ferramentas para mudar cor, tamanho do pincel e muito mais!',
        target: '[data-tutorial="drawing-tools"]',
        position: 'left'
      },
      {
        id: 'guess-input',
        title: 'Adivinhar Palavra',
        description: 'Digite suas tentativas aqui. Seja rápido para ganhar mais pontos!',
        target: '[data-tutorial="guess-input"]',
        position: 'top'
      },
      {
        id: 'players-list',
        title: 'Lista de Jogadores',
        description: 'Veja aqui quem está jogando e a pontuação atual de cada um.',
        target: '[data-tutorial="players-list"]',
        position: 'left'
      },
      {
        id: 'timer',
        title: 'Cronômetro',
        description: 'Cada rodada tem tempo limitado. Fique de olho aqui!',
        target: '[data-tutorial="timer"]',
        position: 'bottom'
      }
    ]
  };

  const currentSteps = tutorialSteps[currentPage] || [];
  const currentStep = currentSteps[currentStepIndex];

  useEffect(() => {
    if (isActive && currentSteps.length > 0) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isActive, currentSteps.length]);

  const nextStep = () => {
    if (currentStepIndex < currentSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const completeTutorial = () => {
    setIsVisible(false);
    localStorage.setItem('arterapida-tutorial-completed', 'true');
    onComplete();
  };

  const skipTutorial = () => {
    setIsVisible(false);
    localStorage.setItem('arterapida-tutorial-skipped', 'true');
    onSkip();
  };

  const getTooltipPosition = (target: string, position: string) => {
    if (!target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const element = document.querySelector(target);
    if (!element) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const rect = element.getBoundingClientRect();
    const tooltip = {
      top: 0,
      left: 0,
      transform: ''
    };

    switch (position) {
      case 'top':
        tooltip.top = rect.top - 20;
        tooltip.left = rect.left + rect.width / 2;
        tooltip.transform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        tooltip.top = rect.bottom + 20;
        tooltip.left = rect.left + rect.width / 2;
        tooltip.transform = 'translate(-50%, 0)';
        break;
      case 'left':
        tooltip.top = rect.top + rect.height / 2;
        tooltip.left = rect.left - 20;
        tooltip.transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        tooltip.top = rect.top + rect.height / 2;
        tooltip.left = rect.right + 20;
        tooltip.transform = 'translate(0, -50%)';
        break;
      default:
        tooltip.top = window.innerHeight / 2;
        tooltip.left = window.innerWidth / 2;
        tooltip.transform = 'translate(-50%, -50%)';
    }

    return {
      top: `${tooltip.top}px`,
      left: `${tooltip.left}px`,
      transform: tooltip.transform
    };
  };

  if (!isVisible || !currentStep) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Overlay escuro */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Destacar elemento atual */}
      {currentStep.target && (
        <div 
          className="absolute border-4 border-yellow-400 rounded-lg shadow-lg bg-white/10 pointer-events-none"
          style={{
            ...((() => {
              const element = document.querySelector(currentStep.target);
              if (!element) return {};
              const rect = element.getBoundingClientRect();
              return {
                top: `${rect.top - 4}px`,
                left: `${rect.left - 4}px`,
                width: `${rect.width + 8}px`,
                height: `${rect.height + 8}px`
              };
            })())
          }}
        />
      )}

      {/* Tooltip do tutorial */}
      <div
        className="absolute pointer-events-auto animate-fade-in"
        style={getTooltipPosition(currentStep.target, currentStep.position)}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-600 max-w-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {currentStep.title}
            </h3>
            <button
              onClick={skipTutorial}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
            >
              Pular
            </button>
          </div>

          {/* Descrição */}
          <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Ação requerida */}
          {currentStep.action && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                📝 {currentStep.action.message}
              </div>
            </div>
          )}

          {/* Indicador de progresso */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Passo {currentStepIndex + 1} de {currentSteps.length}</span>
              <span>{Math.round(((currentStepIndex + 1) / currentSteps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStepIndex + 1) / currentSteps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Botões de navegação */}
          <div className="flex justify-between gap-2">
            <button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentStepIndex === 0
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              ← Anterior
            </button>

            <button
              onClick={nextStep}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              {currentStepIndex === currentSteps.length - 1 ? 'Finalizar 🎉' : 'Próximo →'}
            </button>
          </div>

          {/* Dica adicional */}
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Você pode pular o tutorial a qualquer momento
          </div>
        </div>

        {/* Seta indicadora */}
        {currentStep.target && currentStep.position !== 'center' && (
          <div
            className={`absolute w-0 h-0 ${
              currentStep.position === 'top' ? 'border-l-8 border-r-8 border-t-8 border-transparent border-t-white dark:border-t-gray-800 top-full left-1/2 transform -translate-x-1/2' :
              currentStep.position === 'bottom' ? 'border-l-8 border-r-8 border-b-8 border-transparent border-b-white dark:border-b-gray-800 bottom-full left-1/2 transform -translate-x-1/2' :
              currentStep.position === 'left' ? 'border-t-8 border-b-8 border-l-8 border-transparent border-l-white dark:border-l-gray-800 left-full top-1/2 transform -translate-y-1/2' :
              'border-t-8 border-b-8 border-r-8 border-transparent border-r-white dark:border-r-gray-800 right-full top-1/2 transform -translate-y-1/2'
            }`}
          />
        )}
      </div>
    </div>
  );
};

export default TutorialOverlay; 