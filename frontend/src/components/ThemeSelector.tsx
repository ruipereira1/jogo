/**
 * Componente Seletor de Temas
 * Permite ao usuário escolher entre diferentes temas visuais
 */

import React, { useState, useEffect } from 'react';
import { availableThemes, themeManager, Theme } from '../utils/themes';

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ isOpen, onClose }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themeManager.getCurrentTheme());

  useEffect(() => {
    const handleThemeChange = (theme: Theme) => {
      setCurrentTheme(theme);
    };

    themeManager.addThemeChangeListener(handleThemeChange);
    return () => themeManager.removeThemeChangeListener(handleThemeChange);
  }, []);

  const handleThemeSelect = (themeId: string) => {
    themeManager.setTheme(themeId);
  };

  const handleToggleDarkMode = () => {
    themeManager.toggleDarkMode();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            🎨 Escolher Tema
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modo Escuro Toggle */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Modo Escuro</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Alterna entre modo claro e escuro
              </div>
            </div>
            <button
              onClick={handleToggleDarkMode}
              className={`w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                currentTheme.id === 'dark' ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  currentTheme.id === 'dark' ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Temas Disponíveis */}
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">Temas Coloridos</h3>
          
          {availableThemes.map((theme) => (
            <div
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] ${
                currentTheme.id === theme.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Preview das cores do tema */}
                  <div className="flex gap-1">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: theme.colors.secondary }}
                    />
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: theme.colors.accent }}
                    />
                  </div>
                  
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {theme.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {theme.id === 'light' && 'Tema padrão claro'}
                      {theme.id === 'dark' && 'Tema padrão escuro'}
                      {theme.id === 'ocean' && 'Tons de azul e verde'}
                      {theme.id === 'sunset' && 'Cores quentes e vibrantes'}
                      {theme.id === 'forest' && 'Tons de verde natural'}
                    </div>
                  </div>
                </div>

                {/* Indicador de tema ativo */}
                {currentTheme.id === theme.id && (
                  <div className="text-blue-500 text-xl">
                    ✓
                  </div>
                )}
              </div>

              {/* Preview do gradiente */}
              <div
                className="mt-3 h-8 rounded-lg"
                style={{ background: theme.gradients.primary }}
              />
            </div>
          ))}
        </div>

        {/* Informações Adicionais */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="font-medium mb-1">💡 Dica:</div>
            <div>O tema selecionado será salvo automaticamente e aplicado em todas as suas sessões!</div>
          </div>
        </div>

        {/* Botão Fechar */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector; 