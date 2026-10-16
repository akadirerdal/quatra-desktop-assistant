import { describe, expect, it } from 'vitest';
import { isFallbackEligible } from '../../../src/providers/types';

describe('isFallbackEligible — yedek sağlayıcı kararı (V1-12)', () => {
  it('geçici hatalarda yedeğe geçilir', () => {
    for (const c of ['network', 'timeout', 'server', 'rate_limit', 'auth'] as const) {
      expect(isFallbackEligible(c)).toBe(true);
    }
  });

  it('kalıcı/içerik hatalarında geçilmez', () => {
    for (const c of ['cancelled', 'bad_request', 'unsupported', 'unknown'] as const) {
      expect(isFallbackEligible(c)).toBe(false);
    }
  });
});
