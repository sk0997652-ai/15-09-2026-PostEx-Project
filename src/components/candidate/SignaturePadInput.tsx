import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenTool, Eraser, RotateCcw, Type, Check, ShieldCheck } from 'lucide-react';

export interface SignaturePadInputProps {
  id?: string;
  value?: string | { dataUrl?: string; typedName?: string; mode?: 'draw' | 'type' };
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  candidateName?: string;
  signingId?: string;
  height?: number;
}

export const SignaturePadInput: React.FC<SignaturePadInputProps> = ({
  id = 'signature-pad',
  value,
  onChange,
  disabled = false,
  candidateName = '',
  signingId = '',
  height = 200,
}) => {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastMidRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);

  // Parse initial value if provided
  useEffect(() => {
    if (typeof value === 'string' && value) {
      if (value.startsWith('data:image')) {
        setMode('draw');
        setHasDrawn(true);
        // Load image onto canvas
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }
          }
        };
        img.src = value;
      } else {
        setMode('type');
        setTypedName(value);
      }
    } else if (value && typeof value === 'object') {
      if (value.mode === 'type' || value.typedName) {
        setMode('type');
        setTypedName(value.typedName || '');
      } else if (value.dataUrl) {
        setMode('draw');
        setHasDrawn(true);
      }
    } else if (candidateName && !typedName) {
      setTypedName(candidateName);
    }
  }, [value, candidateName]);

  const initContext = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#0f172a'; // Deep slate ink
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }, []);

  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        initContext(ctx);
      }
    }
  }, [mode, initContext]);

  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    isDrawingRef.current = true;
    initContext(ctx);

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

    // Save history for undo
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    // Draw initial dot for instantaneous feedback
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();

    lastPointRef.current = { x, y };
    lastMidRef.current = { x, y };
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPointRef.current || !lastMidRef.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nativeEvt = e.nativeEvent as PointerEvent;
    let eventsToProcess: (PointerEvent | React.PointerEvent<HTMLCanvasElement>)[] = [e];
    if (typeof nativeEvt?.getCoalescedEvents === 'function') {
      try {
        const coalesced = nativeEvt.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          eventsToProcess = coalesced;
        }
      } catch {
        eventsToProcess = [e];
      }
    }

    for (let i = 0; i < eventsToProcess.length; i++) {
      const pt = eventsToProcess[i];
      const { x, y } = getCanvasCoordinates(pt.clientX, pt.clientY);

      // Sub-pixel jitter suppression (filter micro-tremors below 1 physical px)
      const dx = x - lastPointRef.current.x;
      const dy = y - lastPointRef.current.y;
      if (dx * dx + dy * dy < 1.0) continue;

      const midX = (lastPointRef.current.x + x) / 2;
      const midY = (lastPointRef.current.y + y) / 2;

      ctx.beginPath();
      ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
      // Chaikin quadratic Bézier interpolation for continuous C1 smooth curve
      ctx.quadraticCurveTo(lastPointRef.current.x, lastPointRef.current.y, midX, midY);
      ctx.stroke();

      lastPointRef.current = { x, y };
      lastMidRef.current = { x: midX, y: midY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current && lastPointRef.current && lastMidRef.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.moveTo(lastMidRef.current.x, lastMidRef.current.y);
          ctx.lineTo(lastPointRef.current.x, lastPointRef.current.y);
          ctx.stroke();
        }

        // Export data URL
        const dataUrl = canvas.toDataURL('image/png');
        if (onChange) {
          onChange(dataUrl);
        }
      }
      isDrawingRef.current = false;
      lastPointRef.current = null;
      lastMidRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const clear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    setHasDrawn(false);
    if (onChange) {
      onChange('');
    }
  };

  const undo = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (historyRef.current.length > 0) {
      const prevState = historyRef.current.pop()!;
      ctx.putImageData(prevState, 0, 0);
      if (historyRef.current.length === 0) {
        setHasDrawn(false);
        if (onChange) onChange('');
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        if (onChange) onChange(dataUrl);
      }
    }
  };

  const handleTypedChange = (val: string) => {
    setTypedName(val);
    if (onChange) {
      // Create a rendered SVG or pass typed text
      onChange(val);
    }
  };

  return (
    <div id={id} className="space-y-2.5">
      {/* Mode Switcher */}
      {!disabled && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              id={`${id}-tab-draw`}
              onClick={() => setMode('draw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'draw'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Draw Signature</span>
            </button>
            <button
              type="button"
              id={`${id}-tab-type`}
              onClick={() => setMode('type')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mode === 'type'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Type Name</span>
            </button>
          </div>

          {signingId && (
            <span className="text-[11px] font-mono text-slate-400">
              ID: {signingId}
            </span>
          )}
        </div>
      )}

      {/* DRAW CANVAS MODE */}
      {mode === 'draw' ? (
        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/60 overflow-hidden group">
          <canvas
            ref={canvasRef}
            id={`${id}-canvas`}
            width={1200}
            height={360}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ height: `${height}px` }}
            className={`w-full cursor-crosshair touch-none select-none ${
              disabled ? 'pointer-events-none opacity-80' : ''
            }`}
          />

          {!hasDrawn && !disabled && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
              <PenTool className="w-6 h-6 mb-1 opacity-40" />
              <span className="text-xs font-medium">Draw your signature with mouse, stylus, or finger</span>
            </div>
          )}

          {/* Action Toolbar */}
          {!disabled && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-slate-200 shadow-2xs">
              <button
                type="button"
                id={`${id}-undo-btn`}
                onClick={undo}
                disabled={!hasDrawn}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded disabled:opacity-30 cursor-pointer transition-colors"
                title="Undo last stroke"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id={`${id}-clear-btn`}
                onClick={clear}
                disabled={!hasDrawn}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded disabled:opacity-30 cursor-pointer transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* TYPE SIGNATURE MODE */
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <input
              type="text"
              id={`${id}-typed-input`}
              disabled={disabled}
              value={typedName}
              onChange={(e) => handleTypedChange(e.target.value)}
              placeholder="Type your full legal name"
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-xl font-serif italic text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-70 shadow-2xs"
            />
            {typedName && (
              <div className="mt-3 p-3 bg-white rounded-xl border border-indigo-100 flex items-center justify-between">
                <span className="text-2xl font-serif italic font-bold text-indigo-900 select-none">
                  {typedName}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  E-Signed
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Continuous high-fidelity digital stroke capture &bull; Legally binding under Pakistani ETO (2002).</span>
      </p>
    </div>
  );
};
