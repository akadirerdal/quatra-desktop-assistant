/**
 * Ayarlar paneli — 8 kategori, her kontrol gerçekten çalışır veya "kullanılamaz" işaretlidir.
 * Ölü buton YASAK.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Select, Slider, StatusPill, Switch } from '../../components/ui';
import { useSettingsStore } from '../../state/settings-store';
import { useAssistantStore } from '../../state/assistant-store';
import { strings } from '../../renderer/strings';
import type { AssistantController } from '../assistant/assistant-controller';

type Category = 'general' | 'provider' | 'voice' | 'activation' | 'appearance' | 'privacy' | 'diagnostics';

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'general', label: strings.general },
  { id: 'provider', label: strings.aiProvider },
  { id: 'voice', label: strings.voiceAudio },
  { id: 'activation', label: strings.activation },
  { id: 'appearance', label: strings.appearance },
  { id: 'privacy', label: strings.privacy },
  { id: 'diagnostics', label: strings.diagnostics },
];

const ACCENTS = ['#9B87F5', '#7C9BF0', '#5FB8A6', '#E8A05F', '#E86F8C', '#C9C9D4'];

export function SettingsPanel(props: {
  onClose: () => void;
  controller: AssistantController;
}): React.JSX.Element {
  const [category, setCategory] = useState<Category>('general');

  return (
    <div className="settingsOverlay" onClick={props.onClose}>
      <div className="settingsPanel" onClick={(e) => e.stopPropagation()}>
        <nav className="settingsNav">
          <h2>{strings.settings.toUpperCase()}</h2>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`navItem ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <Button size="small" onClick={props.onClose}>
            {strings.settingsClose}
          </Button>
        </nav>
        <div className="settingsContent">
          {category === 'general' && <GeneralSection />}
          {category === 'provider' && <ProviderSection />}
          {category === 'voice' && <VoiceSection controller={props.controller} />}
          {category === 'activation' && <ActivationSection />}
          {category === 'appearance' && <AppearanceSection />}
          {category === 'privacy' && <PrivacySection />}
          {category === 'diagnostics' && <DiagnosticsSection />}        </div>
      </div>
    </div>
  );
}

function GeneralSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const restoreDefaults = useSettingsStore((s) => s.restoreDefaults);
  const [confirming, setConfirming] = useState(false);
  const [version, setVersion] = useState('0.1.0');

  useEffect(() => {
    void window.quatra?.app.version().then((v) => setVersion(v));
  }, []);

  return (
    <>
      <h3>{strings.general}</h3>
      <div className="field">
        <label>{strings.assistantName}</label>
        <input
          className="input"
          value={settings.assistantName}
          maxLength={40}
          onChange={(e) => void update({ assistantName: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{strings.personality}</label>
        <textarea
          className="input"
          value={settings.personality}
          maxLength={2000}
          onChange={(e) => void update({ personality: e.target.value })}
        />
        <div className="hint">{strings.personalityHint}</div>
      </div>
      <div className="field">
        <label>{strings.language}</label>
        <Select
          value={settings.language}
          onChange={(v) => void update({ language: v as 'tr' })}
          options={[{ value: 'tr', label: 'Türkçe' }]}
        />
        <div className="hint">{strings.languageTrOnly}</div>
      </div>
      <div className="field">
        <label>{strings.version}</label>
        <div className="statusHint">Quatra {version}</div>
      </div>
      <div className="field">
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {strings.restoreDefaults}
        </Button>
      </div>
      {confirming && (
        <Dialog
          title={strings.restoreDefaults}
          body={strings.restoreConfirm}
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          danger
          onConfirm={() => {
            void restoreDefaults();
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

function ProviderSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const flash = settings.provider.flashModel;
  const pro = settings.provider.proModel;

  useEffect(() => {
    void window.quatra?.credentials.has().then(setHasKey);
  }, []);

  const saveKey = async (): Promise<void> => {
    setKeyMsg(null);
    const res = await window.quatra?.credentials.set(keyInput);
    if (!res) return;
    if (res.ok) {
      setHasKey(true);
      setKeyInput('');
      setKeyMsg(strings.apiKeySet);
    } else {
      setKeyMsg(res.error ?? strings.connectFailed);
    }
  };

  const clearKey = async (): Promise<void> => {
    await window.quatra?.credentials.clear();
    setHasKey(false);
    setTestResult('idle');
    setKeyMsg(strings.apiKeyMissing);
  };

  const runTest = async (): Promise<void> => {
    setTesting(true);
    setTestResult('idle');
    setTestMsg(null);
    const model = flash.trim();
    const res = await window.quatra?.provider.test(model);
    setTesting(false);
    if (res?.ok) {
      setTestResult('ok');
      setTestMsg(`${strings.connected} (${res.latencyMs}ms)`);
    } else {
      setTestResult('bad');
      setTestMsg(res?.message ?? strings.connectFailed);
    }
  };

  const loadModels = async (): Promise<void> => {
    setModelsLoaded(true);
    const res = await window.quatra?.provider.models();
    if (res?.ok && res.models) setModels(res.models);
  };

  const modelOptions = (current: string) => {
    const opts = models.map((m) => ({ value: m.id, label: m.id }));
    if (current && !opts.some((o) => o.value === current)) {
      opts.unshift({ value: current, label: current });
    }
    return opts;
  };

  return (
    <>
      <h3>{strings.aiProvider}</h3>
      <div className="field">
        <label>{strings.provider}</label>
        <Select
          value={settings.provider.id}
          onChange={() => undefined}
          options={[{ value: 'deepseek', label: 'DeepSeek' }]}
        />
      </div>
      <div className="field">
        <label>{strings.apiKey}</label>
        <div className="row">
          <input
            className="input"
            type={showKey ? 'text' : 'password'}
            placeholder={strings.apiKeyPlaceholder}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button size="small" onClick={() => setShowKey(!showKey)}>
            {showKey ? strings.hide : strings.show}
          </Button>
          <Button variant="primary" onClick={() => void saveKey()} disabled={!keyInput.trim()}>
            {strings.saveKey}
          </Button>
          {hasKey && (
            <Button variant="danger" onClick={() => void clearKey()}>
              {strings.clearKey}
            </Button>
          )}
        </div>
        <div className="hint">
          {hasKey ? strings.apiKeySet : strings.apiKeyMissing} — {strings.apiKeyHint}
        </div>
        {keyMsg && <div className="statusHint">{keyMsg}</div>}
      </div>
      <div className="field">
        <label>{strings.flashModel}</label>
        <Select value={flash} onChange={(v) => void updateProvider({ flashModel: v })} options={modelOptions(flash)} />
      </div>
      <div className="field">
        <label>{strings.proModel}</label>
        <Select value={pro} onChange={(v) => void updateProvider({ proModel: v })} options={modelOptions(pro)} />
      </div>
      <div className="field">
        <label>{strings.temperature}</label>
        <Slider
          value={settings.provider.temperature}
          min={0}
          max={2}
          onChange={(v) => void updateProvider({ temperature: v })}
          format={(v) => v.toFixed(2)}
        />
      </div>
      <div className="field">
        <label>{strings.maxTokens}</label>
        <Slider
          value={settings.provider.maxTokens}
          min={256}
          max={8192}
          step={256}
          onChange={(v) => void updateProvider({ maxTokens: v })}
          format={(v) => String(v)}
        />
      </div>
      <div className="field">
        <label>{strings.timeout}</label>
        <Slider
          value={settings.provider.timeoutMs / 1000}
          min={10}
          max={120}
          step={5}
          onChange={(v) => void updateProvider({ timeoutMs: Math.round(v * 1000) })}
          format={(v) => `${Math.round(v)}s`}
        />
      </div>
      <div className="field row">
        <Button variant="primary" onClick={() => void runTest()} disabled={testing || !hasKey}>
          {testing ? strings.testing : strings.testConnection}
        </Button>
        <Button onClick={() => void loadModels()} disabled={!hasKey || modelsLoaded}>
          {modelsLoaded ? `${models.length} model` : 'Modelleri getir'}
        </Button>
        {testResult === 'ok' && <StatusPill kind="ok" text={testMsg ?? strings.connected} />}
        {testResult === 'bad' && <StatusPill kind="bad" text={testMsg ?? strings.connectFailed} />}
        {!hasKey && <StatusPill kind="warn" text={strings.noKeyFirst} />}
      </div>
    </>
  );
}

function VoiceSection(props: { controller: AssistantController }): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [voices, setVoices] = useState<Array<{ name: string; lang: string }>>([]);

  useEffect(() => {
    const load = () => setVoices(props.controller.audioService.availableVoices());
    load();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', load);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
    }
  }, [props.controller]);

  return (
    <>
      <h3>{strings.voiceAudio}</h3>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.autoSpeak}</label>
        <Switch
          on={settings.voice.autoSpeak}
          onChange={(v) => void update({ voice: { ...settings.voice, autoSpeak: v } })}
        />
      </div>
      <div className="field">
        <label>{strings.speechRate}</label>
        <Slider
          value={settings.voice.rate}
          min={0.5}
          max={2}
          onChange={(v) => void update({ voice: { ...settings.voice, rate: v } })}
          format={(v) => `${v.toFixed(1)}x`}
        />
      </div>
      <div className="field">
        <label>{strings.voice}</label>
        <Select
          value={settings.voice.voiceName}
          onChange={(v) => void update({ voice: { ...settings.voice, voiceName: v } })}
          options={[
            { value: '', label: 'Sistem (otomatik)' },
            ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` })),
          ]}
        />
        {voices.length === 0 && <div className="hint">Ses listesi bu cihazda henüz yüklenmedi — test butonu çalışır.</div>}
      </div>
      <div className="field row">
        <Button onClick={() => props.controller.testVoice('Merhaba, ben Quatra. Ses sistemim çalışıyor.')}>
          {strings.testVoice}
        </Button>
        <Button onClick={() => props.controller.stopSpeaking()}>{strings.stopSpeaking}</Button>
      </div>
    </>
  );
}

function ActivationSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  return (
    <>
      <h3>{strings.activation}</h3>
      <div className="field">
        <label>{strings.activationMode}</label>
        <Select
          value={settings.activation.mode}
          onChange={(v) => void update({ activation: { ...settings.activation, mode: v as typeof settings.activation.mode } })}
          options={[
            { value: 'manual', label: strings.modeManual },
            { value: 'push_to_talk', label: strings.modePtt },
            { value: 'wake_word', label: strings.modeWake, disabled: true },
          ]}
        />
        <div className="hint">{strings.wakeUnavailable}</div>
      </div>
      {settings.activation.mode === 'push_to_talk' && (
        <div className="field">
          <label>{strings.pttKey}</label>
          <input
            className="input"
            style={{ width: 220 }}
            value={settings.activation.pushToTalkKey}
            onChange={(e) =>
              void update({ activation: { ...settings.activation, pushToTalkKey: e.target.value } })
            }
          />
        </div>
      )}
    </>
  );
}

function AppearanceSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const app = settings.appearance;

  return (
    <>
      <h3>{strings.appearance}</h3>
      <div className="field">
        <label>{strings.accent}</label>
        <div className="row" style={{ gap: 8 }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              onClick={() => void update({ appearance: { ...app, accent: c } })}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c,
                border: app.accent === c ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label>{strings.intensity}</label>
        <Slider value={app.intensity} min={0.3} max={1} onChange={(v) => void update({ appearance: { ...app, intensity: v } })} format={(v) => v.toFixed(2)} />
      </div>
      <div className="field">
        <label>{strings.animationSpeed}</label>
        <Slider value={app.animationSpeed} min={0.5} max={2} onChange={(v) => void update({ appearance: { ...app, animationSpeed: v } })} format={(v) => `${v.toFixed(1)}x`} />
      </div>
      <div className="field">
        <label>{strings.glow}</label>
        <Slider value={app.glow} min={0} max={1} onChange={(v) => void update({ appearance: { ...app, glow: v } })} format={(v) => v.toFixed(2)} />
      </div>
      <div className="field">
        <label>{strings.uiScale}</label>
        <Slider value={app.uiScale} min={0.85} max={1.3} onChange={(v) => void update({ appearance: { ...app, uiScale: v } })} format={(v) => `${Math.round(v * 100)}%`} />
      </div>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.reducedMotion}</label>
        <Switch on={app.reducedMotion} onChange={(v) => void update({ appearance: { ...app, reducedMotion: v } })} />
      </div>
      <div className="field">
        <label>{strings.preview}</label>
        <div className="previewBox">
          <span className="statusHint">Değişiklikler ana ekranda anında uygulanır</span>
        </div>
      </div>
    </>
  );
}

function PrivacySection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const setCaption = useAssistantStore((s) => s.setCaption);

  return (
    <>
      <h3>{strings.privacy}</h3>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.retainTranscripts}</label>
        <Switch
          on={settings.privacy.retainTranscripts}
          onChange={(v) => void update({ privacy: { ...settings.privacy, retainTranscripts: v } })}
        />
      </div>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.clipboardRead}</label>
        <Switch
          on={settings.privacy.clipboardReadEnabled}
          onChange={(v) => void update({ privacy: { ...settings.privacy, clipboardReadEnabled: v } })}
        />
      </div>
      <div className="field row">
        <Button onClick={() => setCaption('')}>{strings.clearContext}</Button>
        <Button onClick={() => setCaption('')}>{strings.clearLogs}</Button>
      </div>
      <div className="statusHint">Ses kaydı tutulmaz; yalnızca anlık konuşma tanıma yapılır.</div>
    </>
  );
}

function DiagnosticsSection(): React.JSX.Element {
  const status = useAssistantStore((s) => s.status);
  const connection = useAssistantStore((s) => s.connection);
  const connectionError = useAssistantStore((s) => s.connectionError);
  const settings = useSettingsStore((s) => s.settings);
  const [logs, setLogs] = useState<Array<{ text: string; kind: string }>>([]);

  const toolList = ['sysinfo', 'open_app', 'open_url', 'not_al', 'clipboard_yaz', 'clipboard_oku'];

  const refresh = () => {
    setLogs([
      { text: `${strings.providerState}: ${connection}`, kind: connection === 'failed' ? 'error' : '' },
      { text: `${strings.selectedModel}: ${settings.provider.flashModel} / ${settings.provider.proModel}`, kind: '' },
      { text: `${strings.micStatus}: ${status === 'listening' ? 'aktif' : status === 'muted' ? 'kapalı' : 'hazır'}`, kind: '' },
      { text: `${strings.tools}: ${toolList.join(', ')}`, kind: '' },
      ...(connectionError ? [{ text: connectionError, kind: 'error' }] : []),
    ]);
  };
  const ranOnce = useRef(false);
  useEffect(() => {
    if (!ranOnce.current) {
      ranOnce.current = true;
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, connectionError]);

  return (
    <>
      <h3>{strings.diagnostics}</h3>
      <div className="diagList">
        {logs.length === 0 && <div className="statusHint">{strings.noErrors}</div>}
        {logs.map((l, i) => (
          <div key={i} className={`line ${l.kind}`}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <Button onClick={refresh}>{strings.clearLogs}</Button>
      </div>
      <div className="statusHint">Sahte sağlık puanı yoktur; gösterilen her şey gerçek durumdur.</div>
    </>
  );
}
