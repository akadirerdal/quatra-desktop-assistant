// @vitest-environment jsdom
/**
 * TitleBar — platform koşulu: macOS'te yerel trafik ışıkları kullanılır,
 * özel küçült/büyüt/kapat düğmeleri GÖSTERİLMEZ (yanıltıcı kopya olurdu).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TitleBar } from '../../../src/features/assistant/TitleBar';

function setPlatform(platform: string): void {
  (window as unknown as { quatra?: { platform?: string } }).quatra = { platform };
}

afterEach(() => {
  cleanup();
  delete (window as unknown as { quatra?: unknown }).quatra;
});

describe('TitleBar', () => {
  it('Windows/Linux: küçült/büyüt/kapat düğmeleri görünür', () => {
    render(<TitleBar />);
    expect(screen.getByLabelText('Küçült')).toBeTruthy();
    expect(screen.getByLabelText('Büyüt veya geri al')).toBeTruthy();
    expect(screen.getByLabelText('Kapat')).toBeTruthy();
  });

  it('Darwin: özel pencere düğmeleri gizlenir (yerel trafik ışıkları kullanılır)', () => {
    setPlatform('darwin');
    render(<TitleBar />);
    expect(screen.queryByLabelText('Küçült')).toBeNull();
    expect(screen.queryByLabelText('Büyüt veya geri al')).toBeNull();
    expect(screen.queryByLabelText('Kapat')).toBeNull();
  });
});
