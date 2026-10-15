import { describe, expect, it } from 'vitest';
import {
  assertTransition,
  canTransition,
  transition,
} from '../../src/features/assistant/visualizer-machine';

describe('visualizer state machine', () => {
  it('izinli geçişleri kabul eder', () => {
    expect(canTransition('idle', 'listening')).toBe(true);
    expect(canTransition('listening', 'processing')).toBe(true);
    expect(canTransition('processing', 'speaking')).toBe(true);
    expect(canTransition('speaking', 'idle')).toBe(true);
    expect(canTransition('idle', 'muted')).toBe(true);
    expect(canTransition('error', 'idle')).toBe(true);
  });

  it('geçersiz geçişleri reddeder', () => {
    expect(canTransition('idle', 'speaking')).toBe(false);
    expect(canTransition('error', 'listening')).toBe(false);
    expect(canTransition('muted', 'speaking')).toBe(false);
    expect(canTransition('listening', 'speaking')).toBe(false);
  });

  it('transition() geçersizde mevcut durumu korur (UI güvenli)', () => {
    expect(transition('idle', 'speaking')).toBe('idle');
    expect(transition('muted', 'speaking')).toBe('muted');
  });

  it('assertTransition() geçersizde throw eder', () => {
    expect(() => assertTransition('idle', 'speaking')).toThrow(/Geçersiz/);
  });
});
