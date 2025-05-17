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
  timestamp?: number;
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

    // Garantir que o canvas tenha tamanho específico e consistente
    const dpr = window.devicePixelRatio || 1;
    
    // Definir dimensões fixas para o canvas para garantir consistência
    const CANVAS_WIDTH = 800;
    const CANVAS_HEIGHT = 600;
    
    // Configurar estilos CSS para dimensionar visualmente
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.minHeight = '300px';
    
    // Configurar dimensões reais do canvas (buffer interno)
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      console.error('Contexto 2D não disponível!');
      return;
    }
    
    // Escalar o contexto para dispositivos de alta densidade
    ctx.scale(dpr, dpr);
    
    // Armazenar as dimensões de referência para uso no desenho/recepção
    canvas.setAttribute('data-width', CANVAS_WIDTH.toString());
    canvas.setAttribute('data-height', CANVAS_HEIGHT.toString());
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    contextRef.current = ctx;
    
    // Limpar o canvas inicialmente
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    console.log('Canvas inicializado com dimensões internas:', {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      dpr,
      realWidth: canvas.width,
      realHeight: canvas.height
    });
    
    // Ajustar tamanho do canvas ao redimensionar
    const handleResize = () => {
      console.log('Redimensionando canvas');
      
      // Não alteramos as dimensões internas do canvas, apenas garantimos 
      // que as transformações de escala estejam corretas
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Resetar transformação
      ctx.scale(dpr, dpr);
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      
      console.log('Canvas redimensionado mantendo as dimensões internas fixas');
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Função para obter as dimensões de referência do canvas
  const getCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { width: 800, height: 600 };
    
    // Usar as dimensões de referência armazenadas ou valores padrão
    const width = parseInt(canvas.getAttribute('data-width') || '800', 10);
    const height = parseInt(canvas.getAttribute('data-height') || '600', 10);
    
    return { width, height };
  }, []);
  
  // Atualizar função de normalização de pontos de desenho
  const normalizePoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const refDimensions = getCanvasDimensions();
    
    // Converter para coordenadas dentro do canvas
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    // Normalizar usando as dimensões visuais atuais
    const x = canvasX / rect.width;
    const y = canvasY / rect.height;
    
    return { x, y };
  }, [getCanvasDimensions]);

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
    if (!points || points.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas não encontrado para processar pontos recebidos');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Contexto 2D não disponível para processar pontos');
      return;
    }
    
    console.log(`Processando ${points.length} pontos recebidos para renderização`);
    
    // Verificar se há um comando de limpeza
    if (points.some(p => p.isClearCanvas === true)) {
      console.log('Comando de limpeza detectado, limpando canvas');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    
    // Usar dimensões de referência para garantir consistência
    const dimensions = getCanvasDimensions();
    console.log('Dimensões de referência para renderização:', dimensions);
    
    // Agrupar pontos por cliente para desenhar por linhas contínuas
    const pointsByClient: {[key: string]: Point[]} = {};
    
    // Agrupar pontos por clientId para garantir continuidade das linhas
    points.forEach(point => {
      const clientId = point.clientId || 'default';
      if (!pointsByClient[clientId]) {
        pointsByClient[clientId] = [];
      }
      pointsByClient[clientId].push(point);
    });
    
    // Desenhar linhas por cliente
    Object.keys(pointsByClient).forEach(clientId => {
      const clientPoints = pointsByClient[clientId];
      const sortedPoints = clientPoints.sort((a, b) => 
        (a.timestamp || 0) - (b.timestamp || 0)
      );
      
      // Desenhar cada segmento de linha
      if (sortedPoints.length > 0) {
        let startNewLine = true;
        
        sortedPoints.forEach(point => {
          if (point.isStartOfLine || point.s === 1) {
            startNewLine = true;
          }
          
          // Desenhar ponto único se for o caso
          if (point.isSinglePoint || point.o === 1) {
            const x = point.x * dimensions.width;
            const y = point.y * dimensions.height;
            
            ctx.save();
            ctx.fillStyle = point.color || strokeColor;
            ctx.beginPath();
            ctx.arc(x, y, (point.size || strokeWidth) / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
          }
          
          // Continuar a linha se não for início
          if (!startNewLine) {
            const prevPoint = lastClientPointsRef.current[clientId];
            if (prevPoint) {
              // Desenhar linha para o canvas
              ctx.save();
              ctx.strokeStyle = point.color || strokeColor;
              ctx.lineWidth = point.size || strokeWidth;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.beginPath();
              
              // Usar coordenadas usando dimensões de referência
              const fromX = prevPoint.x * dimensions.width;
              const fromY = prevPoint.y * dimensions.height;
              const toX = point.x * dimensions.width;
              const toY = point.y * dimensions.height;
              
              // Log para depuração apenas se as coordenadas forem suspeitas
              if (point.x === 0 && point.y === 0) {
                console.warn('Ponto zerado detectado, possível problema de coordenadas');
              }
              
              ctx.moveTo(fromX, fromY);
              ctx.lineTo(toX, toY);
              ctx.stroke();
              ctx.restore();
            }
          }
          
          // Atualizar último ponto deste cliente
          lastClientPointsRef.current[clientId] = { ...point };
          startNewLine = false;
        });
      }
    });
  }, [strokeColor, strokeWidth, getCanvasDimensions]);
  
  // Função otimizada para desenhar um caminho a partir de pontos
  const drawPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number, rect: DOMRect) => {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    // Iniciar no primeiro ponto com coordenadas inteiras
    const startX = Math.floor((points[0].x || 0) * rect.width);
    const startY = Math.floor((points[0].y || 0) * rect.height);
    ctx.moveTo(startX, startY);
    
    // Para desenhos simples, usar lineTo para cada ponto em vez de curvas
    if (points.length < 5) {
      // Com poucos pontos, conectar diretamente para mais precisão
      for (let i = 1; i < points.length; i++) {
        const x = Math.floor((points[i].x || 0) * rect.width);
        const y = Math.floor((points[i].y || 0) * rect.height);
        ctx.lineTo(x, y);
      }
    } else {
      // Com muitos pontos, usar curva suave para melhor aparência
      // Usar coordenadas inteiras para melhor performance
      for (let i = 1; i < points.length; i++) {
        const currX = Math.floor((points[i].x || 0) * rect.width);
        const currY = Math.floor((points[i].y || 0) * rect.height);
        const prevX = Math.floor((points[i-1].x || 0) * rect.width);
        const prevY = Math.floor((points[i-1].y || 0) * rect.height);
        
        // Calcular ponto médio
        const xc = Math.floor((currX + prevX) / 2);
        const yc = Math.floor((currY + prevY) / 2);
        
        // Usar curva quadrática para suavizar a linha
        if (i < points.length - 1) {
          ctx.quadraticCurveTo(prevX, prevY, xc, yc);
        } else {
          // Para o último ponto, desenhar até ele diretamente
          ctx.lineTo(currX, currY);
        }
      }
    }
    
    ctx.stroke();
    ctx.restore();
  }, []);

  // Processar pontos recebidos quando não é o desenhista, usando o processamento em lote
  useEffect(() => {
    if (isDrawer || !Array.isArray(receivedPoints) || receivedPoints.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      console.log(`Processando ${receivedPoints.length} pontos recebidos`);
      
      // Garantir que o canvas esteja visível
      canvas.style.display = 'block';
      
      // Verificar se há um comando explícito de limpeza em vez de limpar automaticamente
      const hasClearCommand = receivedPoints.some(p => p && (p.isClearCanvas === true || p.o === 2));
      
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
      
      // Apenas processar pontos válidos
      const validPoints = receivedPoints.filter(point => 
        point && typeof point.x === 'number' && typeof point.y === 'number' && 
        !isNaN(point.x) && !isNaN(point.y)
      );
      
      validPoints.forEach(point => {
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
          // Verificar se as coordenadas do último ponto são válidas
          if (typeof lastPoint.x !== 'number' || typeof lastPoint.y !== 'number' ||
              isNaN(lastPoint.x) || isNaN(lastPoint.y)) {
            console.warn('Último ponto com coordenadas inválidas:', lastPoint);
            return;
          }
            
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
      processReceivedPoints(validPoints);
    } catch (error) {
      console.error('Erro ao processar pontos recebidos:', error);
    }
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
    
    // Usar dimensões de referência para limpar corretamente
    const dimensions = getCanvasDimensions();
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    
    // Restaurar configurações padrão
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    
    // Limpar referências de pontos
    lastPointRef.current = null;
    pointsBufferRef.current = [];
    lastClientPointsRef.current = {};
    
    // Notificar a sala sobre a limpeza
    onClear?.();
    
    console.log('Canvas limpo com sucesso usando dimensões:', dimensions);
  }, [onClear, strokeColor, strokeWidth, getCanvasDimensions]);

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
    
    // Obter coordenadas normalizadas
    const { x, y } = normalizePoint(e.clientX, e.clientY);
    
    // Iniciar nova linha
    const newPoint = { x, y, pressure: e.pressure || 0.5 };
    lastPointRef.current = newPoint;
    pointsBufferRef.current = [newPoint];
    
    // Desenhar um ponto único no caso de clique sem movimento
    const ctx = contextRef.current;
    if (ctx) {
      const dimensions = getCanvasDimensions();
      console.log('Desenhando ponto único em:', {
        x: x * dimensions.width,
        y: y * dimensions.height
      });
      
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(
        x * dimensions.width, 
        y * dimensions.height, 
        strokeWidth / 2, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
    
    // Notificar início de linha
    onStartLine?.();
    
    // Notificar ponto
    onDraw?.(newPoint);
  }, [isDrawer, onStartLine, onDraw, strokeColor, strokeWidth, normalizePoint, getCanvasDimensions]);

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
    
    // Obter coordenadas normalizadas usando a nova função
    const { x, y } = normalizePoint(e.clientX, e.clientY);
    
    // Verificar limites para evitar desenho fora do canvas
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      console.log('Coordenadas fora dos limites:', { x, y });
      return;
    }
    
    const newPoint = { x, y, pressure: e.pressure || 0.5 };
    const lastPoint = lastPointRef.current;
    
    if (lastPoint) {
      // Obter dimensões de referência consistentes
      const dimensions = getCanvasDimensions();
      
      // Desenhar linha do último ponto até o atual
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      
      // Converter pontos normalizados para coordenadas de pixel consistentes
      ctx.moveTo(lastPoint.x * dimensions.width, lastPoint.y * dimensions.height);
      ctx.lineTo(x * dimensions.width, y * dimensions.height);
      ctx.stroke();
      ctx.restore();
      
      // Adicionar ao buffer para enviar em lote depois
      pointsBufferRef.current.push(newPoint);
      
      // Enviar para a sala
      onDraw?.(newPoint);
    }
    
    // Atualizar último ponto
    lastPointRef.current = newPoint;
  }, [isDrawer, strokeColor, strokeWidth, onDraw, normalizePoint, getCanvasDimensions]);

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