/**
 * Visualizer durum makinesi — geçersiz geçişlere izin vermez.
 * UI animasyonları ve agent pipeline'ı bu kurallara uyar.
 */
export type VisualizerState = 'idle' | 'listening' | 'processing' | 'speaking' | 'muted' | 'error';

export const VISUALIZER_STATES: VisualizerState[] = [
  'idle',
  'listening',
  'processing',
  'speaking',
  'muted',
  'error',
];

/** İzinli geçişler (kaynak → hedefler). */
const TRANSITIONS: Record<VisualizerState, VisualizerState[]> = {
  idle: ['listening', 'processing', 'muted', 'error'],
  listening: ['idle', 'processing', 'muted', 'error'],
  processing: ['idle', 'speaking', 'muted', 'error'],
  speaking: ['idle', 'listening', 'processing', 'muted', 'error'],
  muted: ['idle', 'error'],
  error: ['idle', 'muted'],
};

export function canTransition(from: VisualizerState, to: VisualizerState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Geçiş izinliyse hedefi, değilse mevcut durumu döner (asla throw etmez — UI güvenli). */
export function transition(from: VisualizerState, to: VisualizerState): VisualizerState {
  return canTransition(from, to) ? to : from;
}

/** Geçersiz geçişi tespit eden katı sürüm (agent/tool katmanı hata yakalasın diye). */
export function assertTransition(from: VisualizerState, to: VisualizerState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Geçersiz visualizer geçişi: ${from} → ${to}`);
  }
}
