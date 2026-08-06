import { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageZoomProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageZoom({ src, alt = 'Zoomed image', onClose }: ImageZoomProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  const zoomIn = () => setScale((s) => Math.min(s * 1.2, 5));
  const zoomOut = () => setScale((s) => Math.max(s / 1.2, 0.5));
  const reset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  const rotate = () => {
    const img = imageRef.current;
    if (img) {
      const current = img.style.transform.match(/rotate\((\d+)deg\)/);
      const deg = current ? parseInt(current[1]) + 90 : 90;
      img.style.transform = `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${deg}deg)`;
    }
  };

  const onMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
      e.preventDefault();
    }
  };

  const onTouchStart = (e: React.TouchEvent<HTMLImageElement>) => {
    if (scale > 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setPosition({ x: touch.clientX - dragStart.current.x, y: touch.clientY - dragStart.current.y });
    };
    const onUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image zoom"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); zoomOut(); }}
          className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); zoomIn(); }}
          className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); reset(); }}
          className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          aria-label="Reset"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-2 rounded-2xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[90vh] object-contain"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.1s ease-out',
            cursor: scale > 1 ? 'grabbing' : 'grab',
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onDoubleClick={(e) => { e.stopPropagation(); scale < 2 ? zoomIn() : reset(); }}
        />
      </div>
    </div>
  );
}