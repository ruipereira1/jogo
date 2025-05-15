import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Point { 
  x: number; 
  y: number; 
  pressure?: number;
  color?: string;
  size?: number;
  isStartOfLine?: boolean;
  clientId?: string;
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
  const pointsBufferRef = useRef<Point[]>([]);
  const [showTools, setShowTools] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const [toolPosition, setToolPosition] = useState<ToolbarPosition>('top');
  const [isMinimized, setIsMinimized] = useState(false);
  const lastClientPointsRef = useRef<{[key: string]: Point[]}>({});

  // Função de inicialização do canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Configuração para canvas de alta resolução
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    // Escalar o contexto para dispositivos de alta densidade
    ctx.scale(dpr, dpr);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    contextRef.current = ctx;
    
    // Limpar o canvas inicialmente
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Ajustar tamanho do canvas ao redimensionar
    const handleResize = () => {
      const newRect = canvas.getBoundingClientRect();
      canvas.width = newRect.width * dpr;
      canvas.height = newRect.height * dpr;
      
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      
      // Restaurar conteúdo
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
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
        setToolPosition('floating');
      } else {
        setToolPosition('top');
      }
    };
    
    detectMobile();
    window.addEventListener('resize', detectMobile);
    
    return () => window.removeEventListener('resize', detectMobile);
  }, []);

  // Função simplificada para desenhar linha 
  const drawLine = useCallback((ctx: CanvasRenderingContext2D, startPoint: Point, endPoint: Point, color: string, width: number) => {
    if (!ctx) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    
    const canvas = ctx.canvas;
    const rect = canvas.getBoundingClientRect();
    
    // Usar coordenadas absolutas
    ctx.moveTo(startPoint.x * rect.width, startPoint.y * rect.height);
    ctx.lineTo(endPoint.x * rect.width, endPoint.y * rect.height);
    ctx.stroke();
    ctx.restore();
  }, []);

  // Processar pontos recebidos quando não é o desenhista
  useEffect(() => {
    if (isDrawer || !receivedPoints || receivedPoints.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Verificar se há um comando explícito de limpeza em vez de limpar automaticamente
    const hasClearCommand = receivedPoints.some(p => p.isClearCanvas === true);
    
    // Só limpar se houver um comando explícito de limpeza
    if (hasClearCommand) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      lastClientPointsRef.current = {}; // Resetar pontos armazenados
      return; // Se for limpar o canvas, ignorar o resto do processamento
    }
    
    // Verificar se há início de nova linha (primeiro ponto após levantar o lápis)
    // Mas NÃO limpar o canvas, apenas começar uma nova linha de desenho
    const hasNewLineStart = receivedPoints.some(p => p.isStartOfLine);
    
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
        // Processar linha anterior
        const points = pointsByClient[clientId];
        
        // Desenhar linha entre cada par de pontos
        for (let i = 0; i < points.length - 1; i++) {
          drawLine(ctx, points[i], points[i+1], p.color || '#222', p.size || 3);
        }
        
        // Limpar pontos deste cliente
        pointsByClient[clientId] = [];
      }
      
      // Adicionar ponto
      pointsByClient[clientId].push({
        x: p.x,
        y: p.y,
        pressure: p.pressure || 0.5,
        color: p.color || '#222',
        size: p.size || 3
      });
    });
    
    // Desenhar linhas restantes para cada cliente
    Object.entries(pointsByClient).forEach(([clientId, points]) => {
      if (points.length > 1) {
        const color = points[0].color || '#222';
        const size = points[0].size || 3;
        
        for (let i = 0; i < points.length - 1; i++) {
          drawLine(ctx, points[i], points[i+1], color, size);
        }
      }
      
      // Salvar último ponto para próxima atualização
      if (points.length > 0) {
        lastClientPointsRef.current[clientId] = points;
      }
    });
  }, [receivedPoints, isDrawer, drawLine]);
   
  // Limpar o canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastPointRef.current = null;
    pointsBufferRef.current = [];
    lastClientPointsRef.current = {};
    
    // Notificar a sala sobre a limpeza
    onClear?.();
  }, [onClear]);

  // Event handler para iniciar desenho
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
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
    const rect = canvas!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Iniciar nova linha
    const newPoint = { x, y, pressure: e.pressure || 0.5 };
    lastPointRef.current = newPoint;
    pointsBufferRef.current = [newPoint];
    
    // Notificar início de linha
    onStartLine?.();
    
    // Notificar ponto
    onDraw?.(newPoint);
  }, [isDrawer, onStartLine, onDraw]);

  // Event handler para desenhar durante movimento do ponteiro
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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
    const lastPoint = lastPointRef.current;
    
    if (lastPoint) {
      // Desenhar linha do último ponto até o atual
      drawLine(ctx, lastPoint, newPoint, strokeColor, strokeWidth);
      
      // Notificar servidor sobre o novo ponto
      onDraw?.(newPoint);
    }
    
    // Atualizar último ponto
    lastPointRef.current = newPoint;
    pointsBufferRef.current.push(newPoint);
  }, [isDrawer, strokeColor, strokeWidth, onDraw, drawLine]);

  // Event handler para finalizar desenho
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
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
    pointsBufferRef.current = [];
    lastPointRef.current = null;
  }, [isDrawer, onEndLine]);

  // Fechar ferramentas quando clicar fora
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
    if (!isDrawer) return;
    
    const preventScroll = (e: Event) => {
      if (isDrawingRef.current) {
        e.preventDefault();
      }
    };

    const options = { passive: false };
    
    document.addEventListener('touchmove', preventScroll, options);
    document.addEventListener('touchstart', preventScroll, options);
    
    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('touchstart', preventScroll);
    };
  }, [isDrawer]);

  const toggleTools = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDrawer) {
      setShowTools(!showTools);
    }
  }, [isDrawer, showTools]);

  const handleColorSelect = useCallback((color: string) => {
    onColorChange?.(color);
  }, [onColorChange]);

  const handleWidthSelect = useCallback((width: number) => {
    onWidthChange?.(width);
  }, [onWidthChange]);

  const cycleToolPosition = useCallback(() => {
    const positions: ToolbarPosition[] = ['top', 'right', 'bottom', 'left', 'floating'];
    const currentIndex = positions.indexOf(toolPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    setToolPosition(positions[nextIndex]);
  }, [toolPosition]);

  // Renderizar a barra de ferramentas
  const renderToolbar = useCallback(() => {
    const isHorizontal = toolPosition === 'top' || toolPosition === 'bottom';
    
    return (
      <div 
        ref={toolboxRef}
        className={`
          ${isMinimized ? 'opacity-60 hover:opacity-100' : 'opacity-100'}
          transition-all duration-200
          ${isHorizontal ? 'flex flex-wrap justify-center items-center gap-2' : 'flex flex-col items-center gap-2'}
          ${toolPosition === 'floating' ? 'absolute right-2 top-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg z-10' : ''}
          ${toolPosition === 'top' ? 'w-full mb-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg' : ''}
          ${toolPosition === 'bottom' ? 'w-full mt-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg' : ''}
          ${toolPosition === 'left' ? 'mr-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg' : ''}
          ${toolPosition === 'right' ? 'ml-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controles da barra de ferramentas */}
        <div className={`flex ${isHorizontal ? 'items-center' : 'flex-col'} gap-1 mb-1`}>
          <button
            className="bg-gray-200 text-gray-700 p-1 rounded text-xs hover:bg-gray-300"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expandir" : "Minimizar"}
          >
            {isMinimized ? "+" : "-"}
          </button>
          <button
            className="bg-gray-200 text-gray-700 p-1 rounded text-xs hover:bg-gray-300"
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
                  className={`w-6 h-6 rounded-full ${color === strokeColor ? 'ring-2 ring-offset-1 ring-blue-500' : ''} hover:scale-110 transition-transform`}
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
                  className={`w-6 h-6 rounded flex items-center justify-center bg-gray-100 ${width === strokeWidth ? 'ring-2 ring-blue-500' : ''} hover:bg-gray-200 transition-colors`}
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
              className="bg-red-500 text-white px-2 py-1 rounded text-xs mt-1 hover:bg-red-600 transition-colors"
              onClick={clearCanvas}
            >
              Limpar
            </button>
          </>
        )}
      </div>
    );
  }, [toolPosition, isMinimized, strokeColor, strokeWidth, handleColorSelect, handleWidthSelect, clearCanvas, cycleToolPosition]);

  return (
    <div className="relative" ref={containerRef}>
      {isDrawer && touchActive && (
        <div className="absolute inset-0 pointer-events-none z-10 border-4 border-yellow-300 rounded-lg opacity-50"></div>
      )}
      
      {isDrawer && isMobileDevice && (
        <div className="absolute top-2 left-2 right-2 bg-yellow-100 text-blue-900 px-2 py-1 rounded text-xs text-center z-20">
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
                height: 'auto',
                background: 'white', 
                borderRadius: 8, 
                border: '2px solid #FFD600',
                cursor: isDrawer ? 'crosshair' : 'default',
                touchAction: isDrawer ? 'none' : 'auto'
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
            className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
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