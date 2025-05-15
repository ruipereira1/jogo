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
  const drawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const processedPointsRef = useRef<Set<string>>(new Set());
  const [toolPosition, setToolPosition] = useState<ToolbarPosition>('top');
  const [isMinimized, setIsMinimized] = useState(false);

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

  // Efeito para processar pontos recebidos quando não é o desenhista
  useEffect(() => {
    if (isDrawer || !receivedPoints || receivedPoints.length === 0) return;
    
    console.log(`DrawingCanvas: Processando ${receivedPoints.length} pontos recebidos (espectador)`);
    
    // Agrupar pontos por clientId e por linha (usando timestamps)
    const pointsByClientAndLine: {[key: string]: any[][]} = {};
    
    receivedPoints.forEach(point => {
      const clientId = point.clientId || 'default';
      if (!pointsByClientAndLine[clientId]) {
        pointsByClientAndLine[clientId] = [];
      }
      
      // Adicionar marcador para nova linha
      if (point.isStartOfLine) {
        pointsByClientAndLine[clientId].push([]);
      }
      
      // Se ainda não houver nenhuma linha, criar a primeira
      if (pointsByClientAndLine[clientId].length === 0) {
        pointsByClientAndLine[clientId].push([]);
      }
      
      // Adicionar ponto à linha atual
      const currentLineIndex = pointsByClientAndLine[clientId].length - 1;
      const currentLine = pointsByClientAndLine[clientId][currentLineIndex];
      
      // Verificar se devemos iniciar uma nova linha baseado no tempo
      if (currentLine.length > 0) {
        const lastPoint = currentLine[currentLine.length - 1];
        // Se a diferença de tempo for muito grande, isso pode indicar uma nova linha
        if (point.timestamp && lastPoint.timestamp && 
            point.timestamp - lastPoint.timestamp > 1000) { // 1 segundo de diferença
          pointsByClientAndLine[clientId].push([point]);
          return;
        }
        
        // Se a distância entre pontos for muito grande, provavelmente é uma nova linha
        const dx = point.x - lastPoint.x;
        const dy = point.y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0.1) { // 10% da dimensão do canvas
          pointsByClientAndLine[clientId].push([point]);
          return;
        }
      }
      
      currentLine.push(point);
    });
    
    // Limpar o canvas antes de desenhar
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Desenhar cada linha de cada cliente
    Object.values(pointsByClientAndLine).forEach(clientLines => {
      clientLines.forEach(line => {
        if (line.length < 1) return;
        
        // Resetar o último ponto para começar uma nova linha
        lastPoint.current = null;
        
        line.forEach(point => {
          // Se o ponto tiver coordenadas inválidas, ignore
          if (typeof point.x !== 'number' || typeof point.y !== 'number') {
            console.warn('Ponto recebido com coordenadas inválidas:', point);
            return;
          }
          
          // Desenhar o ponto conectando com o anterior
          drawPoint(point.x, point.y, point.color, point.size, false);
        });
        
        // Resetar para a próxima linha
        lastPoint.current = null;
      });
    });
  }, [receivedPoints, isDrawer]);
   
  // Efeito para limpar o canvas quando recebemos o evento de limpeza
  useEffect(() => {
    if (receivedPoints.length === 0) {
      // Para evitar loops infinitos, não chamar onClear aqui
      // Apenas limpar o canvas localmente
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      lastPoint.current = null;
      processedPointsRef.current.clear();
    }
  }, [receivedPoints]);

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
  const drawPoint = (x: number, y: number, color: string = strokeColor || '#222', width: number = strokeWidth || 3, shouldNotify: boolean = true) => {
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
    
    console.log('DrawingCanvas.drawPoint:', { x, y, color, canvasX, canvasY, isDrawer, shouldNotify });
    
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
    
    // Notificar a sala sobre o ponto APENAS se for o desenhista e shouldNotify for true
    if (isDrawer && shouldNotify) {
      console.log('DrawingCanvas enviando ponto:', x, y);
      onDraw?.({ x, y });
    }
  };

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
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastPoint.current = null;  // Resetar o último ponto
    processedPointsRef.current.clear(); // Limpar o registro de pontos processados
    
    // Notificar a sala sobre a limpeza
    console.log('DrawingCanvas chamando onClear');
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
    
    // Não prevenir o evento padrão se clicar na ferramenta
    if (toolboxRef.current && toolboxRef.current.contains(e.target as Node)) {
      return;
    }
    
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
    
    // Ignorar movimento do mouse sobre a caixa de ferramentas
    if (toolboxRef.current && toolboxRef.current.contains(e.target as Node)) {
      return;
    }
    
    e.preventDefault();
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Desenhar ponto
    drawPoint(x, y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawer || e.pointerType === 'touch') return;
    
    // Não prevenir o evento padrão se soltar na ferramenta
    if (toolboxRef.current && toolboxRef.current.contains(e.target as Node)) {
      return;
    }
    
    e.preventDefault();
    
    drawing.current = false;
    lastPoint.current = null;  // Resetar último ponto ao terminar a linha
    onEndLine?.();
  };

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
              onClick={() => {
                if (isDrawer) {
                  console.log('DrawingCanvas: Botão limpar acionado, chamando onClear');
                  onClear?.();
                }
              }}
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
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
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