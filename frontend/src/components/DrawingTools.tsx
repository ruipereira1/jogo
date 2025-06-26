/**
 * Ferramentas de Desenho Avançadas
 * Sistema completo de ferramentas para o canvas
 */

import React, { useState } from 'react';

export interface DrawingTool {
  type: 'pen' | 'brush' | 'eraser' | 'marker' | 'spray' | 'line' | 'circle' | 'rectangle';
  color: string;
  size: number;
  opacity: number;
}

interface DrawingToolsProps {
  currentTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  disabled?: boolean;
}

const DrawingTools: React.FC<DrawingToolsProps> = ({
  currentTool,
  onToolChange,
  onClear,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  disabled = false
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  // Cores predefinidas populares
  const popularColors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#90EE90', '#ADD8E6'
  ];

  // Ferramentas básicas
  const basicTools = [
    { type: 'pen' as const, icon: '✏️', name: 'Caneta' },
    { type: 'brush' as const, icon: '🖌️', name: 'Pincel' },
    { type: 'marker' as const, icon: '🖍️', name: 'Marcador' },
    { type: 'eraser' as const, icon: '🧽', name: 'Borracha' }
  ];

  // Ferramentas avançadas
  const advancedTools = [
    { type: 'spray' as const, icon: '💨', name: 'Spray' },
    { type: 'line' as const, icon: '📏', name: 'Linha' },
    { type: 'circle' as const, icon: '⭕', name: 'Círculo' },
    { type: 'rectangle' as const, icon: '⬜', name: 'Retângulo' }
  ];

  const handleToolSelect = (type: DrawingTool['type']) => {
    onToolChange({
      ...currentTool,
      type
    });
  };

  const handleColorChange = (color: string) => {
    onToolChange({
      ...currentTool,
      color
    });
    setIsColorPickerOpen(false);
  };

  const handleSizeChange = (size: number) => {
    onToolChange({
      ...currentTool,
      size
    });
  };

  const handleOpacityChange = (opacity: number) => {
    onToolChange({
      ...currentTool,
      opacity
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-600">
      {/* Ferramentas Básicas */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ferramentas</h3>
        <div className="grid grid-cols-4 gap-2">
          {basicTools.map((tool) => (
            <button
              key={tool.type}
              onClick={() => handleToolSelect(tool.type)}
              disabled={disabled}
              className={`p-3 rounded-lg transition-all duration-200 flex flex-col items-center gap-1 ${
                currentTool.type === tool.type
                  ? 'bg-blue-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className="text-lg">{tool.icon}</span>
              <span className="text-xs font-medium">{tool.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ferramentas Avançadas */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvancedTools(!showAdvancedTools)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 hover:text-blue-500 transition-colors"
        >
          <span>{showAdvancedTools ? '▼' : '▶'}</span>
          Ferramentas Avançadas
        </button>
        
        {showAdvancedTools && (
          <div className="grid grid-cols-4 gap-2">
            {advancedTools.map((tool) => (
              <button
                key={tool.type}
                onClick={() => handleToolSelect(tool.type)}
                disabled={disabled}
                className={`p-3 rounded-lg transition-all duration-200 flex flex-col items-center gap-1 ${
                  currentTool.type === tool.type
                    ? 'bg-blue-500 text-white shadow-lg scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="text-lg">{tool.icon}</span>
                <span className="text-xs font-medium">{tool.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Seletor de Cor */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cor</h3>
        
        {/* Cor Atual */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
            disabled={disabled}
            className={`w-12 h-8 rounded-lg border-2 border-gray-300 dark:border-gray-600 ${
              disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-105'
            } transition-transform`}
            style={{ backgroundColor: currentTool.color }}
          />
          <input
            type="color"
            value={currentTool.color}
            onChange={(e) => handleColorChange(e.target.value)}
            disabled={disabled}
            className="w-8 h-8 rounded cursor-pointer"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
            {currentTool.color.toUpperCase()}
          </span>
        </div>

        {/* Cores Populares */}
        <div className="grid grid-cols-5 gap-1">
          {popularColors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              disabled={disabled}
              className={`w-8 h-8 rounded border-2 transition-all duration-200 ${
                currentTool.color === color
                  ? 'border-blue-500 scale-110'
                  : 'border-gray-300 dark:border-gray-600 hover:scale-105'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Tamanho do Pincel */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tamanho: {currentTool.size}px
        </h3>
        <input
          type="range"
          min="1"
          max="50"
          value={currentTool.size}
          onChange={(e) => handleSizeChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>1px</span>
          <span>25px</span>
          <span>50px</span>
        </div>
      </div>

      {/* Opacidade */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Opacidade: {Math.round(currentTool.opacity * 100)}%
        </h3>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={currentTool.opacity}
          onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>10%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Ações</h3>
        
        {/* Desfazer/Refazer */}
        <div className="flex gap-2">
          <button
            onClick={onUndo}
            disabled={disabled || !canUndo}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              disabled || !canUndo
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600'
            }`}
          >
            ↶ Desfazer
          </button>
          <button
            onClick={onRedo}
            disabled={disabled || !canRedo}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              disabled || !canRedo
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            ↷ Refazer
          </button>
        </div>

        {/* Limpar Canvas */}
        <button
          onClick={onClear}
          disabled={disabled}
          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            disabled
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          🗑️ Limpar Tudo
        </button>
      </div>

      {/* Preview da Ferramenta */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
        <div className="flex items-center justify-center h-16 bg-white dark:bg-gray-600 rounded border">
          <div
            className="rounded-full"
            style={{
              width: `${Math.max(currentTool.size, 4)}px`,
              height: `${Math.max(currentTool.size, 4)}px`,
              backgroundColor: currentTool.color,
              opacity: currentTool.opacity,
              border: currentTool.type === 'eraser' ? '2px dashed #666' : 'none'
            }}
          />
        </div>
        <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
          {basicTools.find(t => t.type === currentTool.type)?.name || 
           advancedTools.find(t => t.type === currentTool.type)?.name}
        </div>
      </div>
    </div>
  );
};

export default DrawingTools; 