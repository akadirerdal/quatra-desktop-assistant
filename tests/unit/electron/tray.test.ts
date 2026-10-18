/**
 * electron/tray — menü güncel pencereyi dinamik çözer; yok edilmiş pencereye send yok (V1.2-032).
 * `electron` mock'lanır; gerçek tepsi/pencere oluşturulmaz.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

interface MenuItem {
  label?: string;
  type?: string;
  click?: () => void;
}

const mockState = vi.hoisted(() => ({
  windows: [] as unknown[],
  template: [] as MenuItem[],
  trayHandlers: new Map<string, () => void>(),
}));

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => mockState.windows },
  Menu: {
    buildFromTemplate: (t: unknown[]) => {
      mockState.template = t as MenuItem[];
      return { items: mockState.template };
    },
  },
  Tray: class {
    setToolTip(): void {
      // yok say
    }
    setContextMenu(): void {
      // yok say
    }
    on(event: string, cb: () => void): void {
      mockState.trayHandlers.set(event, cb);
    }
  },
  Notification: class {
    show(): void {
      // yok say
    }
  },
  nativeImage: {
    createFromPath: () => ({
      isEmpty: () => true,
      addRepresentation: () => undefined,
      setTemplateImage: () => undefined,
    }),
    createEmpty: () => ({ isEmpty: () => true }),
  },
}));

import { __resetTrayForTests, createTray, showMainWindow } from '../../../electron/tray';

class FakeWindow {
  destroyed = false;
  visible = false;
  minimized = false;
  webContents = { destroyed: false, send: vi.fn() };
  show = vi.fn();
  restore = vi.fn();
  focus = vi.fn();
  isDestroyed(): boolean {
    return this.destroyed;
  }
  isVisible(): boolean {
    return this.visible;
  }
  isMinimized(): boolean {
    return this.minimized;
  }
}

function asWindow(w: FakeWindow): BrowserWindow {
  return w as unknown as BrowserWindow;
}

function menuItem(label: string): MenuItem {
  const item = mockState.template.find((i) => i.label === label);
  if (!item?.click) throw new Error(`menü öğesi yok: ${label}`);
  return item;
}

beforeEach(() => {
  __resetTrayForTests();
  mockState.windows.length = 0;
  mockState.template.length = 0;
  mockState.trayHandlers.clear();
});

describe('tray', () => {
  it('menü öğeleri canlı pencereye bağlanır', () => {
    const win = new FakeWindow();
    mockState.windows.push(win);
    createTray(asWindow(win), vi.fn());

    menuItem('Mikrofonu Aç/Kapat').click!();
    expect(win.webContents.send).toHaveBeenCalledWith('app:command', { name: 'toggle-mic' });

    menuItem("Quatra'yı Göster").click!();
    expect(win.show).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();

    menuItem('Ayarları Aç').click!();
    expect(win.webContents.send).toHaveBeenCalledWith('app:command', { name: 'open-settings' });
  });

  it('pencere yeniden oluşturulduysa GÜNCEL pencere kullanılır', () => {
    const oldWin = new FakeWindow();
    mockState.windows.push(oldWin);
    createTray(asWindow(oldWin), vi.fn());

    // Pencere yeniden oluşturuldu: eskisi yok, yenisi canlı.
    oldWin.destroyed = true;
    const newWin = new FakeWindow();
    mockState.windows.length = 0;
    mockState.windows.push(newWin);

    menuItem('Mikrofonu Aç/Kapat').click!();
    expect(oldWin.webContents.send).not.toHaveBeenCalled();
    expect(newWin.webContents.send).toHaveBeenCalledWith('app:command', { name: 'toggle-mic' });

    menuItem("Quatra'yı Göster").click!();
    expect(newWin.show).toHaveBeenCalled();
    expect(newWin.focus).toHaveBeenCalled();
  });

  it('hiç canlı pencere yoksa tıklamalar sessizce yok sayılır (çökme yok)', () => {
    const win = new FakeWindow();
    mockState.windows.push(win);
    createTray(asWindow(win), vi.fn());

    win.destroyed = true;
    mockState.windows.length = 0;
    expect(() => {
      menuItem('Mikrofonu Aç/Kapat').click!();
      menuItem("Quatra'yı Göster").click!();
      menuItem('Ayarları Aç').click!();
    }).not.toThrow();
    expect(win.webContents.send).not.toHaveBeenCalled();
  });

  it('showMainWindow null/yok edilmiş pencerede güvenli', () => {
    expect(() => showMainWindow(null)).not.toThrow();
    const win = new FakeWindow();
    win.destroyed = true;
    expect(() => showMainWindow(asWindow(win))).not.toThrow();
    expect(win.show).not.toHaveBeenCalled();
  });
});
