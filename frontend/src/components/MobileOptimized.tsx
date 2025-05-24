import React, { useEffect } from 'react';

interface MobileOptimizedProps {
  children: React.ReactNode;
  preventZoom?: boolean;
}

const MobileOptimized: React.FC<MobileOptimizedProps> = ({ 
  children, 
  preventZoom = true 
}) => {
  useEffect(() => {
    // Configurar viewport para dispositivos móveis
    const viewport = document.querySelector('meta[name="viewport"]');
    const originalContent = viewport?.getAttribute('content');
    
    if (preventZoom) {
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      } else {
        const meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        document.getElementsByTagName('head')[0].appendChild(meta);
      }
    }

    // Prevenir zoom duplo-toque em iOS
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    if (preventZoom) {
      document.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    // Cleanup
    return () => {
      if (viewport && originalContent) {
        viewport.setAttribute('content', originalContent);
      }
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [preventZoom]);

  return <>{children}</>;
};

export default MobileOptimized; 