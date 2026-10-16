/**
 * Visualizer — Quatra'nın merkez görseli.
 * - Gerçek mikrofon seviyesi store.micLevel'dan gelir (sahte animasyon YOK).
 * - Konuşma sırasında speakLevel gerçek sinyal yoksa dürüst nefes dalgası kullanılır.
 * - Math.random() kullanılmaz; tüm hareketler deterministiktir.
 * - reducedMotion ve pencere odağı kaybında animasyonlar durur.
 */
import { useEffect, useRef } from 'react';
import { useAssistantStore } from '../../state/assistant-store';
import { useSettingsStore } from '../../state/settings-store';
import { accentFamily, getTheme } from '../../renderer/themes';
import type { VisualizerState } from '../../state/assistant-store';

const TAU = Math.PI * 2;

export function Visualizer(props: { width?: number; height?: number }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const status = useAssistantStore((s) => s.status);
  const micLevel = useAssistantStore((s) => s.micLevel);
  const speakLevel = useAssistantStore((s) => s.speakLevel);
  const appearance = useSettingsStore((s) => s.settings.appearance);

  // Seviyeler render sırasında ref'e yazılır; RAF döngüsü yeniden kurulmaz (performans).
  const micRef = useRef(micLevel);
  micRef.current = micLevel;
  const speakRef = useRef(speakLevel);
  speakRef.current = speakLevel;

  const size = { w: props.width ?? 420, h: props.height ?? 220 };

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return; // jsdom/test ortamı
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const appRef = appearance;
    const stateRef: { status: VisualizerState } = { status };

    const draw = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      const focused = document.hasFocus();
      const speed = appRef.animationSpeed;
      const reduced = appRef.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (focused && !reduced) t += dt * 0.001 * speed;

      const { w, h } = size;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const glow = appRef.glow;
      const intensity = appRef.intensity;
      const accent = appRef.accent;
      const accentBright = accentFamily(accent).bright;
      const mutedColor = getTheme(appRef.theme).vars.muted;

      const drawLine = (y: number, half: number, alpha: number) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - half, y);
        ctx.lineTo(cx + half, y);
        ctx.stroke();
        ctx.restore();
      };

      const drawRing = (radius: number, alpha: number, width = 1.6) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = accent;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.stroke();
        ctx.restore();
      };

      switch (stateRef.status) {
        case 'idle': {
          // Sakin çizgi + çok hafif ışıltı (statik).
          const half = 90;
          ctx.save();
          ctx.globalAlpha = 0.18 * glow;
          ctx.strokeStyle = accent;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(cx - half, cy);
          ctx.lineTo(cx + half, cy);
          ctx.stroke();
          ctx.restore();
          drawLine(cy, half, 0.9);
          break;
        }
        case 'listening': {
          // Nefes alan halka + GERÇEK mic seviyesi ile yarıçap salınımı.
          const breath = 1 + Math.sin(t * 1.6) * 0.06; // nefes (deterministik)
          const base = 34 * intensity + 22;
          const radius = base * breath + micRef.current * 22;
          drawRing(radius, 0.25, 8);
          drawRing(radius, 0.85, 1.8);
          drawRing(radius * 0.72, 0.4, 1.2);
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'processing': {
          // Yavaş yörünge — bir nokta halkada döner.
          const radius = 30 * intensity + 16;
          drawRing(radius, 0.2, 1.4);
          const angle = t * 1.1;
          ctx.save();
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 4, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, TAU);
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'speaking': {
          // Dalga: speakLevel gerçek sinyalse onu; yoksa dürüst yumuşak dalga (sabit, rastgele değil).
          const amp = speakRef.current > 0.02 ? 14 + speakRef.current * 46 : 22 + Math.sin(t * 1.4) * 8;
          const bars = 26;
          const bw = 3;
          const gap = 4;
          const total = bars * (bw + gap) - gap;
          let x = cx - total / 2;
          for (let i = 0; i < bars; i++) {
            // Deterministik zarf — sinüs tabanlı, rastgelelik yok.
            const env = 0.25 + 0.75 * Math.abs(Math.sin((i / (bars - 1)) * Math.PI * 2.2 + t * 1.8));
            const bh = Math.max(2, amp * env);
            ctx.save();
            ctx.globalAlpha = 0.35 + 0.6 * env;
            ctx.fillStyle = env > 0.65 ? accentBright : accent;
            ctx.fillRect(x, cy - bh / 2, bw, bh);
            ctx.restore();
            x += bw + gap;
          }
          break;
        }
        case 'muted': {
          // Sade duraklama: kesikli, soluk çizgi. Kırmızı çapraz işaret kaldırıldı —
          // amatör duruyordu; "kapalı" bilgisi MIC düğmesi + durum metninde yaşıyor.
          const half = 80;
          ctx.save();
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = mutedColor;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.setLineDash([5, 9]);
          ctx.beginPath();
          ctx.moveTo(cx - half, cy);
          ctx.lineTo(cx + half, cy);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'error': {
          const half = 70;
          drawLine(cy, half, 0.55);
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = '#f06a6a';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy - 22, 5, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = '#f06a6a';
          ctx.fillText('!', cx - 1.5, cy - 19.5);
          ctx.restore();
          break;
        }
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [status, appearance, size.w, size.h]);

  return (
    <canvas
      ref={canvasRef}
      width={size.w}
      height={size.h}
      style={{ width: size.w, height: size.h }}
      aria-label="Quatra durum göstergesi"
    />
  );
}
