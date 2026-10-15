/**
 * Uygulama kökü — ErrorBoundary, ayarlar yükleme, first-run, PTT, Esc, mod döngüsü.
 */
import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MainScreen } from '../features/assistant/MainScreen';
import { TitleBar } from '../features/assistant/TitleBar';
import { SettingsPanel } from '../features/settings/SettingsPanel';
import { AssistantController } from '../features/assistant/assistant-controller';
import { useAssistantStore } from '../state/assistant-store';
import { useSettingsStore } from '../state/settings-store';
import { setSettingsBackend } from '../state/settings-store';
import { IpcSettingsBackend } from './ipc-bridge';
import { strings } from './strings';

class ErrorBoundary extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError(): { broken: boolean } {
    return { broken: true };
  }
  render(): ReactNode {
    if (this.state.broken) {
      return (
        <div style={{ padding: 40, fontFamily: 'system-ui' }}>
          <h3>Quatra arayüzü yeniden başlatılmalı.</h3>
          <p style={{ opacity: 0.7 }}>Bir bileşen beklenmedik şekilde durdu. Uygulama diğer bölümleriyle çalışmaya devam eder.</p>
          <button
            onClick={() => this.setState({ broken: false })}
            style={{ padding: '8px 14px', cursor: 'pointer' }}
          >
            Tekrar dene
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function keyCombo(e: KeyboardEvent, configured: string): boolean {
  const parts = configured.split('+').map((p) => p.trim().toLowerCase());
  const mods = {
    ctrl: e.ctrlKey,
    control: e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    meta: e.metaKey,
  };
  const keys = parts.filter((p) => !(p in mods));
  const keyOk = keys.length > 0 && keys.every((k) => e.key.toLowerCase() === k);
  const modsOk = parts.filter((p) => p in mods).every((m) => mods[m as keyof typeof mods]);
  return keyOk && modsOk;
}

export function App(): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const controllerRef = useRef<AssistantController | null>(null);
  if (!controllerRef.current) controllerRef.current = new AssistantController();
  const controller = controllerRef.current;

  const loadSettings = useSettingsStore((s) => s.load);
  const mutedByUser = useAssistantStore((s) => s.mutedByUser);

  useEffect(() => {
    if (window.quatra) setSettingsBackend(new IpcSettingsBackend());
    void loadSettings();
    void window.quatra?.credentials.has().then((has) => {
      if (!has) setFirstRun(true);
    });
    // Mount sinyali: main süreç "renderer hazır" loglar (boş ekran teşhisi).
    window.quatra?.app.rendererReady();
    return () => controller.dispose();
  }, [controller, loadSettings]);

  // Esc: ayarları kapat / işlemi iptal et.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        controller.interrupt();
        return;
      }
      const mode = useSettingsStore.getState().settings.activation.mode;
      if (mode === 'push_to_talk') {
        const key = useSettingsStore.getState().settings.activation.pushToTalkKey;
        if (keyCombo(e, key) && !e.repeat) {
          e.preventDefault();
          controller.toggleListening();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, settingsOpen]);

  const toggleMic = () => {
    if (mutedByUser) {
      controller.setMuted(false);
    } else {
      controller.setMuted(true);
    }
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <TitleBar />
        <MainScreen onOpenSettings={() => setSettingsOpen(true)} onToggleMic={toggleMic} />
        {settingsOpen && (
          <ErrorBoundary>
            <SettingsPanel onClose={() => setSettingsOpen(false)} controller={controller} />
          </ErrorBoundary>
        )}
        {firstRun && (
          <div className="firstRun">
            <div className="card">
              <h2>{strings.firstRunTitle}</h2>
              <p>{strings.firstRunBody}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button className="btn" onClick={() => setFirstRun(false)}>
                  {strings.firstRunLater}
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setFirstRun(false);
                    setSettingsOpen(true);
                  }}
                >
                  {strings.firstRunGo}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
