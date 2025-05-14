import React, { useRef, useEffect, useState } from 'react';

interface Point { x: number; y: number; }
interface Line { 
  points: Point[]; 
  color?: string;
  width?: number;
}

interface Props {
  lines: Line[];
  onDraw?: (point: Point) => void;
  isDrawer: boolean;
  onStartLine?: () => void;
  onEndLine?: () => void;
  strokeColor?: string;
  strokeWidth?: number;
  onColorChange?: (color: string) => void;
  onWidthChange?: (width: number) => void;
}

const COLORS = ['#000000', '#FF0000', '#0000FF', '#008000', '#FFA500', '#800080', '#A52A2A', '#808080'];
const WIDTHS = [1, 3, 5, 8, 12];

const DrawingCanvas: React.FC<Props> = ({ 
  lines, 
  onDraw, 
  isDrawer, 
  onStartLine, 
  onEndLine,
  strokeColor = '#222',
  strokeWidth = 3,
  onColorChange,
  onWidthChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Desenhar as linhas recebidas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    lines.forEach(line => {
      if (!line.points || !line.points.length) return;
      
      ctx.beginPath();
      ctx.strokeStyle = line.color || '#222';
      ctx.lineWidth = line.width || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Suavização de linha - usando curvas de Bezier
      if (line.points.length === 1) {
        // Se só temos um ponto, desenhamos um círculo
        const pt = line.points[0];
        ctx.beginPath();
        ctx.arc(pt.x * canvas.width, pt.y * canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = line.color || '#222';
        ctx.fill();
      } else if (line.points.length === 2) {
        // Se temos apenas 2 pontos, desenhamos uma linha reta
        ctx.moveTo(line.points[0].x * canvas.width, line.points[0].y * canvas.height);
        ctx.lineTo(line.points[1].x * canvas.width, line.points[1].y * canvas.height);
      } else {
        // Para 3 ou mais pontos, usamos curvas para suavizar
        ctx.moveTo(line.points[0].x * canvas.width, line.points[0].y * canvas.height);
        
        for (let i = 1; i < line.points.length - 1; i++) {
          const xc = (line.points[i].x + line.points[i + 1].x) / 2 * canvas.width;
          const yc = (line.points[i].y + line.points[i + 1].y) / 2 * canvas.height;
          
          ctx.quadraticCurveTo(
            line.points[i].x * canvas.width, 
            line.points[i].y * canvas.height, 
            xc, yc
          );
        }
        
        // Último ponto
        const lastIdx = line.points.length - 1;
        ctx.lineTo(
          line.points[lastIdx].x * canvas.width, 
          line.points[lastIdx].y * canvas.height
        );
      }
      
      ctx.stroke();
    });
  }, [lines]);

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
    lastPoint.current = { x, y };
    onStartLine && onStartLine();
    onDraw?.({ x, y });
    
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
    
    // Se a distância é muito pequena, ignoramos para evitar pontos excedentes
    if (lastPoint.current) {
      const dx = Math.abs(x - lastPoint.current.x);
      const dy = Math.abs(y - lastPoint.current.y);
      if (dx < 0.003 && dy < 0.003) return;
    }
    
    lastPoint.current = { x, y };
    onDraw?.({ x, y });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    
    drawing.current = false;
    setTouchActive(false);
    lastPoint.current = null;
    onEndLine && onEndLine();
    
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
    onStartLine && onStartLine();
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    lastPoint.current = { x, y };
    onDraw?.({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawer || !drawing.current || e.pointerType === 'touch') return;
    e.preventDefault();
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Se a distância é muito pequena, ignoramos para evitar pontos excedentes
    if (lastPoint.current) {
      const dx = Math.abs(x - lastPoint.current.x);
      const dy = Math.abs(y - lastPoint.current.y);
      if (dx < 0.003 && dy < 0.003) return;
    }
    
    lastPoint.current = { x, y };
    onDraw?.({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawer || e.pointerType === 'touch') return;
    e.preventDefault();
    
    drawing.current = false;
    lastPoint.current = null;
    onEndLine && onEndLine();
  };

  const toggleTools = () => {
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
        <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded shadow flex flex-wrap gap-2 items-center">
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
        </div>
      )}
      
      {isDrawer && (
        <div className="flex justify-between mt-2">
          <button 
            className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
            onClick={() => setShowTools(!showTools)}
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