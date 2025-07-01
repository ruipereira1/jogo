/**
 * Componente Canvas Otimizado para ArteRápida
 * Suporte avançado para desenho e performance melhorada
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// Função debounce genérica e com tipagem segura
const debounce = <F extends (...args: never[]) => unknown>(
  func: F,
  wait: number
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;

  return function executedFunction(...args: Parameters<F>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
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
      ? 'crosshair'
      : 'default',
    touchAction: 'none' // Prevenir scroll no mobile
  }), [isDrawer, disabled]);

  // Função para atualizar o tamanho do canvas
  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(rect.width - 20, 600);
      const newHeight = Math.floor(newWidth * 0.7);
      
      setCanvasSize({ width: newWidth, height: newHeight });
    }
  }, []);

  // Memoize a função debounced para evitar recriação
  const updateCanvasSize = useMemo(() => debounce(handleResize, 100), [handleResize]);

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
    if (to.pressure && to.pressure > 0) {
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

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    lines.forEach(line => {
      const denormalizedPoints = line.points.map(p => denormalizePoint(p, canvasSize));
      for (let i = 1; i < denormalizedPoints.length; i++) {
        drawLineSegment(denormalizedPoints[i - 1], denormalizedPoints[i], line.tool);
      }
    });
  }, [lines, canvasSize, denormalizePoint, drawLineSegment]);

  // Redesenhar canvas quando lines ou tamanho mudam
  useEffect(() => {
    redrawCanvas();
  }, [lines, canvasSize, redrawCanvas]);

  // Obter coordenadas precisas do mouse/touch
  const getEventPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX: number, clientY: number, pressure = 0.5;

    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
      // Tentativa de acessar força do toque (3D Touch/Force Touch)
      pressure = (touch as Touch & { force?: number }).force || 0.5;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
      // Tentativa de acessar pressão do stylus
      pressure = (e as React.MouseEvent & { pressure?: number }).pressure || 0.5;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      pressure
    };
  }, []);

  // Início do desenho
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || disabled) return;

    e.preventDefault();
    setIsDrawing(true);
    
    const point = getEventPoint(e);
    setCurrentLine([point]);
  }, [isDrawer, disabled, getEventPoint]);

  // Desenhar linha
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !isDrawer || disabled) return;

    e.preventDefault();
    const point = getEventPoint(e);
    
    setCurrentLine(prev => {
      const newLine = [...prev, point];
      if (prev.length > 0) {
        drawLineSegment(prev[prev.length - 1], point, currentTool);
      }
      return newLine;
    });
  }, [isDrawing, isDrawer, disabled, getEventPoint, currentTool, drawLineSegment]);

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

  // Ferramentas de desenho
  const ToolSelector = useMemo(() => (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg mb-2">
      {/* Tipo de ferramenta */}
      <div className="flex gap-1">
        {['pen', 'brush', 'marker', 'eraser'].map((tool) => (
          <button
            key={tool}
            onClick={() => setCurrentTool(prev => ({ ...prev, type: tool as DrawingTool['type'] }))}
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