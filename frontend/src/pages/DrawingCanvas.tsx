import React, { useRef, useEffect, useState } from 'react';

interface Point { x: number; y: number; }

interface Props {
  onDraw?: (point: Point) => void;
  isDrawer: boolean;
  onStartLine?: () => void;
  onEndLine?: () => void;
  onClear?: () => void;
  strokeColor?: string;
  strokeWidth?: number;
  onColorChange?: (color: string) => void;
  onWidthChange?: (width: number) => void;
}

const COLORS = ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080', '#A52A2A', '#808080'];
const WIDTHS = [1, 3, 5, 8, 12];

const DrawingCanvas: React.FC<Props> = ({ 
  onDraw, 
  isDrawer, 
  onStartLine, 
  onEndLine,
  onClear,
  strokeColor = '#222',
  strokeWidth = 3,
  onColorChange,
  onWidthChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolboxRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [touchActive, setTouchActive] = useState(false);

  // Detectar se é dispositivo móvel
  useEffect(() => {
    const detectMobile = () => {
      const isMobile = window.innerWidth < 768 || 
                       /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isMobile);
    };
    
    detectMobile();
    window.addEventListener('resize', detectMobile);
    
    return () => window.removeEventListener('resize', detectMobile);
  }, []);

  // Fechar ferramentas quando clicar fora delas
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (
        showTools && 
        toolboxRef.current && 
        !toolboxRef.current.contains(e.target as Node) &&
        canvasRef.current && 
        !canvasRef.current.contains(e.target as Node)
      ) {
        setShowTools(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showTools]);

  // Prevenir scroll quando estiver desenhando em dispositivo móvel
  useEffect(() => {
    const preventScroll = (e: Event) => {
      if (drawing.current && isDrawer) {
        e.preventDefault();
      }
    };

    const options = { passive: false };
    
    // Adicionar ao document para capturar em qualquer lugar
    if (isDrawer) {
      document.addEventListener('touchmove', preventScroll, options);
      document.addEventListener('touchstart', preventScroll, options);
    }
    
    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('touchstart', preventScroll);
    };
  }, [isDrawer]);

  // Função para desenhar um ponto no canvas - modificada para desenhar linhas
  const drawPoint = (x: number, y: number, color: string = strokeColor || '#222', width: number = strokeWidth || 3) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Canvas não encontrado em DrawingCanvas');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('Contexto 2d não encontrado em DrawingCanvas');
      return;
    }
    
    // Coordenadas reais no canvas
    const canvasX = x * canvas.width;
    const canvasY = y * canvas.height;
    
    console.log('DrawingCanvas.drawPoint:', { x, y, color, canvasX, canvasY, isDrawer });
    
    // Se for o primeiro ponto de uma linha, apenas armazene-o
    if (!lastPoint.current) {
      // Para ponto individual, desenhe um círculo
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, width/2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Desenha uma linha do último ponto até este
      ctx.beginPath();
      
      // Ponto anterior
      const prevX = lastPoint.current.x * canvas.width;
      const prevY = lastPoint.current.y * canvas.height;
      
      // Configurar estilo da linha
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Desenhar a linha
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(canvasX, canvasY);
      ctx.stroke();
    }
    
    // Atualizar último ponto
    lastPoint.current = { x, y };
    
    // Notificar a sala sobre o ponto APENAS se for o desenhista
    if (isDrawer) {
      console.log('DrawingCanvas enviando ponto:', x, y);
      onDraw?.({ x, y });
    }
  };

  // Limpar o canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastPoint.current = null;  // Resetar o último ponto
    onClear?.();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    drawing.current = true;
    setTouchActive(true);
    lastPoint.current = null;  // Resetar o último ponto para começar nova linha
    onStartLine?.();
    
    // Desenhar ponto inicial
    drawPoint(x, y);
    
    // Desativar temporariamente o scroll da página
    if (containerRef.current) {
      containerRef.current.style.overflowY = 'hidden';
      containerRef.current.style.touchAction = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawer || !drawing.current) return;
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    // Desenhar ponto
    drawPoint(x, y);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    
    drawing.current = false;
    setTouchActive(false);
    lastPoint.current = null;  // Resetar último ponto ao terminar a linha
    onEndLine?.();
    
    // Reativar o scroll da página
    if (containerRef.current) {
      containerRef.current.style.overflowY = '';
      containerRef.current.style.touchAction = '';
    }
  };

  // Handlers de desenho com mouse
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawer || e.pointerType === 'touch') return;
    e.preventDefault();
    
    drawing.current = true;
    lastPoint.current = null;  // Resetar o último ponto para começar nova linha
    onStartLine?.();
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Desenhar ponto inicial
    drawPoint(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawer || !drawing.current || e.pointerType === 'touch') return;
    e.preventDefault();
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Desenhar ponto
    drawPoint(x, y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawer || e.pointerType === 'touch') return;
    e.preventDefault();
    
    drawing.current = false;
    lastPoint.current = null;  // Resetar último ponto ao terminar a linha
    onEndLine?.();
  };

  const toggleTools = (e: React.MouseEvent) => {
    if (isDrawer) {
      // Impedir que cliques dentro da caixa de ferramentas fechem ela
      e.stopPropagation();
      setShowTools(!showTools);
    }
  };

  const handleColorSelect = (color: string) => {
    onColorChange && onColorChange(color);
  };

  const handleWidthSelect = (width: number) => {
    onWidthChange && onWidthChange(width);
  };

  return (
    <div className="relative" ref={containerRef}>
      {isDrawer && touchActive && (
        <div className="absolute inset-0 pointer-events-none z-10 border-4 border-yellow-300 rounded-lg opacity-50"></div>
      )}
      
      {isDrawer && isMobileDevice && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-100 text-blue-900 px-2 py-1 rounded text-xs text-center">
          Modo touch ativo - desenhe sem preocupação com scroll
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        width={500}
        height={350}
        style={{ 
          width: '100%', 
          maxWidth: 500, 
          background: 'white', 
          borderRadius: 8, 
          border: '2px solid #FFD600',
          cursor: isDrawer ? 'crosshair' : 'default',
          touchAction: isDrawer ? 'none' : 'auto' // Prevenir scroll em touch devices
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={toggleTools}
      />
      
      {isDrawer && showTools && (
        <div 
          ref={toolboxRef}
          className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow flex flex-wrap gap-2 items-center"
          onClick={(e) => e.stopPropagation()} // Evitar que cliques na caixa de ferramentas passem para o canvas
        >
          <div className="flex gap-1 flex-wrap">
            {COLORS.map(color => (
              <button
                key={color}
                className={`w-8 h-8 rounded-full ${color === strokeColor ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleColorSelect(color);
                }}
                title={`Cor ${color}`}
              />
            ))}
          </div>
          
          <div className="border-l pl-2 ml-1 flex gap-1 flex-wrap">
            {WIDTHS.map(width => (
              <button
                key={width}
                className={`w-8 h-8 rounded flex items-center justify-center bg-gray-100 ${width === strokeWidth ? 'ring-2 ring-blue-500' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleWidthSelect(width);
                }}
                title={`Traço ${width}px`}
              >
                <div
                  style={{
                    width: `${Math.min(width * 2, 20)}px`,
                    height: `${width}px`,
                    backgroundColor: 'black',
                    borderRadius: '4px'
                  }}
                />
              </button>
            ))}
          </div>

          <button
            className="bg-red-500 text-white px-2 py-1 rounded text-sm ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              clearCanvas();
            }}
          >
            Limpar
          </button>
        </div>
      )}
      
      {isDrawer && (
        <div className="flex justify-between mt-2">
          <button 
            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
            onClick={(e) => {
              e.stopPropagation();
              setShowTools(!showTools);
            }}
          >
            {showTools ? "Esconder ferramentas" : "Mostrar ferramentas"}
          </button>
          
          {isMobileDevice && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Modo desenho {touchActive ? 'ativo' : 'pronto'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default DrawingCanvas; 