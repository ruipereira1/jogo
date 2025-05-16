import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

interface Point { 
  x: number; 
  y: number; 
  pressure?: number;
  p?: number; // pressure
  s?: number; // isStartOfLine
  o?: number; // isSinglePoint
  color?: string;
  size?: number;
  isStartOfLine?: boolean;
  clientId?: string;
  isSinglePoint?: boolean;
  isClearCanvas?: boolean;
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
  const lastClientPointsRef = useRef<{[key: string]: Point}>({});

  // Otimizar renderização usando debouncing/throttling
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPointsRef = useRef<Point[]>([]);
  const lastRenderTimeRef = useRef<number>(0);
  
  // Função de inicialização do canvas
  useEffect(() => {
    console.log('Inicializando canvas', {
      canvas: canvasRef.current,
      deviceDpr: window.devicePixelRatio || 1
    });
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas não encontrado na inicialização!');
      return;
    }

    // Configuração para canvas de alta resolução
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Verificar se as dimensões são válidas
    if (rect.width === 0 || rect.height === 0) {
      console.error('Canvas com dimensões inválidas:', rect);
      // Forçar dimensões mínimas
      canvas.width = 500 * dpr;
      canvas.height = 350 * dpr;
    } else {
      console.log('Dimensões do canvas:', { 
        width: rect.width, 
        height: rect.height,
        dpr,
        canvasWidth: rect.width * dpr,
        canvasHeight: rect.height * dpr
      });
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      console.error('Contexto 2D não disponível!');
      return;
    }
    
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
    
    console.log('Canvas inicializado com sucesso');
    
    // Ajustar tamanho do canvas ao redimensionar
    const handleResize = () => {
      console.log('Redimensionando canvas');
      
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
      
      console.log('Canvas redimensionado:', { width: canvas.width, height: canvas.height });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Atualizar o contexto quando as cores ou espessuras mudam
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx) return;
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    
    console.log('Estilo de linha atualizado:', { cor: strokeColor, espessura: strokeWidth });
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

  // Processamento otimizado dos pontos recebidos
  const processReceivedPoints = useCallback((points: Point[]) => {
    if (!points || points.length === 0 || isDrawer) return;
    
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    
    // Garantir que o canvas esteja visível
    canvas.style.display = 'block';
    
    // Limitar a taxa de renderização para evitar sobrecarga
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    
    // Acumular pontos para processamento em lote
    pendingPointsRef.current.push(...points);
    
    // Se já temos um timer de renderização agendado, não criar outro
    if (renderTimerRef.current) return;
    
    // Se passamos do limite de tempo ou temos muitos pontos pendentes, renderizar agora
    if (timeSinceLastRender > 30 || pendingPointsRef.current.length > 50) {
      renderPointsBatch();
    } else {
      // Agendar renderização para mais tarde (tempo reduzido para melhor resposta)
      renderTimerRef.current = setTimeout(renderPointsBatch, 20);
    }
  }, [isDrawer]);
  
  // Renderizar lote de pontos com otimização
  const renderPointsBatch = useCallback(() => {
    if (renderTimerRef.current) {
      clearTimeout(renderTimerRef.current);
      renderTimerRef.current = null;
    }
    
    if (pendingPointsRef.current.length === 0) return;
    
    const ctx = contextRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const pointsByClient: {[key: string]: Point[]} = {};
    
    // Log para depuração
    console.log(`Renderizando lote de ${pendingPointsRef.current.length} pontos`);
    
    // Agrupar pontos por cliente para desenhar linhas contínuas
    pendingPointsRef.current.forEach(point => {
      // Se é um comando de limpeza, processar e retornar
      if (point.isClearCanvas || point.o === 2) { // 2 = código para limpeza
        console.log('Comando de limpeza detectado, limpando canvas');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        lastClientPointsRef.current = {}; // Resetar pontos armazenados
        return;
      }
      
      const clientId = point.clientId || 'default';
      
      // Verificar se é um ponto único (clique sem movimento)
      const isSinglePoint = point.isSinglePoint || point.o === 1;
      
      if (isSinglePoint) {
        // Desenhar ponto único diretamente
        console.log('Renderizando ponto único:', point);
        ctx.save();
        ctx.fillStyle = point.color || strokeColor;
        ctx.beginPath();
        ctx.arc(
          (point.x || 0) * rect.width, 
          (point.y || 0) * rect.height, 
          ((point.size || point.p || strokeWidth) / 2), 
          0, 
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
        return;
      }
      
      // Verificar se precisamos iniciar uma nova linha para este cliente
      const isStartOfLine = point.isStartOfLine || point.s === 1;
      
      if (!pointsByClient[clientId]) {
        pointsByClient[clientId] = [];
      }
      
      // Se é começo de nova linha, processar a linha atual e começar nova
      if (isStartOfLine && pointsByClient[clientId].length > 0) {
        // Desenhar a linha atual antes de começar nova
        const linePoints = pointsByClient[clientId];
        drawPath(ctx, linePoints, point.color || strokeColor, point.size || strokeWidth, rect);
        pointsByClient[clientId] = []; // Iniciar nova linha
      }
      
      // Adicionar o ponto atual à linha do cliente
      pointsByClient[clientId].push(point);
    });
    
    // Desenhar as linhas acumuladas por cliente
    Object.keys(pointsByClient).forEach(clientId => {
      const linePoints = pointsByClient[clientId];
      if (linePoints.length > 0) {
        const firstPoint = linePoints[0];
        drawPath(ctx, linePoints, firstPoint.color || strokeColor, firstPoint.size || strokeWidth, rect);
        
        // Armazenar o último ponto desta linha para o cliente
        if (linePoints.length > 0) {
          lastClientPointsRef.current[clientId] = linePoints[linePoints.length - 1];
        }
      }
    });
    
    // Limpar os pontos processados
    pendingPointsRef.current = [];
    lastRenderTimeRef.current = performance.now();
  }, [strokeColor, strokeWidth]);
  
  // Função otimizada para desenhar um caminho a partir de pontos
  const drawPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number, rect: DOMRect) => {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    // Iniciar no primeiro ponto
    ctx.moveTo(
      (points[0].x || 0) * rect.width, 
      (points[0].y || 0) * rect.height
    );
    
    // Para desenhos simples, usar lineTo para cada ponto em vez de curvas
    if (points.length < 5) {
      // Com poucos pontos, conectar diretamente para mais precisão
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(
          (points[i].x || 0) * rect.width, 
          (points[i].y || 0) * rect.height
        );
      }
    } else {
      // Com muitos pontos, usar curva suave para performance
      for (let i = 1; i < points.length; i++) {
        const xc = ((points[i].x || 0) + (points[i-1].x || 0)) / 2 * rect.width;
        const yc = ((points[i].y || 0) + (points[i-1].y || 0)) / 2 * rect.height;
        
        // Usar curva quadrática para suavizar a linha
        if (i < points.length - 1) {
          ctx.quadraticCurveTo(
            (points[i-1].x || 0) * rect.width, 
            (points[i-1].y || 0) * rect.height,
            xc, 
            yc
          );
        } else {
          // Para o último ponto, desenhar até ele diretamente
          ctx.lineTo(
            (points[i].x || 0) * rect.width, 
            (points[i].y || 0) * rect.height
          );
        }
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }, []);

  // Processar pontos recebidos quando não é o desenhista, usando o processamento em lote
  useEffect(() => {
    if (isDrawer || !receivedPoints || receivedPoints.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    console.log(`Processando ${receivedPoints.length} pontos recebidos`);
    
    // Garantir que o canvas esteja visível
    canvas.style.display = 'block';
    
    // Verificar se há um comando explícito de limpeza em vez de limpar automaticamente
    const hasClearCommand = receivedPoints.some(p => p.isClearCanvas === true || p.o === 2);
    
    // Só limpar se houver um comando explícito de limpeza
    if (hasClearCommand) {
      console.log('Comando de limpeza detectado, limpando canvas');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      lastClientPointsRef.current = {}; // Resetar pontos armazenados
      return; // Se for limpar o canvas, ignorar o resto do processamento
    }
    
    // Renderização direta para pontos individuais (compatibilidade com servidor atual)
    // Primeiro desenhar em 2D diretamente para resposta visual rápida
    const rect = canvas.getBoundingClientRect();
    
    receivedPoints.forEach(point => {
      // Verificar se é um ponto único e renderizar imediatamente
      if (point.isSinglePoint) {
        console.log('Desenhando ponto único diretamente:', point);
        ctx.save();
        ctx.fillStyle = point.color || strokeColor;
        ctx.beginPath();
        ctx.arc(
          point.x * rect.width, 
          point.y * rect.height, 
          (point.size || strokeWidth) / 2, 
          0, 
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
        return;
      }
      
      // Se temos um ponto anterior para este cliente, desenhar linha
      const clientId = point.clientId || 'default';
      const lastPoint = lastClientPointsRef.current[clientId] as Point;
      
      if (lastPoint && !point.isStartOfLine) {
        // Desenhar uma linha conectando o último ponto a este
        ctx.save();
        ctx.strokeStyle = point.color || strokeColor;
        ctx.lineWidth = point.size || strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastPoint.x * rect.width, lastPoint.y * rect.height);
        ctx.lineTo(point.x * rect.width, point.y * rect.height);
        ctx.stroke();
        ctx.restore();
      }
      
      // Atualizar o último ponto para este cliente
      lastClientPointsRef.current[clientId] = { 
        x: point.x, 
        y: point.y 
      } as Point;
    });
    
    // Também enviar para o processador otimizado em lote para linhas suaves
    processReceivedPoints(receivedPoints);
  }, [receivedPoints, isDrawer, processReceivedPoints, strokeColor, strokeWidth]);
  
  // Limpar timer de renderização ao desmontar
  useEffect(() => {
    return () => {
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current);
      }
    };
  }, []);

  // Limpar o canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    console.log('Limpando canvas');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Restaurar configurações padrão
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    
    lastPointRef.current = null;
    pointsBufferRef.current = [];
    lastClientPointsRef.current = {};
    
    // Notificar a sala sobre a limpeza
    onClear?.();
    
    console.log('Canvas limpo com sucesso');
  }, [onClear, strokeColor, strokeWidth]);

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
    
    // Desenhar um ponto único no caso de clique sem movimento
    const ctx = contextRef.current;
    if (ctx) {
      console.log('Desenhando ponto único');
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(x * rect.width, y * rect.height, strokeWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // Notificar início de linha
    onStartLine?.();
    
    // Notificar ponto
    onDraw?.(newPoint);
  }, [isDrawer, onStartLine, onDraw, strokeColor, strokeWidth]);

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
    
    // Verificar limites para evitar desenho fora do canvas
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      console.log('Coordenadas fora dos limites:', { x, y });
      return;
    }
    
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
          ${isHorizontal ? 'flex flex-wrap justify-center items-center gap-1' : 'flex flex-col items-center gap-1'}
          ${toolPosition === 'floating' ? 'absolute right-2 top-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg z-10' : ''}
          ${toolPosition === 'top' ? 'w-full mb-1 bg-white/90 backdrop-blur-sm p-1 rounded shadow-lg' : ''}
          ${toolPosition === 'bottom' ? 'w-full mt-1 bg-white/90 backdrop-blur-sm p-1 rounded shadow-lg' : ''}
          ${toolPosition === 'left' ? 'mr-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg' : ''}
          ${toolPosition === 'right' ? 'ml-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow-lg' : ''}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Controles da barra de ferramentas */}
        <div className={`flex ${isHorizontal ? 'items-center' : 'flex-col'} gap-1 ${isMobileDevice ? 'mb-0.5' : 'mb-1'}`}>
          <button
            className={`bg-gray-200 text-gray-700 ${isMobileDevice ? 'p-0.5 text-[10px]' : 'p-1 text-xs'} rounded hover:bg-gray-300`}
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "Expandir" : "Minimizar"}
          >
            {isMinimized ? "+" : "-"}
          </button>
          <button
            className={`bg-gray-200 text-gray-700 ${isMobileDevice ? 'p-0.5 text-[10px]' : 'p-1 text-xs'} rounded hover:bg-gray-300`}
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
                  className={`${isMobileDevice ? 'w-5 h-5' : 'w-6 h-6'} rounded-full ${color === strokeColor ? 'ring-2 ring-offset-1 ring-blue-500' : ''} hover:scale-110 transition-transform`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(color)}
                  title={`Cor ${color}`}
                />
              ))}
            </div>
            
            {/* Espessuras */}
            <div className={`flex ${isHorizontal ? 'flex-row flex-wrap' : 'flex-col'} gap-1 ${isHorizontal ? (isMobileDevice ? 'ml-1' : 'ml-2') : (isMobileDevice ? 'mt-1' : 'mt-2')}`}>
              {WIDTHS.map(width => (
                <button
                  key={width}
                  className={`${isMobileDevice ? 'w-5 h-5' : 'w-6 h-6'} rounded flex items-center justify-center bg-gray-100 ${width === strokeWidth ? 'ring-2 ring-blue-500' : ''} hover:bg-gray-200 transition-colors`}
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
              className={`bg-red-500 text-white ${isMobileDevice ? 'px-1 py-0.5 text-[10px] mt-0.5' : 'px-2 py-1 text-xs mt-1'} rounded hover:bg-red-600 transition-colors`}
              onClick={clearCanvas}
            >
              Limpar
            </button>
          </>
        )}
      </div>
    );
  }, [toolPosition, isMinimized, strokeColor, strokeWidth, handleColorSelect, handleWidthSelect, clearCanvas, cycleToolPosition, isMobileDevice]);

  return (
    <div className="relative" ref={containerRef}>
      {(console.log('Renderizando DrawingCanvas, isDrawer:', isDrawer), null)}
      {isDrawer && touchActive && (
        <div className="absolute inset-0 pointer-events-none z-10 border-4 border-yellow-300 rounded-lg opacity-50"></div>
      )}
      
      {isDrawer && isMobileDevice && (
        <div className="absolute top-1 left-1 right-1 bg-yellow-100 text-blue-900 px-1 py-0.5 rounded text-[10px] text-center z-20">
          Modo touch ativo
        </div>
      )}
      
      <div className={`flex ${toolPosition === 'left' ? 'flex-row' : ''} ${toolPosition === 'right' ? 'flex-row-reverse' : ''}`}>
        {/* Barra de ferramentas na esquerda/direita */}
        {isDrawer && showTools && (toolPosition === 'left' || toolPosition === 'right') && renderToolbar()}
        
        <div className="flex-1 flex flex-col">
          {/* Barra de ferramentas no topo */}
          {isDrawer && showTools && toolPosition === 'top' && renderToolbar()}
          
          {/* Canvas */}
          <div className="relative bg-white" style={{ 
            minHeight: '250px', 
            borderRadius: '8px', 
            border: '3px solid #FFD600',
            padding: '0',
            overflow: 'hidden'
          }}>
            {(console.log('Renderizando elemento canvas'), null)}
            <canvas
              ref={canvasRef}
              width={500}
              height={350}
              style={{ 
                width: '100%', 
                maxWidth: 500,
                height: 350,
                minWidth: 300, // Garantir tamanho mínimo
                minHeight: 200, // Garantir tamanho mínimo
                background: 'white', 
                borderRadius: 8, 
                cursor: isDrawer ? 'crosshair' : 'default',
                touchAction: isDrawer ? 'none' : 'auto',
                display: 'block', // Garantir que seja exibido como bloco
                boxSizing: 'border-box'
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
        <div className={`flex justify-center ${isMobileDevice ? 'mt-1' : 'mt-2'}`}>
          <button 
            className={`${isMobileDevice ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1'} bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors`}
            onClick={toggleTools}
          >
            {showTools ? "Esconder ferramentas" : "Mostrar ferramentas"}
          </button>
          
          {isMobileDevice && (
            <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded ml-1">
              Modo desenho {touchActive ? 'ativo' : 'pronto'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default DrawingCanvas; 