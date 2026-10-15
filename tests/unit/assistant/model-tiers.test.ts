import { describe, expect, it } from 'vitest';
import { applyTier, currentTierId, MODEL_TIERS } from '../../../src/features/assistant/model-tiers';
import { sanitizeSettings } from '../../../src/state/settings-schema';

describe('model tiers', () => {
  it('varsayılan ayar "default" seviyesine denk gelir (chat/0.7/2048)', () => {
    const s = sanitizeSettings({});
    expect(currentTierId(s, 'flash')).toBe('default');
    expect(currentTierId(s, 'pro')).toBeNull(); // pro modeli reasoner, parametreler chat ile aynı
  });

  it('seviye uygulanınca gerçek model + parametre yazılır', () => {
    const s = sanitizeSettings({});
    const patch = applyTier(s, 'flash', 'max');
    expect(patch).not.toBeNull();
    expect(patch!.flashModel).toBe('deepseek-reasoner');
    expect(patch!.temperature).toBe(1.0);
    expect(patch!.maxTokens).toBe(8192);
  });

  it('pro modda seviye proModeli günceller', () => {
    const s = sanitizeSettings({});
    const patch = applyTier(s, 'pro', 'low');
    expect(patch!.proModel).toBe('deepseek-chat');
    expect(patch!.flashModel).toBeUndefined();
  });

  it('bilinmeyen seviye null döner', () => {
    const s = sanitizeSettings({});
    expect(applyTier(s, 'flash', 'yok')).toBeNull();
  });

  it('tüm seviyeler geçerli sınırlarda', () => {
    for (const t of MODEL_TIERS) {
      expect(t.temperature).toBeGreaterThanOrEqual(0);
      expect(t.temperature).toBeLessThanOrEqual(2);
      expect(t.maxTokens).toBeGreaterThan(0);
      expect(t.maxTokens).toBeLessThanOrEqual(8192);
    }
  });
});
