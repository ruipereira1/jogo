/**
 * Componente Canvas Otimizado para ArteRápida
 * Suporte avançado para desenho e performance melhorada
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// Função debounce simples para não depender de lodash
const debounce = (func: Function, wait: number) => {
  let timeout: number;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
};

interface CanvasProps {
  isDrawer: boolean;
  onDraw: (data: DrawingData) => void;
  lines: DrawingLine[];
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}

interface Point {
  x: number;
  y: number;
  pressure?: number; // Suporte para pressure-sensitive drawing
}

export interface DrawingLine {
  points: Point[];
  tool: DrawingTool;
  timestamp: number;
}

export interface DrawingTool {
  type: 'pen' | 'brush' | 'eraser' | 'marker';
  color: string;
  size: number;
  opacity: number;
}

export interface DrawingData {
  type: 'draw' | 'erase' | 'clear';
  line?: DrawingLine;
  tool?: DrawingTool;
}

const Canvas: React.FC<CanvasProps> = ({
  isDrawer,
  onDraw,
  lines,
  onClear,
  disabled = false,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLine, setCurrentLine] = useState<Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 350 });
  const [currentTool, setCurrentTool] = useState<DrawingTool>({
    type: 'pen',
    color: '#000000',
    size: 3,
    opacity: 1
  });

  // Performance: usar useMemo para calcular propriedades do canvas
  const canvasStyle = useMemo(() => ({
    cursor: isDrawer && !disabled 
      ? currentTool.type === 'eraser' ? 'crosshair' : 'crosshair'
      : 'default',
    touchAction: 'none' // Prevenir scroll no mobile
  }), [isDrawer, disabled, currentTool.type]);

  // Função debounced para atualizar tamanho do canvas
  const updateCanvasSize = useCallback(
    debounce(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = Math.min(rect.width - 20, 600);
        const newHeight = Math.floor(newWidth * 0.7);
        
        setCanvasSize({ width: newWidth, height: newHeight });
      }
    }, 100),
    []
  );

  // Redimensionar canvas responsivamente
  useEffect(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    window.addEventListener('orientationchange', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      window.removeEventListener('orientationchange', updateCanvasSize);
    };
  }, [updateCanvasSize]);

  // Redesenhar canvas quando lines ou tamanho mudam
  useEffect(() => {
    redrawCanvas();
  }, [lines, canvasSize]);

  // Normalizar coordenadas para diferentes tamanhos de tela
  const normalizePoint = useCallback((point: Point, fromSize = canvasSize): Point => {
    return {
      x: point.x / fromSize.width,
      y: point.y / fromSize.height,
      pressure: point.pressure
    };
  }, [canvasSize]);

  const denormalizePoint = useCallback((point: Point, toSize = canvasSize): Point => {
    return {
      x: point.x * toSize.width,
      y: point.y * toSize.height,
      pressure: point.pressure
    };
  }, [canvasSize]);

  // Obter coordenadas precisas do mouse/touch
  const getEventPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number, pressure = 1;

    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
      pressure = (touch as any).force || 1; // Suporte para 3D Touch
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
      pressure = (e as any).pressure || 1; // Suporte para stylus
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      pressure
    };
  }, []);

  // Início do desenho
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer || disabled) return;

    e.preventDefault();
    setIsDrawing(true);
    
    const point = getEventPoint(e);
    setCurrentLine([point]);
  }, [isDrawer, disabled, getEventPoint]);

  // Desenhar linha
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer || disabled) return;

    e.preventDefault();
    const point = getEventPoint(e);
    
    setCurrentLine(prev => {
      const newLine = [...prev, point];
      drawLineSegment(prev[prev.length - 1], point, currentTool);
      return newLine;
    });
  }, [isDrawing, isDrawer, disabled, getEventPoint, currentTool]);

  // Finalizar desenho
  const stopDrawing = useCallback(() => {
    if (!isDrawing || currentLine.length === 0) return;

    setIsDrawing(false);
    
    // Normalizar pontos para envio
    const normalizedLine: DrawingLine = {
      points: currentLine.map(point => normalizePoint(point)),
      tool: currentTool,
      timestamp: Date.now()
    };

    onDraw({
      type: 'draw',
      line: normalizedLine,
      tool: currentTool
    });

    setCurrentLine([]);
  }, [isDrawing, currentLine, normalizePoint, currentTool, onDraw]);

  // Desenhar segmento de linha no canvas
  const drawLineSegment = useCallback((from: Point | null, to: Point, tool: DrawingTool) => {
    const canvas = canvasRef.current;
    if (!canvas || !from) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    
    // Configurar ferramenta
    if (tool.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = tool.size * 2;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = tool.color;
      ctx.lineWidth = tool.size;
      ctx.globalAlpha = tool.opacity;
    }

    // Configurações de qualidade
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Variar largura baseado na pressão (se disponível)
    if (to.pressure && to.pressure !== 1) {
      ctx.lineWidth *= to.pressure;
    }

    // Desenhar linha suave usando curvas quadráticas
    ctx.beginPath();
    const midPoint = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2
    };
    
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(from.x, from.y, midPoint.x, midPoint.y);
    ctx.stroke();
    
    ctx.restore();
  }, []);

  // Redesenhar todo o canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redesenhar todas as linhas
    lines.forEach(line => {
      if (line.points.length < 2) return;

      const denormalizedPoints = line.points.map(point => denormalizePoint(point));
      
      ctx.save();
      
      if (line.tool.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = line.tool.size * 2;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = line.tool.color;
        ctx.lineWidth = line.tool.size;
        ctx.globalAlpha = line.tool.opacity;
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(denormalizedPoints[0].x, denormalizedPoints[0].y);
      
      for (let i = 1; i < denormalizedPoints.length; i++) {
        const point = denormalizedPoints[i];
        const prevPoint = denormalizedPoints[i - 1];
        
        const midPoint = {
          x: (prevPoint.x + point.x) / 2,
          y: (prevPoint.y + point.y) / 2
        };
        
        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midPoint.x, midPoint.y);
      }
      
      ctx.stroke();
      ctx.restore();
    });
  }, [lines, denormalizePoint]);

  // Ferramentas de desenho
  const ToolSelector = useMemo(() => (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg mb-2">
      {/* Tipo de ferramenta */}
      <div className="flex gap-1">
        {['pen', 'brush', 'marker', 'eraser'].map((tool) => (
          <button
            key={tool}
            onClick={() => setCurrentTool(prev => ({ ...prev, type: tool as any }))}
            className={`px-2 py-1 rounded text-xs ${
              currentTool.type === tool 
                ? 'bg-blue-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            title={tool === 'pen' ? 'Caneta' : 
                   tool === 'brush' ? 'Pincel' :
                   tool === 'marker' ? 'Marcador' : 'Borracha'}
          >
            {tool === 'pen' ? '✏️' : 
             tool === 'brush' ? '🖌️' :
             tool === 'marker' ? '🖊️' : '🧹'}
          </button>
        ))}
      </div>

      {/* Cor */}
      {currentTool.type !== 'eraser' && (
        <input
          type="color"
          value={currentTool.color}
          onChange={(e) => setCurrentTool(prev => ({ ...prev, color: e.target.value }))}
          className="w-8 h-8 rounded border-none cursor-pointer"
          title="Cor"
        />
      )}

      {/* Tamanho */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-600">Tamanho:</span>
        <input
          type="range"
          min="1"
          max="20"
          value={currentTool.size}
          onChange={(e) => setCurrentTool(prev => ({ ...prev, size: parseInt(e.target.value) }))}
          className="w-16"
        />
        <span className="text-xs text-gray-600 w-6">{currentTool.size}</span>
      </div>

      {/* Limpar */}
      <button
        onClick={onClear}
        className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
        title="Limpar desenho"
      >
        🗑️ Limpar
      </button>
    </div>
  ), [currentTool, onClear]);

  return (
    <div ref={containerRef} className={`flex flex-col ${className}`}>
      {isDrawer && !disabled && ToolSelector}
      
      <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={canvasStyle}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="block"
        />
        
        {disabled && (
          <div className="absolute inset-0 bg-gray-500 bg-opacity-30 flex items-center justify-center">
            <span className="text-white font-semibold">🔒 Aguarde sua vez</span>
          </div>
        )}
      </div>

      {/* Informações do canvas */}
      <div className="text-xs text-gray-500 mt-1 text-center">
        Canvas: {canvasSize.width}x{canvasSize.height} | 
        Linhas: {lines.length} | 
        Ferramenta: {currentTool.type} ({currentTool.size}px)
      </div>
    </div>
  );
};

export default Canvas; 