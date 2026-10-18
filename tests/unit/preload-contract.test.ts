// @vitest-environment node
/**
 * Preload köprüsü ile renderer tipi sözleşmesi (V1.2-082, V1.2-101).
 * Tek kaynak: electron/preload.ts. Derleme zamanında uyumsuzluk varsa `tsc --noEmit` hata verir.
 */
import { describe, it, expect } from 'vitest';
import type { QuatraBridge as GlobalBridge } from '../../src/renderer/global';
import type { QuatraBridge as PreloadBridge } from '../../electron/preload';

// Aynı tip olmalı (alias).
type _Check = GlobalBridge extends PreloadBridge
  ? PreloadBridge extends GlobalBridge
    ? true
    : never
  : never;
const _check: _Check = true;
void _check;

describe('preload contract', () => {
  it('tip sözleşmesi derleme zamanında doğrulanır', () => {
    expect(true).toBe(true);
  });
});
