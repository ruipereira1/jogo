import React, { useRef, useEffect, useState } from 'react';

interface Point { 
  x: number; 
  y: number; 
  pressure?: number;
}

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
  receivedPoints?: any[]; // Pontos recebidos do servidor para espectadores
}

const COLORS = ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080', '#A52A2A', '#808080'];
const WIDTHS = [1, 3, 5, 8, 12];

type ToolbarPosition = 'top' | 'bottom' | 'left' | 'right' | 'floating';

const DrawingCanvas: React.FC<Props> = ({ 
  onDraw, 
  isDrawer, 
  onStartLine, 
  onEndLine,
  onClear,
  strokeColor = '#222',
  strokeWidth = 3,
  onColorChange,
  onWidthChange,
  receivedPoints = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolboxRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const processedPointsRef = useRef<Set<string>>(new Set());
  const [toolPosition, setToolPosition] = useState<ToolbarPosition>('top');
  const [isMinimized, setIsMinimized] = useState(false);
  const lastClientPointsRef = useRef<{[key: string]: Point[]}>({});

  // Função de inicialização do canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Configurar o contexto do canvas
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    contextRef.current = ctx;
    
    // Limpar o canvas inicialmente
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Atualizar o estilo de linha quando as props mudam
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
  }, [strokeColor, strokeWidth]);

  // Detectar se é dispositivo móvel
  useEffect(() => {
    const detectMobile = () => {
      const isMobile = window.innerWidth < 768 || 
                       /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isMobile);
      
      // Definir posição padrão com base no dispositivo
      if (isMobile) {
        setToolPosition('bottom');
      } else {
        setToolPosition('top');
      }
    };
    
    detectMobile();
    window.addEventListener('resize', detectMobile);
    
    return () => window.removeEventListener('resize', detectMobile);
  }, []);

  // Função de suavização de curva
  const smoothLine = (points: Point[]): Point[] => {
    if (points.length < 3) return points;
    
    const smoothed: Point[] = [];
    
    // Manter o primeiro ponto
    smoothed.push(points[0]);
    
    // Calcular pontos de controle para cada segmento
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      // Ponto médio entre pontos adjacentes
      const midPoint: Point = {
        x: (curr.x + next.x) / 2,
        y: (curr.y + next.y) / 2,
        pressure: curr.pressure
      };
      
      smoothed.push(curr);
      smoothed.push(midPoint);
    }
    
    // Manter o último ponto
    smoothed.push(points[points.length - 1]);
    
    return smoothed;
  };

  // Desenhar uma curva suave baseada em pontos
  const drawSmoothLine = (ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number) => {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    
    // Mover para o primeiro ponto
    ctx.moveTo(points[0].x * ctx.canvas.width, points[0].y * ctx.canvas.height);
    
    // Para cada par de pontos, desenhar uma curva quadrática
    for (let i = 1; i < points.length - 1; i += 2) {
      const controlPoint = points[i];
      const endPoint = points[i + 1];
      
      ctx.quadraticCurveTo(
        controlPoint.x * ctx.canvas.width, 
        controlPoint.y * ctx.canvas.height,
        endPoint.x * ctx.canvas.width, 
        endPoint.y * ctx.canvas.height
      );
    }
    
    // Se houver um número ímpar de pontos, desenhar até o último
    if (points.length % 2 === 0) {
      const lastPoint = points[points.length - 1];
      ctx.lineTo(lastPoint.x * ctx.canvas.width, lastPoint.y * ctx.canvas.height);
    }
    
    ctx.stroke();
    ctx.restore();
  };

  // Efeito para processar pontos recebidos quando não é o desenhista
  useEffect(() => {
    if (isDrawer || !receivedPoints || receivedPoints.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Agrupar pontos por clientId 
    const pointsByClient: {[key: string]: Point[]} = {};
    
    // Processar pontos recebidos
    receivedPoints.forEach(p => {
      const clientId = p.clientId || 'default';
      
      // Criar o array para o cliente se não existir
      if (!pointsByClient[clientId]) {
        pointsByClient[clientId] = [];
      }
      
      // Se for começo de nova linha, processar a linha atual e começar nova
      if (p.isStartOfLine && pointsByClient[clientId].length > 0) {
        // Processar linha atual
        const smoothedPoints = smoothLine(pointsByClient[clientId]);
        drawSmoothLine(ctx, smoothedPoints, p.color || '#222', p.size || 3);
        
        // Limpar pontos deste cliente
        pointsByClient[clientId] = [];
      }
      
      // Adicionar ponto
      pointsByClient[clientId].push({
        x: p.x,
        y: p.y,
        pressure: p.pressure || 0.5
      });
    });
    
    // Desenhar linhas restantes para cada cliente
    Object.entries(pointsByClient).forEach(([clientId, points]) => {
      if (points.length > 0) {
        // Obter cor e tamanho do último ponto (mais recente)
        const lastPoint = points[points.length - 1];
        const color = lastPoint.color || '#222';
        const size = lastPoint.size || 3;
        
        const smoothedPoints = smoothLine(points);
        drawSmoothLine(ctx, smoothedPoints, color, size);
        
        // Salvar pontos para a próxima atualização
        lastClientPointsRef.current[clientId] = points;
      }
    });
  }, [receivedPoints, isDrawer]);
   
  // Limpar o canvas
  const clearCanvas = () => {
    console.log('DrawingCanvas: Executando clearCanvas');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Canvas não encontrado ao tentar limpar');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log('Contexto 2d não encontrado ao tentar limpar');
      return;
    }
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastPointRef.current = null;
    pointsRef.current = [];
    lastClientPointsRef.current = {};
    
    // Notificar a sala sobre a limpeza
    console.log('DrawingCanvas chamando onClear');
    onClear?.();
  };

  // Event handler unificado para pointer events
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawer) return;
    
    // Ignorar eventos na toolbox
    if (toolboxRef.current && toolboxRef.current.contains(e.target as Node)) {
      return;
    }
    
    e.preventDefault();
    
    // Capturar ponteiro para receber todos os eventos, mesmo fora do canvas
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }
    
    // Iniciar desenho
    isDrawingRef.current = true;
    setTouchActive(true);
    
    // Obter coordenadas normalizadas (0-1)
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Iniciar nova linha
    lastPointRef.current = { x, y, pressure: e.pressure || 0.5 };
    pointsRef.current = [{ x, y, pressure: e.pressure || 0.5 }];
    
    // Notificar início de linha
    onStartLine?.();
    
    // Notificar ponto
    onDraw?.({ x, y, pressure: e.pressure });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawer || !isDrawingRef.current) return;
    
    // Ignorar eventos na toolbox
    if (toolboxRef.current && toolboxRef.current.contains(e.target as Node)) {
      return;
    }
    
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = contextRef.current;
    if (!ctx) return;
    
    // Obter coordenadas normalizadas (0-1)
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    const newPoint = { x, y, pressure: e.pressure || 0.5 };
    
    // Adicionar ponto ao array
    pointsRef.current.push(newPoint);
    
    // Se temos pontos suficientes, desenhar uma curva suave
    if (pointsRef.current.length >= 3) {
      // Obter os últimos pontos para desenhar
      const pointsToSmooth = pointsRef.current.slice(-3);
      const smoothedPoints = smoothLine(pointsToSmooth);
      
      // Desenhar localmente
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      drawSmoothLine(ctx, smoothedPoints, strokeColor, strokeWidth);
      
      // Notificar servidor sobre o novo ponto
      onDraw?.(newPoint);
    } else {
      // Se temos poucos pontos, desenhar linha reta
      const lastPoint = lastPointRef.current;
      if (lastPoint) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height);
        ctx.lineTo(x * canvas.width, y * canvas.height);
        ctx.stroke();
        
        // Notificar servidor sobre o novo ponto
        onDraw?.(newPoint);
      }
    }
    
    // Atualizar último ponto
    lastPointRef.current = newPoint;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawer) return;
    
    // Ignorar eventos na toolbox
    if (toolboxRef.current && toolboxRef.current.contains(e.target as Node)) {
      return;
    }
    
    e.preventDefault();
    
    // Liberar captura do ponteiro
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.releasePointerCapture(e.pointerId);
    }
    
    isDrawingRef.current = false;
    setTouchActive(false);
    
    // Notificar fim de linha
    onEndLine?.();
    
    // Resetar pontos
    pointsRef.current = [];
    lastPointRef.current = null;
  };

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
      if (isDrawingRef.current && isDrawer) {
        e.preventDefault();
      }
    };

    const options = { passive: false };
    
    if (isDrawer) {
      document.addEventListener('touchmove', preventScroll, options);
      document.addEventListener('touchstart', preventScroll, options);
    }
    
    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('touchstart', preventScroll);
    };
  }, [isDrawer]);

  const toggleTools = (e: React.MouseEvent) => {
    // Evitar que o clique no canvas ao mostrar ferramentas inicie um desenho
    e.stopPropagation();
    
    if (isDrawer) {
      setShowTools(!showTools);
    }
  };

  const handleColorSelect = (color: string) => {
    onColorChange && onColorChange(color);
  };

  const handleWidthSelect = (width: number) => {
    onWidthChange && onWidthChange(width);
  };

  const cycleToolPosition = () => {
    // Ciclo entre as posições possíveis
    const positions: ToolbarPosition[] = ['top', 'right', 'bottom', 'left', 'floating'];
    const currentIndex = positions.indexOf(toolPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    setToolPosition(positions[nextIndex]);
  };

  // Renderizar a barra de ferramentas
  const renderToolbar = () => {
    const isHorizontal = toolPosition === 'top' || toolPosition === 'bottom';
    
    return (
      <div 
        ref={toolboxRef}
        className={`
          ${isMinimized ? 'opacity-60 hover:opacity-100' : 'opacity-100'}
          transition-all duration-200
          ${isHorizontal ? 'flex flex-wrap justify-center items-center gap-2' : 'flex flex-col items-center gap-2'}
          ${toolPosition === 'floating' ? 'absolute right-2 top-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow' : ''}
          ${toolPosition === 'top' ? 'w-full mb-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow' : ''}
          ${toolPosition === 'bottom' ? 'w-full mt-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow' : ''}
          ${toolPosition === 'left' ? 'absolute left-0 top-0 bottom-0 bg-white/90 backdrop-blur-sm p-2 rounded shadow' : ''}
          ${toolPosition === 'right' ? 'absolute right-0 top-0 bottom-0 bg-white/90 backdrop-blur-sm p-2 rounded shadow' : ''}
        `}
        onClick={(e) => e.stopPropagation()} // Evitar que cliques na caixa de ferramentas passem para o canvas
      >
        {/* Controles da barra de ferramentas */}
        <div className={`flex ${isHorizontal ? 'items-center' : 'flex-col'} gap-1 mb-1`}>
          <button
            className="bg-gray-200 text-gray-700 p-1 rounded text-xs"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expandir" : "Minimizar"}
          >
            {isMinimized ? "+" : "-"}
          </button>
          <button
            className="bg-gray-200 text-gray-700 p-1 rounded text-xs"
            onClick={cycleToolPosition}
            title="Mudar posição"
          >
            ⇄
          </button>
        </div>
        
        {!isMinimized && (
          <>
            {/* Cores */}
            <div className={`flex ${isHorizontal ? 'flex-row flex-wrap' : 'flex-col'} gap-1`}>
              {COLORS.map(color => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full ${color === strokeColor ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  title={`Cor ${color}`}
                />
              ))}
            </div>
            
            {/* Espessuras */}
            <div className={`flex ${isHorizontal ? 'flex-row flex-wrap' : 'flex-col'} gap-1 ${isHorizontal ? 'ml-2' : 'mt-2'}`}>
              {WIDTHS.map(width => (
                <button
                  key={width}
                  className={`w-6 h-6 rounded flex items-center justify-center bg-gray-100 ${width === strokeWidth ? 'ring-2 ring-blue-500' : ''}`}
                  onClick={() => handleWidthSelect(width)}
                  title={`Traço ${width}px`}
                >
                  <div
                    style={{
                      width: `${Math.min(width * 1.5, 20)}px`,
                      height: `${width}px`,
                      backgroundColor: 'black',
                      borderRadius: '4px'
                    }}
                  />
                </button>
              ))}
            </div>
            
            {/* Botão de limpar */}
            <button
              className="bg-red-500 text-white px-2 py-1 rounded text-xs mt-1"
              onClick={clearCanvas}
            >
              Limpar
            </button>
          </>
        )}
      </div>
    );
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
      
      <div className={`flex ${toolPosition === 'left' ? 'flex-row' : ''} ${toolPosition === 'right' ? 'flex-row-reverse' : ''}`}>
        {/* Barra de ferramentas na esquerda/direita */}
        {isDrawer && showTools && (toolPosition === 'left' || toolPosition === 'right') && renderToolbar()}
        
        <div className="flex-1 flex flex-col">
          {/* Barra de ferramentas no topo */}
          {isDrawer && showTools && toolPosition === 'top' && renderToolbar()}
          
          {/* Canvas */}
          <div className="relative">
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
              onPointerCancel={handlePointerUp}
              touch-action="none"
            />
            
            {/* Ferramentas em modo flutuante */}
            {isDrawer && showTools && toolPosition === 'floating' && renderToolbar()}
          </div>
          
          {/* Barra de ferramentas no fundo */}
          {isDrawer && showTools && toolPosition === 'bottom' && renderToolbar()}
        </div>
      </div>
      
      {/* Botão para mostrar/esconder ferramentas */}
      {isDrawer && (
        <div className="flex justify-center mt-2">
          <button 
            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
            onClick={toggleTools}
          >
            {showTools ? "Esconder ferramentas" : "Mostrar ferramentas"}
          </button>
          
          {isMobileDevice && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">
              Modo desenho {touchActive ? 'ativo' : 'pronto'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default DrawingCanvas; 