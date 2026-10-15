/**
 * Ana ekran — minimal: marka, visualizer, durum, caption, mic pill, model pill,
 * saydam görev balonları, ayarlar dişlisi. Chat paneli YOK.
 */
import { useEffect, useState } from 'react';
import { Visualizer } from './Visualizer';
import { useAssistantStore } from '../../state/assistant-store';
import { useSettingsStore, activeModel } from '../../state/settings-store';
import { strings } from '../../renderer/strings';

export function MainScreen(props: {
  onOpenSettings: () => void;
  onToggleMic: () => void;
  onModeClick: () => void;
}): React.JSX.Element {
  const status = useAssistantStore((s) => s.status);
  const caption = useAssistantStore((s) => s.caption);
  const tasks = useAssistantStore((s) => s.tasks);
  const mode = useAssistantStore((s) => s.mode);
  const mutedByUser = useAssistantStore((s) => s.mutedByUser);
  const connection = useAssistantStore((s) => s.connection);
  const settings = useSettingsStore((s) => s.settings);
  const [captionVisible, setCaptionVisible] = useState(false);

  // Caption 5 sn sonra solar.
  useEffect(() => {
    if (!caption) {
      setCaptionVisible(false);
      return;
    }
    setCaptionVisible(true);
    const timer = setTimeout(() => setCaptionVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [caption]);

  const statusText: Record<string, string> = {
    idle: strings.statusIdle,
    listening: strings.statusListening,
    processing: strings.statusProcessing,
    speaking: strings.statusSpeaking,
    muted: strings.statusMuted,
    error: strings.statusError,
  };

  return (
    <main className="main">
      <div className="brand">{strings.appName}</div>

      {connection === 'offline' && <div className="offlineBadge">{strings.statusOffline}</div>}

      <button className="gearBtn" onClick={props.onOpenSettings} title={strings.settings} aria-label={strings.settings}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
        </svg>
      </button>

      <Visualizer />

      <div className="statusText">{statusText[status] ?? status}</div>
      <div className="statusHint">
        {status === 'idle' ? strings.statusIdleHint : ''}
        {status === 'muted' ? strings.micOff : ''}
      </div>

      <div className="caption" style={{ opacity: captionVisible ? 1 : 0 }}>
        {caption}
      </div>

      {/* Saydam görev balonları */}
      <div className="taskStack">
        {tasks.map((t) => (
          <div key={t.id} className={`taskBubble ${t.state} ${t.state === 'done' ? 'fading' : ''}`}>
            <div className="title">{t.title}</div>
            <div className="detail">{t.detail}</div>
          </div>
        ))}
      </div>

      {/* Mikrofon göstergesi */}
      <button className="micPill" onClick={props.onToggleMic} title={mutedByUser ? strings.micOn : strings.micOff}>
        <span className={`micDot ${status === 'listening' ? 'on' : mutedByUser ? 'off' : ''}`} />
        {mutedByUser ? strings.micOff : 'MIC'}
      </button>

      {/* Model göstergesi — tıkla mod değiştir */}
      <button className="modelPill" onClick={props.onModeClick} title={strings.modeFlash}>
        <span>DEEPSEEK</span>
        <span>{mode === 'pro' ? settings.provider.proModel : settings.provider.flashModel}</span>
        <span className="mode">· {mode === 'pro' ? strings.modePro : strings.modeFlash}</span>
      </button>
    </main>
  );
}

/** Ana ekranın mod değişiminde kullandığı yardımcı (test edilebilir). */
export function nextModeLabel(mode: 'flash' | 'pro'): string {
  return mode === 'flash' ? strings.modePro : strings.modeFlash;
}

export { activeModel };
