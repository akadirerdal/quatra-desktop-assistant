import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/core/config';

describe('loadConfig', () => {
  it('returns defaults', () => {
    const cfg = loadConfig();
    expect(cfg.appName).toBe('Quatra Desktop Assistant');
  });

  it('applies overrides', () => {
    const cfg = loadConfig({ defaultProvider: 'openai' });
    expect(cfg.defaultProvider).toBe('openai');
  });
});
