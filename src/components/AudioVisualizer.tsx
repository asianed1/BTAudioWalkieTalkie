import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  rmsDb: number;
  color?: string;
  label?: string;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isActive,
  rmsDb,
  color = '#10B981',
  label,
  height = 54
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Normalized amplitude 0.0 to 1.0 from -60dB to 0dB
    const normalizedAmp = isActive ? Math.max(0.08, (rmsDb + 60) / 60) : 0.02;

    const render = () => {
      phaseRef.current += isActive ? 0.15 : 0.03;
      const width = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, width, h);

      // Draw subtle grid baseline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      // Draw multi-layer wave
      const layers = [
        { opacity: 0.25, freq: 0.04, speed: 1.2, ampMult: 0.6 },
        { opacity: 0.6, freq: 0.08, speed: 1.8, ampMult: 0.85 },
        { opacity: 1.0, freq: 0.12, speed: 2.2, ampMult: 1.0 },
      ];

      layers.forEach(({ opacity, freq, speed, ampMult }) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.globalAlpha = isActive ? opacity : 0.15;
        ctx.lineWidth = 1.8;

        for (let x = 0; x < width; x += 2) {
          const envelope = Math.sin((x / width) * Math.PI); // Windowing at edges
          const y = midY + Math.sin(x * freq + phaseRef.current * speed) * (h * 0.38) * normalizedAmp * ampMult * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      ctx.globalAlpha = 1.0;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive, rmsDb, color]);

  return (
    <div className="w-full flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>{label}</span>
          <span className="font-mono text-[10px] text-slate-300">
            {isActive ? `${Math.round(rmsDb)} dBFS` : 'IDLE (-60 dBFS)'}
          </span>
        </div>
      )}
      <div className="w-full rounded-lg bg-slate-950/70 border border-slate-800/80 p-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={280}
          height={height}
          className="w-full block rounded"
        />
      </div>
    </div>
  );
};
