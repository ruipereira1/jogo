import React, { useRef, useEffect } from 'react';

interface Point { x: number; y: number; }
interface Line { points: Point[]; }
interface Props {
  lines: Line[];
  onDraw?: (point: Point) => void;
  isDrawer: boolean;
  onStartLine?: () => void;
  onEndLine?: () => void;
}

const DrawingCanvas: React.FC<Props> = ({ lines, onDraw, isDrawer, onStartLine, onEndLine }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  // Desenhar as linhas recebidas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    lines.forEach(line => {
      if (!line.points.length) return;
      ctx.beginPath();
      line.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x * canvas.width, pt.y * canvas.height);
        else ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
      });
      ctx.stroke();
    });
  }, [lines]);

  // Handlers de desenho
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawer) return;
    drawing.current = true;
    onStartLine && onStartLine();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onDraw?.({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawer || !drawing.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onDraw?.({ x, y });
  };

  const handlePointerUp = () => {
    if (!isDrawer) return;
    drawing.current = false;
    onEndLine && onEndLine();
    // Opcional: notificar fim da linha
  };

  return (
    <canvas
      ref={canvasRef}
      width={500}
      height={350}
      style={{ width: '100%', maxWidth: 500, background: 'white', borderRadius: 8, border: '2px solid #FFD600' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
};

export default DrawingCanvas; 