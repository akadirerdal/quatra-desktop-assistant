/**
 * Ayarlar paneli — 9 kategori, her kontrol gerçekten çalışır veya "kullanılamaz" işaretlidir.
 * Ölü buton YASAK.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Select, Slider, StatusPill, Switch } from '../../components/ui';
import { useSettingsStore } from '../../state/settings-store';
import { useAssistantStore } from '../../state/assistant-store';
import { strings } from '../../renderer/strings';
import { THEMES, getTheme } from '../../renderer/themes';
import { AssistantController, TOOL_LABELS } from '../assistant/assistant-controller';

type Category =
  | 'general'
  | 'provider'
  | 'voice'
  | 'activation'
  | 'appearance'
  | 'memory'
  | 'privacy'
  | 'records'
  | 'diagnostics';

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'general', label: strings.general },
  { id: 'provider', label: strings.aiProvider },
  { id: 'voice', label: strings.voiceAudio },
  { id: 'activation', label: strings.activation },
  { id: 'appearance', label: strings.appearance },
  { id: 'memory', label: strings.memory },
  { id: 'privacy', label: strings.privacy },
  { id: 'records', label: strings.records },
  { id: 'diagnostics', label: strings.diagnostics },
];

// V1.2-155: vurgu seçenekleri ekran okuyucuya ham hex yerine anlamlı ad verir.
const ACCENTS: Array<{ value: string; label: string }> = [
  { value: '#9B87F5', label: 'Mor' },
  { value: '#7C9BF0', label: 'Mavi' },
  { value: '#5FB8A6', label: 'Turkuaz' },
  { value: '#E8A05F', label: 'Amber' },
  { value: '#E86F8C', label: 'Pembe' },
  { value: '#C9C9D4', label: 'Gri' },
];

// V1.2-143: kategori panel her açılışta "Genel"e dönmesin; modül düzeyinde korunur.
let lastCategory: Category = 'general';

// V1.2-094: Önizleme kutusundaki statik ekolayzır çubuklarının göreli yükseklikleri.
const EQ_BARS = [0.35, 0.62, 0.9, 0.5, 0.78, 0.44, 0.3];

/**
 * V1.2-020: ui.tsx'teki Select/Slider `id`/`aria-label` prop'u almadığı için etiket, kontrolü
 * kapsar (örtük etiketleme). Görünüm eski ".field label + kontrol" düzeniyle birebir aynıdır:
 * başlık boşluğu içteki span'a taşınır (ui.tsx'e dokunulmadan gerçek erişilebilir ad).
 */
function Labeled(props: { text: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ marginBottom: 0 }}>
      <span style={{ display: 'block', marginBottom: 5 }}>{props.text}</span>
      {props.children}
    </label>
  );
}

export function SettingsPanel(props: {
  onClose: () => void;
  controller: AssistantController;
}): React.JSX.Element {
  const [category, setCategoryState] = useState<Category>(lastCategory);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const saveError = useSettingsStore((s) => s.saveError);
  const loadError = useSettingsStore((s) => s.loadError);

  const setCategory = (c: Category): void => {
    lastCategory = c;
    setCategoryState(c);
  };

  // V1.2-019: açılışta odak panele gelir, kapanışta açan öğeye geri verilir.
  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      restoreFocusRef.current?.focus();
    };
  }, []);

  // V1.2-019: Tab pane içinde döner; Esc kapatır. Onay penceresi açıkken Esc ona aittir.
  const onPanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      // Onay penceresi açıkken Esc panele değil ona aittir (Dialog kapanışını bekler).
      if (panelRef.current?.querySelector('.dialogBackdrop, [role="dialog"]')) return;
      e.preventDefault();
      props.onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    // Panel kabuğu (tabIndex -1) da odak olabilir; o durumda yön sınırda sayılır.
    const inside = active instanceof HTMLElement && active !== panel && panel.contains(active);
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="settingsOverlay" onClick={props.onClose}>
      <div
        className="settingsPanel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={strings.settings}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
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
          {/* V1.2-011: store'un save/load hatası sessizce kaybolmasın (alan-altı hata store'da henüz yok). */}
          {(loadError || saveError) && (
            <div className="statusHint warnText" role="alert">
              {loadError ? `Ayarlar yüklenemedi: ${loadError}` : `Ayar kaydedilemedi: ${saveError}`}
            </div>
          )}
          {category === 'general' && <GeneralSection />}
          {category === 'provider' && <ProviderSection />}
          {category === 'voice' && <VoiceSection controller={props.controller} />}
          {category === 'activation' && <ActivationSection />}
          {category === 'appearance' && <AppearanceSection />}
          {category === 'memory' && <MemorySection />}
          {category === 'privacy' && <PrivacySection />}
          {category === 'records' && <RecordsSection />}
          {category === 'diagnostics' && <DiagnosticsSection />}{' '}
        </div>
      </div>
    </div>
  );
}

function GeneralSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const restoreDefaults = useSettingsStore((s) => s.restoreDefaults);
  const setCaption = useAssistantStore((s) => s.setCaption);
  const [confirming, setConfirming] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [version, setVersion] = useState('0.1.0');
  const [loginItem, setLoginItem] = useState<{ supported: boolean; enabled: boolean } | null>(null);

  useEffect(() => {
    void window.quatra?.app.version().then((v) => setVersion(v));
  }, []);

  useEffect(() => {
    void window.quatra?.app
      .getLaunchAtLogin()
      .then((r) => setLoginItem({ supported: r.supported, enabled: r.enabled }));
  }, []);

  const runImport = (): void => {
    setConfirmingImport(false);
    void window.quatra?.settings.importFile().then((r) => {
      if (r.ok && !r.canceled) {
        void useSettingsStore
          .getState()
          .load()
          .then(() => setCaption(strings.settingsImported));
      } else if (!r.ok) {
        setCaption(r.message ?? strings.settingsImportFailed);
      }
    });
  };

  return (
    <>
      <h3>{strings.general}</h3>
      <div className="field">
        <label htmlFor="set-assistant-name">{strings.assistantName}</label>
        <input
          id="set-assistant-name"
          className="input"
          value={settings.assistantName}
          maxLength={40}
          onChange={(e) => void update({ assistantName: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="set-personality">{strings.personality}</label>
        <textarea
          id="set-personality"
          className="input"
          value={settings.personality}
          maxLength={2000}
          onChange={(e) => void update({ personality: e.target.value })}
        />
        <div className="hint">{strings.personalityHint}</div>
      </div>
      <div className="field">
        <Labeled text={strings.language}>
          <Select
            value={settings.language}
            onChange={(v) => void update({ language: v as 'tr' })}
            options={[{ value: 'tr', label: 'Türkçe' }]}
          />
        </Labeled>
        <div className="hint">{strings.languageTrOnly}</div>
      </div>
      <div className="field">
        <label>{strings.version}</label>
        <div className="statusHint">Lidra {version}</div>
      </div>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.launchAtLogin}</label>
        <Switch
          on={loginItem?.enabled ?? false}
          // V1.2-132: durum yüklenene kadar belirsiz → etkin bırakılırsa yanlış değer yazılabilir.
          disabled={loginItem === null || !loginItem.supported}
          title={strings.launchAtLogin}
          onChange={(v) => {
            void window.quatra?.app.setLaunchAtLogin(v).then((r) => {
              if (r.ok && r.supported && typeof r.enabled === 'boolean') {
                setLoginItem({ supported: true, enabled: r.enabled });
              }
            });
          }}
        />
      </div>
      <div className="hint">
        {loginItem === null
          ? 'Açılış durumu okunuyor…'
          : loginItem.supported
            ? strings.launchAtLoginHint
            : strings.launchAtLoginDev}
      </div>
      <div className="field row">
        <Button
          onClick={() => {
            void window.quatra?.settings.exportFile().then((r) => {
              if (r.ok && !r.canceled) setCaption(strings.settingsExported);
            });
          }}
        >
          {strings.settingsExport}
        </Button>
        <Button onClick={() => setConfirmingImport(true)}>{strings.settingsImport}</Button>
      </div>
      <div className="hint">{strings.settingsIoHint}</div>
      <div className="field">
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {strings.restoreDefaults}
        </Button>
      </div>
      {confirmingImport && (
        <Dialog
          title={strings.settingsImport}
          body="Mevcut ayarlar dosyadan gelenlerle değiştirilecek. Emin misin?"
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          onConfirm={runImport}
          onCancel={() => setConfirmingImport(false)}
        />
      )}
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

function KeyBlock(props: {
  id: 'deepseek' | 'groq' | 'mem0';
  label: string;
  hint: string;
  /** V1.2-016: anahtar kaydı/silinmesi üst bölüme bildirilir (düğmeler mount'ta donmasın). */
  onChanged?: (hasKey: boolean) => void;
}): React.JSX.Element {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [savedJustNow, setSavedJustNow] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    void window.quatra?.credentials.has(props.id).then(setHasKey);
  }, [props.id]);

  const saveKey = async (): Promise<void> => {
    setKeyMsg(null);
    setSavedJustNow(false);
    try {
      const res = await window.quatra?.credentials.set(props.id, keyInput);
      if (!res) {
        setKeyMsg('Kaydetme köprüsüne ulaşılamadı.');
        return;
      }
      if (res.ok) {
        setHasKey(true);
        setSavedJustNow(true);
        setKeyInput('');
        props.onChanged?.(true);
      } else {
        setKeyMsg(res.error ?? strings.connectFailed);
      }
    } catch (e) {
      setKeyMsg(e instanceof Error ? e.message : 'Anahtar kaydedilemedi.');
    }
  };

  const clearKey = async (): Promise<void> => {
    setConfirmingClear(false);
    setKeyMsg(null);
    // V1.2-127: silme sonucu denetlenmeden "anahtar yok" denemez.
    const res = await window.quatra?.credentials.clear(props.id);
    if (!res) {
      setKeyMsg('Kasa köprüsüne ulaşılamadı; anahtar silinmedi.');
      return;
    }
    if (!res.ok) {
      setKeyMsg('Anahtar silinemedi.');
      return;
    }
    setHasKey(false);
    setSavedJustNow(false);
    setKeyMsg(strings.apiKeyMissing);
    props.onChanged?.(false);
  };

  return (
    <div className="field">
      <label htmlFor={`key-${props.id}`}>{props.label}</label>
      <div className="row">
        <input
          id={`key-${props.id}`}
          className="input"
          type={showKey ? 'text' : 'password'}
          placeholder={
            hasKey && !keyInput ? strings.apiKeyPlaceholderSaved : strings.apiKeyPlaceholder
          }
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn small"
          // V1.2-157: göster/gizle bir açma-kapama durumudur.
          aria-pressed={showKey}
          onClick={() => setShowKey(!showKey)}
        >
          {showKey ? strings.hide : strings.show}
        </button>
        <Button variant="primary" onClick={() => void saveKey()} disabled={!keyInput.trim()}>
          {strings.saveKey}
        </Button>
        {hasKey && (
          <Button
            variant="danger"
            onClick={() => setConfirmingClear(true)}
            title="Kayıtlı anahtarı kasasından sil"
          >
            {strings.clearKey}
          </Button>
        )}
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        {savedJustNow && <StatusPill kind="ok" text={strings.apiKeySavedNow} />}
        {!savedJustNow && hasKey && <StatusPill kind="ok" text={strings.apiKeySet} />}
        {!savedJustNow && !hasKey && <StatusPill kind="warn" text={strings.apiKeyMissing} />}
      </div>
      <div className="hint">{props.hint}</div>
      {savedJustNow && <div className="hint">{strings.apiKeyClearedNote}</div>}
      {keyMsg && <div className="statusHint">{keyMsg}</div>}
      {/* V1.2-130: yıkıcı eylem onayı — metin strings.ts kapsamı dışında (B3'te taşınacak). */}
      {confirmingClear && (
        <Dialog
          title="Anahtarı kaldır"
          body={`${props.label} şifre kasasından silinecek. Emin misin?`}
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          danger
          onConfirm={() => void clearKey()}
          onCancel={() => setConfirmingClear(false)}
        />
      )}
    </div>
  );
}

function ProviderSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'bad'>('idle');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{ id: string }>>([]);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsMsg, setModelsMsg] = useState<string | null>(null);
  const [hasDeepseek, setHasDeepseek] = useState(false);
  const flash = settings.provider.flashModel;
  const pro = settings.provider.proModel;

  useEffect(() => {
    void window.quatra?.credentials.has('deepseek').then(setHasDeepseek);
  }, []);

  // V1.2-016: anahtar kaldırılınca model listesi/durumu bayat kalmasın.
  useEffect(() => {
    if (!hasDeepseek) {
      setModels([]);
      setModelsLoaded(false);
      setModelsMsg(null);
    }
  }, [hasDeepseek]);

  const runTest = async (): Promise<void> => {
    setTesting(true);
    setTestResult('idle');
    setTestMsg(null);
    const res = await window.quatra?.provider.test(flash.trim());
    setTesting(false);
    if (res?.ok) {
      setTestResult('ok');
      setTestMsg(`${strings.connected} (${res.latencyMs}ms)`);
    } else {
      setTestResult('bad');
      setTestMsg(res?.message ?? strings.connectFailed);
    }
  };

  // V1.2-128: "yüklendi" yalnız başarıda işaretlenir; hatada mesaj kalır ve yeniden denenebilir.
  const loadModels = async (): Promise<void> => {
    setModelsLoading(true);
    setModelsMsg(null);
    const res = await window.quatra?.provider.models();
    setModelsLoading(false);
    if (res?.ok && res.models && res.models.length > 0) {
      setModels(res.models);
      setModelsLoaded(true);
      return;
    }
    setModelsLoaded(false);
    setModelsMsg(
      res?.ok ? 'Sağlayıcı boş model listesi döndü.' : (res?.message ?? 'Modeller alınamadı.'),
    );
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
        {/* V1.2-129: onChange'si olmayan ölü Select yerine gerçek durum metni. */}
        <div className="statusHint">DeepSeek (tek sağlayıcı — değiştirilemez)</div>
      </div>
      <KeyBlock
        id="deepseek"
        label={strings.apiKey}
        hint={strings.apiKeyHint}
        onChanged={setHasDeepseek}
      />
      <div className="field">
        <Labeled text={strings.flashModel}>
          <Select
            value={flash}
            onChange={(v) => void updateProvider({ flashModel: v })}
            options={modelOptions(flash)}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.proModel}>
          <Select
            value={pro}
            onChange={(v) => void updateProvider({ proModel: v })}
            options={modelOptions(pro)}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.temperature}>
          <Slider
            value={settings.provider.temperature}
            min={0}
            max={2}
            onChange={(v) => void updateProvider({ temperature: v })}
            format={(v) => v.toFixed(2)}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.maxTokens}>
          <Slider
            value={settings.provider.maxTokens}
            min={256}
            max={8192}
            step={256}
            onChange={(v) => void updateProvider({ maxTokens: v })}
            format={(v) => String(v)}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.timeout}>
          <Slider
            value={settings.provider.timeoutMs / 1000}
            min={10}
            max={120}
            step={5}
            onChange={(v) => void updateProvider({ timeoutMs: Math.round(v * 1000) })}
            format={(v) => `${Math.round(v)}s`}
          />
        </Labeled>
      </div>
      <div className="field row">
        <Button variant="primary" onClick={() => void runTest()} disabled={testing || !hasDeepseek}>
          {testing ? strings.testing : strings.testConnection}
        </Button>
        <Button
          onClick={() => void loadModels()}
          disabled={!hasDeepseek || modelsLoading || (modelsLoaded && !modelsMsg)}
        >
          {modelsLoading
            ? 'Getiriliyor…'
            : modelsLoaded
              ? `${models.length} model`
              : 'Modelleri getir'}
        </Button>
        {modelsMsg && <StatusPill kind="bad" text={modelsMsg} />}
        {testResult === 'ok' && <StatusPill kind="ok" text={testMsg ?? strings.connected} />}
        {testResult === 'bad' && <StatusPill kind="bad" text={testMsg ?? strings.connectFailed} />}
        {!hasDeepseek && <StatusPill kind="warn" text={strings.noKeyFirst} />}
      </div>

      <h3 style={{ marginTop: 26 }}>Ses Tanıma</h3>
      <KeyBlock id="groq" label={strings.groqKey} hint={strings.groqKeyHint} />
    </>
  );
}

function VoiceSection(props: { controller: AssistantController }): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [sysVoices, setSysVoices] = useState<Array<{ name: string; lang: string }>>([]);
  const [edgeVoices, setEdgeVoices] = useState<
    Array<{ shortName: string; locale: string; gender: string }>
  >([]);
  const [edgeErr, setEdgeErr] = useState<string | null>(null);
  const [devices, setDevices] = useState<Array<{ id: string; label: string }>>([]);
  const engine = settings.voice.ttsEngine;

  // V1.2-077: effect bağımlılığı olduğundan kimlik props.controller'a bağlı sabitlenir.
  const loadSysVoices = useCallback(
    (): void => setSysVoices(props.controller.audioService.availableVoices()),
    [props.controller],
  );
  const loadDevices = async (): Promise<void> => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        list
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ id: d.deviceId, label: d.label || `Mikrofon ${i + 1}` })),
      );
    } catch {
      setDevices([]);
    }
  };
  const loadEdgeVoices = async (): Promise<void> => {
    setEdgeErr(null);
    const res = await window.quatra?.tts.voices();
    if (res?.ok && res.voices) {
      const tr = res.voices.filter((v) => v.locale.startsWith('tr'));
      const others = res.voices.filter((v) => !v.locale.startsWith('tr'));
      setEdgeVoices([...tr, ...others]);
    } else {
      setEdgeErr(res?.message ?? 'Edge ses listesi alınamadı');
    }
  };

  useEffect(() => {
    loadSysVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', loadSysVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', loadSysVoices);
    }
  }, [loadSysVoices]);

  useEffect(() => {
    void loadDevices();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    md.addEventListener('devicechange', loadDevices);
    return () => md.removeEventListener('devicechange', loadDevices);
  }, []);

  useEffect(() => {
    if (engine === 'edge' && edgeVoices.length === 0) void loadEdgeVoices();
  }, [engine, edgeVoices.length]);

  const voiceOptions =
    engine === 'edge'
      ? [
          { value: '', label: strings.ttsVoiceAuto },
          ...edgeVoices.map((v) => ({
            value: v.shortName,
            label: `${v.shortName.replace('Neural', '')} · ${v.gender === 'Female' ? 'Kadın' : 'Erkek'} (${v.locale})`,
          })),
        ]
      : [
          { value: '', label: 'Sistem (otomatik)' },
          ...sysVoices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` })),
        ];

  const levelOptions = [
    { value: 'off', label: strings.levelOff },
    { value: 'low', label: strings.levelLow },
    { value: 'mid', label: strings.levelMid },
    { value: 'high', label: strings.levelHigh },
  ];
  const deviceOptions = [
    { value: '', label: strings.micDeviceDefault },
    ...devices
      .filter((d) => d.id !== '' && d.id !== 'default' && d.id !== 'communications')
      .map((d) => ({ value: d.id, label: d.label })),
  ];

  return (
    <>
      <h3>{strings.voiceAudio}</h3>
      <div className="field">
        <Labeled text={strings.sttEngine}>
          <Select
            value={settings.voice.sttEngine}
            onChange={(v) =>
              void update({
                voice: { ...settings.voice, sttEngine: v as typeof settings.voice.sttEngine },
              })
            }
            options={[
              { value: 'auto', label: strings.sttAuto },
              { value: 'groq', label: strings.sttGroq },
              { value: 'off', label: strings.sttOff },
            ]}
          />
        </Labeled>
        <div className="hint">{strings.groqKeyHint}</div>
      </div>

      <div className="field row between">
        <div>
          <label style={{ margin: 0 }}>{strings.continuousLabel}</label>
          <div className="hint">{strings.continuousHint}</div>
        </div>
        <Switch
          title={strings.continuousLabel}
          on={settings.voice.continuous}
          onChange={(v) => void update({ voice: { ...settings.voice, continuous: v } })}
        />
      </div>

      <div className="field row between">
        <div>
          <label style={{ margin: 0 }}>{strings.bargeInLabel}</label>
          <div className="hint">{strings.bargeInHint}</div>
        </div>
        <Switch
          title={strings.bargeInLabel}
          on={settings.voice.bargeIn}
          onChange={(v) => void update({ voice: { ...settings.voice, bargeIn: v } })}
        />
      </div>

      <div className="field">
        <label>{strings.micDevice}</label>
        <div className="row">
          <Select
            value={settings.voice.inputDeviceId}
            onChange={(v) => void update({ voice: { ...settings.voice, inputDeviceId: v } })}
            options={deviceOptions}
          />
          <Button size="small" onClick={() => void loadDevices()}>
            {strings.refresh}
          </Button>
        </div>
        <div className="hint">{strings.micDeviceHint}</div>
      </div>

      <div className="field">
        <label>{strings.micFilters}</label>
        <div className="hint" style={{ marginBottom: 8 }}>
          {strings.micFiltersHint}
        </div>
        <div className="row between" style={{ padding: '4px 0' }}>
          <label style={{ margin: 0 }}>{strings.micNoise}</label>
          <Switch
            title={strings.micNoise}
            on={settings.voice.micNoiseSuppression}
            onChange={(v) => void update({ voice: { ...settings.voice, micNoiseSuppression: v } })}
          />
        </div>
        <div className="row between" style={{ padding: '4px 0' }}>
          <label style={{ margin: 0 }}>{strings.micEcho}</label>
          <Switch
            title={strings.micEcho}
            on={settings.voice.micEchoCancellation}
            onChange={(v) => void update({ voice: { ...settings.voice, micEchoCancellation: v } })}
          />
        </div>
        <div className="row between" style={{ padding: '4px 0' }}>
          <label style={{ margin: 0 }}>{strings.micGain}</label>
          <Switch
            title={strings.micGain}
            on={settings.voice.micAutoGain}
            onChange={(v) => void update({ voice: { ...settings.voice, micAutoGain: v } })}
          />
        </div>
      </div>

      <div className="field">
        <Labeled text={strings.vadSensitivity}>
          <Slider
            value={settings.voice.vadSensitivity}
            min={1}
            max={10}
            step={1}
            onChange={(v) => void update({ voice: { ...settings.voice, vadSensitivity: v } })}
            format={(v) => `${v}/10`}
          />
        </Labeled>
        <div className="hint">{strings.vadSensitiveHint}</div>
      </div>

      <div className="field">
        <label>{strings.micSoftwareLabel}</label>
        <div className="hint" style={{ marginBottom: 8 }}>
          {strings.micSoftwareHint}
        </div>
        <div className="row between" style={{ padding: '4px 0' }}>
          <label style={{ margin: 0 }}>{strings.micGainLevel}</label>
          <Select
            value={settings.voice.micGainLevel}
            onChange={(v) =>
              void update({
                voice: { ...settings.voice, micGainLevel: v as typeof settings.voice.micGainLevel },
              })
            }
            options={levelOptions}
          />
        </div>
        <div className="row between" style={{ padding: '4px 0' }}>
          <label style={{ margin: 0 }}>{strings.micGateLevel}</label>
          <Select
            value={settings.voice.micGateLevel}
            onChange={(v) =>
              void update({
                voice: { ...settings.voice, micGateLevel: v as typeof settings.voice.micGateLevel },
              })
            }
            options={levelOptions}
          />
        </div>
      </div>

      <div className="field">
        <Labeled text={strings.sleepAfter}>
          <Slider
            value={settings.voice.sleepAfterSec}
            min={2}
            max={30}
            step={1}
            onChange={(v) => void update({ voice: { ...settings.voice, sleepAfterSec: v } })}
            format={(v) => `${v} sn`}
          />
        </Labeled>
        <div className="hint">{strings.sleepAfterHint}</div>
      </div>

      <MicTestPanel controller={props.controller} />

      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.autoSpeak}</label>
        <Switch
          title={strings.autoSpeak}
          on={settings.voice.autoSpeak}
          onChange={(v) => void update({ voice: { ...settings.voice, autoSpeak: v } })}
        />
      </div>

      <div className="field">
        <Labeled text={strings.ttsEngineLabel}>
          <Select
            value={engine}
            onChange={(v) =>
              void update({
                voice: {
                  ...settings.voice,
                  ttsEngine: v as typeof settings.voice.ttsEngine,
                  voiceName: '',
                },
              })
            }
            options={[
              { value: 'edge', label: strings.ttsEdge },
              { value: 'system', label: strings.ttsSystem },
            ]}
          />
        </Labeled>
      </div>

      <div className="field">
        <label>
          {strings.voice}
          {engine === 'edge' ? ` (${edgeVoices.length})` : ` (${sysVoices.length})`}
        </label>
        <div className="row">
          <Select
            value={settings.voice.voiceName}
            onChange={(v) => void update({ voice: { ...settings.voice, voiceName: v } })}
            options={voiceOptions}
          />
          <Button
            size="small"
            onClick={() => (engine === 'edge' ? void loadEdgeVoices() : loadSysVoices())}
          >
            {strings.refresh}
          </Button>
        </div>
        <div className="hint">{engine === 'edge' ? strings.edgeVoiceHint : strings.voicesHint}</div>
        {edgeErr && <div className="statusHint warnText">{edgeErr}</div>}
      </div>

      <div className="field">
        <Labeled text={strings.speechRate}>
          <Slider
            value={settings.voice.rate}
            min={0.5}
            max={2}
            onChange={(v) => void update({ voice: { ...settings.voice, rate: v } })}
            format={(v) => `${v.toFixed(1)}x`}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text="Ses perdesi">
          <Slider
            value={settings.voice.pitch}
            min={0.5}
            max={1.5}
            onChange={(v) => void update({ voice: { ...settings.voice, pitch: v } })}
            format={(v) => v.toFixed(2)}
          />
        </Labeled>
      </div>
      <div className="field row">
        <Button
          onClick={() => props.controller.testVoice('Merhaba, ben Lidra. Ses sistemim çalışıyor.')}
        >
          {strings.testVoice}
        </Button>
        <Button onClick={() => props.controller.stopSpeaking()}>{strings.stopSpeaking}</Button>
      </div>
    </>
  );
}

function MicTestPanel(props: { controller: AssistantController }): React.JSX.Element {
  const micLevel = useAssistantStore((s) => s.micLevel);
  const [state, setState] = useState<'off' | 'live' | 'recording' | 'ready' | 'error'>('off');
  const [message, setMessage] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const urlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const setClip = (url: string | null): void => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setClipUrl(url);
  };

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      audioRef.current?.pause();
      props.controller.endMicTest();
    },
    [props.controller],
  );

  const start = async (): Promise<void> => {
    setMessage('');
    const res = await props.controller.startMicTest();
    if (!res.ok) {
      setState('error');
      setMessage(res.message ?? strings.micTestFailed);
      return;
    }
    setDeviceLabel(res.deviceLabel ?? '');
    setState('live');
  };

  const record = async (): Promise<void> => {
    setState('recording');
    setMessage('');
    const outcome = await props.controller.recordMicTest(3000);
    if (outcome.kind === 'ok') {
      setClip(URL.createObjectURL(outcome.result.audio));
      setMessage(`${strings.micTestReady} (${(outcome.result.durationMs / 1000).toFixed(1)} sn)`);
      setState('ready');
    } else if (outcome.kind === 'busy') {
      setState('live');
      setMessage(strings.micTestBusy);
    } else if (outcome.kind === 'silence') {
      setState('live');
      setMessage(strings.micTestSilence);
    } else {
      setState('error');
      setMessage(outcome.message);
    }
  };

  const play = (): void => {
    if (!clipUrl) return;
    audioRef.current?.pause();
    const a = new Audio(clipUrl);
    audioRef.current = a;
    setPlaying(true);
    a.onended = () => {
      setPlaying(false);
      audioRef.current = null;
    };
    a.onerror = () => {
      setPlaying(false);
      setMessage(strings.micTestPlayFailed);
    };
    void a.play().catch(() => setMessage(strings.micTestPlayFailed));
  };

  const stop = (): void => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
    setState('off');
    setDeviceLabel('');
    setMessage('');
    props.controller.endMicTest();
  };

  return (
    <div className="field">
      <label>{strings.micTestTitle}</label>
      <div className="hint" style={{ marginBottom: 8 }}>
        {strings.micTestHint}
      </div>
      {state === 'off' ? (
        <div className="row">
          <Button onClick={() => void start()}>{strings.micTestStart}</Button>
        </div>
      ) : (
        <div className="micTestBox">
          <div className="micTestMeter" aria-hidden="true">
            <div
              className="micTestMeterFill"
              style={{ width: `${Math.min(100, Math.round(micLevel * 130))}%` }}
            />
          </div>
          <div className="hint">
            {deviceLabel ? `${strings.micTestActive}: ${deviceLabel}` : strings.micTestNoDevice}
          </div>
          <div className="row">
            <Button size="small" onClick={() => void record()} disabled={state === 'recording'}>
              {state === 'recording' ? strings.micTestRecording : strings.micTestRecord}
            </Button>
            <Button size="small" onClick={play} disabled={!clipUrl || playing}>
              {strings.micTestPlay}
            </Button>
            <Button size="small" onClick={stop}>
              {strings.micTestStop}
            </Button>
          </div>
          {message && <div className="statusHint">{message}</div>}
        </div>
      )}
    </div>
  );
}

function ActivationSection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  return (
    <>
      <h3>{strings.activation}</h3>
      <div className="field">
        <Labeled text={strings.activationMode}>
          <Select
            value={settings.activation.mode}
            onChange={(v) =>
              void update({
                activation: { ...settings.activation, mode: v as typeof settings.activation.mode },
              })
            }
            options={[
              { value: 'manual', label: strings.modeManual },
              { value: 'push_to_talk', label: strings.modePtt },
              { value: 'wake_word', label: 'Uyandırma kelimesi («Lidra»)' },
            ]}
          />
        </Labeled>
      </div>
      {settings.activation.mode === 'push_to_talk' && (
        <div className="field">
          <label htmlFor="set-ptt-key">{strings.pttKey}</label>
          <input
            id="set-ptt-key"
            className="input"
            style={{ width: 240 }}
            value={settings.activation.pushToTalkKey}
            onChange={(e) =>
              void update({ activation: { ...settings.activation, pushToTalkKey: e.target.value } })
            }
          />
          <div className="hint">{strings.pttGlobalNote}</div>
        </div>
      )}
      {settings.activation.mode === 'wake_word' && (
        <div className="field">
          <label htmlFor="set-wake-word">{strings.wakeWord}</label>
          <input
            id="set-wake-word"
            className="input"
            style={{ width: 240 }}
            value={settings.activation.wakeWord}
            onChange={(e) =>
              void update({ activation: { ...settings.activation, wakeWord: e.target.value } })
            }
          />
          <div className="hint">{strings.wakeWordHint}</div>
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
        <label>{strings.theme}</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => void update({ appearance: { ...app, theme: t.id, accent: t.accent } })}
              title={`${t.label} — ${t.desc}`}
              aria-label={t.label}
              // V1.2-155: seçili tema ekran okuyucuya bildirilir.
              aria-pressed={app.theme === t.id}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                cursor: 'pointer',
                background: t.vars.bg,
                border: app.theme === t.id ? `2px solid ${t.accent}` : '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: t.accent,
                  display: 'inline-block',
                }}
              />
            </button>
          ))}
        </div>
        <div className="hint">
          {getTheme(app.theme).label}: {strings.themeHint}
        </div>
      </div>
      <div className="field">
        <label>{strings.accent}</label>
        <div className="row" style={{ gap: 8 }}>
          {ACCENTS.map((c) => (
            <button
              key={c.value}
              onClick={() => void update({ appearance: { ...app, accent: c.value } })}
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: c.value,
                // V1.2-155: seçili çerçeve temadan bağımsız görünür (sabit #fff yerine).
                border: app.accent === c.value ? '2px solid var(--text)' : '2px solid transparent',
                cursor: 'pointer',
              }}
              aria-label={`Vurgu: ${c.label}`}
              aria-pressed={app.accent === c.value}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <Labeled text={strings.intensity}>
          <Slider
            value={app.intensity}
            // V1.2-151: şema 0..1 — slider da aynı aralıkta (içe aktarılan değer kırpılmasın).
            min={0}
            max={1}
            onChange={(v) => void update({ appearance: { ...app, intensity: v } })}
            format={(v) => v.toFixed(2)}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.animationSpeed}>
          <Slider
            value={app.animationSpeed}
            min={0.5}
            max={2}
            onChange={(v) => void update({ appearance: { ...app, animationSpeed: v } })}
            format={(v) => `${v.toFixed(1)}x`}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.glow}>
          <Slider
            value={app.glow}
            min={0}
            max={1}
            onChange={(v) => void update({ appearance: { ...app, glow: v } })}
            format={(v) => v.toFixed(2)}
          />
        </Labeled>
      </div>
      <div className="field">
        <Labeled text={strings.uiScale}>
          <Slider
            value={app.uiScale}
            min={0.85}
            max={1.3}
            onChange={(v) => void update({ appearance: { ...app, uiScale: v } })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </Labeled>
      </div>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.reducedMotion}</label>
        <Switch
          title={strings.reducedMotion}
          on={app.reducedMotion}
          onChange={(v) => void update({ appearance: { ...app, reducedMotion: v } })}
        />
      </div>
      <div className="field">
        <label>{strings.preview}</label>
        {/* V1.2-094: boş kutu yerine gerçek, ayarlara duyarlı mini ekolayzır önizlemesi. */}
        <div className="previewBox">
          <div
            className="row"
            aria-hidden="true"
            style={{
              alignItems: 'flex-end',
              gap: 6,
              height: 64,
              boxShadow: `0 0 ${Math.round(app.glow * 28)}px color-mix(in srgb, var(--accent) 60%, transparent)`,
              borderRadius: 10,
              padding: '0 10px',
            }}
          >
            {EQ_BARS.map((h, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: 6,
                  // V1.2-151: yoğunluk 0 iken de görünür kalsın diye taban yüksekliği var.
                  height: Math.round(8 + h * app.intensity * 52),
                  borderRadius: 3,
                  background: 'var(--accent)',
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        </div>
        <div className="hint">
          Önizleme: çubuk yüksekliği görsel yoğunluğa, ışıltı ise ışıltı ayarına göre değişir; ana
          ekranda canlı hareket eder.
        </div>
      </div>
    </>
  );
}

function MemorySection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [entries, setEntries] = useState<
    Array<{ id: string; text: string; createdAt: string; source: string }>
  >([]);
  const [newText, setNewText] = useState('');
  const [confirming, setConfirming] = useState(false);

  const reload = async (): Promise<void> => {
    const list = await window.quatra?.memory.list();
    setEntries(list ?? []);
  };

  useEffect(() => {
    void reload();
  }, []);

  const addEntry = async (): Promise<void> => {
    if (!newText.trim()) return;
    const res = await window.quatra?.memory.add(newText.trim(), 'user');
    if (res?.ok) {
      setNewText('');
      void reload();
    }
  };

  const removeEntry = async (id: string): Promise<void> => {
    await window.quatra?.memory.remove(id);
    void reload();
  };

  const clearAll = async (): Promise<void> => {
    await window.quatra?.memory.clear();
    setConfirming(false);
    void reload();
  };

  return (
    <>
      <h3>{strings.memory}</h3>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.memoryEnabled}</label>
        <Switch
          title={strings.memoryEnabled}
          on={settings.memory.enabled}
          onChange={(v) => void update({ memory: { ...settings.memory, enabled: v } })}
        />
      </div>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.memoryAutoLearn}</label>
        <Switch
          title={strings.memoryAutoLearn}
          on={settings.memory.autoLearn}
          onChange={(v) => void update({ memory: { ...settings.memory, autoLearn: v } })}
        />
      </div>
      <div className="hint">{strings.memoryAutoLearnHint}</div>
      <div className="field">
        <Labeled text={strings.memoryEngine}>
          <Select
            value={settings.memory.engine}
            onChange={(v) =>
              void update({
                memory: { ...settings.memory, engine: v as typeof settings.memory.engine },
              })
            }
            options={[
              { value: 'local', label: strings.memoryEngineLocal },
              { value: 'mem0', label: strings.memoryEngineMem0 },
            ]}
          />
        </Labeled>
      </div>
      {settings.memory.engine === 'mem0' && (
        <KeyBlock id="mem0" label={strings.mem0Key} hint={strings.mem0KeyHint} />
      )}
      <div className="field">
        <div className="row">
          <input
            className="input"
            placeholder={strings.memoryAddPlaceholder}
            aria-label={strings.memoryAddPlaceholder}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addEntry();
            }}
          />
          <Button variant="primary" onClick={() => void addEntry()} disabled={!newText.trim()}>
            {strings.memoryAdd}
          </Button>
        </div>
        <div className="hint">{strings.memoryHint}</div>
      </div>
      <div className="diagList">
        {entries.length === 0 && <div className="statusHint">{strings.memoryEmpty}</div>}
        {entries.map((e) => (
          <div
            key={e.id}
            className="row between"
            style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ fontSize: 12.5 }}>{e.text}</span>
            {/* V1.2-156: '✕' tek başına anlam taşımıyor — ekran okuyucuya ad verilir. */}
            <Button
              size="small"
              variant="danger"
              onClick={() => void removeEntry(e.id)}
              ariaLabel="Kaydı sil"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      {entries.length > 0 && (
        <div className="field" style={{ marginTop: 12 }}>
          <Button variant="danger" onClick={() => setConfirming(true)}>
            {strings.memoryClear}
          </Button>
        </div>
      )}
      {confirming && (
        <Dialog
          title={strings.memoryClear}
          body={strings.memoryClearConfirm}
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          danger
          onConfirm={() => void clearAll()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}

// V1.2-130: yıkıcı temizlemelerin onay metinleri — strings.ts B3 kapsamı → geçici hardcoded.
const PRIVACY_CONFIRM = {
  context: { title: strings.clearContext, body: 'Aktif konuşma bağlamı sıfırlanacak. Emin misin?' },
  logs: {
    title: strings.clearLogs,
    body: 'Günlük dosyasındaki tüm kayıtlar silinecek. Emin misin?',
  },
  transcripts: {
    title: strings.clearTranscripts,
    body: 'Saklanan konuşma metinleri silinecek. Emin misin?',
  },
} as const;

function PrivacySection(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const setCaption = useAssistantStore((s) => s.setCaption);
  const [confirming, setConfirming] = useState<'context' | 'logs' | 'transcripts' | null>(null);

  const runClear = (which: 'context' | 'logs' | 'transcripts'): void => {
    setConfirming(null);
    if (which === 'context') {
      void window.quatra?.agent.clearContext().then(() => setCaption(strings.contextCleared));
    } else if (which === 'logs') {
      void window.quatra?.log.clear().then(() => setCaption(strings.logsCleared));
    } else {
      void window.quatra?.privacy
        .clearTranscripts()
        .then(() => setCaption(strings.transcriptsCleared));
    }
  };

  return (
    <>
      <h3>{strings.privacy}</h3>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.retainTranscripts}</label>
        <Switch
          on={settings.privacy.retainTranscripts}
          title={strings.retainTranscripts}
          onChange={(v) => void update({ privacy: { ...settings.privacy, retainTranscripts: v } })}
        />
      </div>
      <div className="hint">{strings.transcriptsHint}</div>
      <div className="field row between">
        <label style={{ margin: 0 }}>{strings.clipboardRead}</label>
        <Switch
          on={settings.privacy.clipboardReadEnabled}
          title={strings.clipboardRead}
          onChange={(v) =>
            void update({ privacy: { ...settings.privacy, clipboardReadEnabled: v } })
          }
        />
      </div>
      <div className="field row">
        <Button onClick={() => setConfirming('context')}>{strings.clearContext}</Button>
        <Button onClick={() => setConfirming('logs')}>{strings.clearLogs}</Button>
        <Button onClick={() => setConfirming('transcripts')}>{strings.clearTranscripts}</Button>
      </div>
      <div className="statusHint">Ses kaydı tutulmaz; yalnızca anlık konuşma tanıma yapılır.</div>
      {confirming && (
        <Dialog
          title={PRIVACY_CONFIRM[confirming].title}
          body={PRIVACY_CONFIRM[confirming].body}
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          danger
          onConfirm={() => runClear(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}

/** İşlem kaydı (V1-17/18/19) — audit listesi, token sayaçları, not yedeği geri alma. */
function RecordsSection(): React.JSX.Element {
  const setCaption = useAssistantStore((s) => s.setCaption);
  const [audit, setAudit] = useState<
    Array<{ ts: string; tool: string; ok: boolean; detail: string; ms: number }>
  >([]);
  const [usage, setUsage] = useState<{
    monthUsage: { prompt: number; completion: number; requests: number };
    total: { prompt: number; completion: number; requests: number };
  } | null>(null);
  const [backup, setBackup] = useState<{ target: string; ts: string } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const refresh = useCallback(() => {
    void window.quatra?.audit.list().then((r) => setAudit(r.entries));
    void window.quatra?.usage
      .get()
      .then((r) => setUsage({ monthUsage: r.monthUsage, total: r.total }));
    void window.quatra?.notes.lastBackup().then((r) => setBackup(r.record));
  }, []);
  // V1.2-018: ranOnce guard'ı listeyi mount anındaki görüntüde donduruyordu; refresh deps'e bağlı.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const fmt = (n: number) => n.toLocaleString('tr-TR');
  const fmtTs = (ts: string) => {
    // V1.2-140: toLocaleString exception atmaz ("Invalid Date" döner) → geçerlilik önce denenir.
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <h3>{strings.records}</h3>
      <h4>{strings.auditTitle}</h4>
      <div className="diagList">
        {audit.length === 0 && <div className="statusHint">{strings.auditEmpty}</div>}
        {audit.map((e, i) => (
          <div key={i} className={`line ${e.ok ? '' : 'error'}`}>
            {fmtTs(e.ts)} · {e.tool} · {e.ok ? `ok (${e.ms} ms)` : `HATA: ${e.detail}`}
          </div>
        ))}
      </div>
      <div className="field row">
        <Button size="small" onClick={refresh}>
          {strings.auditRefresh}
        </Button>
        <Button size="small" onClick={() => setConfirmingClear(true)}>
          {strings.auditClear}
        </Button>
      </div>
      {/* V1.2-130: işlem kaydı temizleme de onay ister (diğer yıkıcı eylemlerle tutarlı). */}
      {confirmingClear && (
        <Dialog
          title={strings.auditClear}
          body="İşlem kaydındaki tüm satırlar silinecek. Emin misin?"
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          danger
          onConfirm={() => {
            setConfirmingClear(false);
            void window.quatra?.audit.clear().then(() => {
              setAudit([]);
              setCaption(strings.auditCleared);
            });
          }}
          onCancel={() => setConfirmingClear(false)}
        />
      )}

      <h4>{strings.usageTitle}</h4>
      {usage ? (
        <div className="statusHint">
          {strings.usageMonth}: {fmt(usage.monthUsage.prompt)} giriş /{' '}
          {fmt(usage.monthUsage.completion)} çıkış ({fmt(usage.monthUsage.requests)}{' '}
          {strings.usageRequests}) · {strings.usageTotal}: {fmt(usage.total.prompt)} /{' '}
          {fmt(usage.total.completion)}
        </div>
      ) : (
        <div className="statusHint">{strings.usageEmpty}</div>
      )}

      <h4>{strings.noteBackupTitle}</h4>
      <div className="statusHint">
        {backup
          ? `${strings.noteBackupLast}: ${backup.target} (${fmtTs(backup.ts)})`
          : strings.noteBackupNone}
      </div>
      {backup && (
        <div className="field row">
          <Button
            size="small"
            onClick={() => {
              void window.quatra?.notes.restore().then((r) => {
                setCaption(
                  r.ok ? strings.noteRestored : `${strings.noteRestoreFailed} ${r.message}`,
                );
              });
            }}
          >
            {strings.noteRestore}
          </Button>
        </div>
      )}
    </>
  );
}

// V1.2-077: refresh'in useCallback bağımlılığı olmasın diye modül düzeyinde sabit.
const DIAG_TOOL_LIST = Object.keys(TOOL_LABELS);

function DiagnosticsSection(): React.JSX.Element {
  const status = useAssistantStore((s) => s.status);
  const connection = useAssistantStore((s) => s.connection);
  const connectionError = useAssistantStore((s) => s.connectionError);
  const setCaption = useAssistantStore((s) => s.setCaption);
  const settings = useSettingsStore((s) => s.settings);
  const [logs, setLogs] = useState<Array<{ text: string; kind: string }>>([]);
  const [logFile, setLogFile] = useState<string | null>(null);
  const [logTail, setLogTail] = useState<string[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);

  // V1.2-139: yol platforma göre köprüden gelir; bilinmiyorsa yanlış yol yazılmaz.
  useEffect(() => {
    void window.quatra?.log.path().then((r) => {
      if (r?.ok && r.path) setLogFile(r.path);
    });
  }, []);

  // V1.2-077: effect bağımlılığı olduğundan useCallback.
  const refresh = useCallback(() => {
    const connectionLabel =
      connection === 'connected'
        ? 'bağlı'
        : connection === 'failed'
          ? 'bağlantı hatası'
          : connection === 'testing'
            ? 'test ediliyor'
            : connection === 'offline'
              ? 'çevrimdışı'
              : 'bilinmiyor';
    setLogs([
      {
        text: `${strings.providerState}: ${connectionLabel}`,
        kind: connection === 'failed' ? 'error' : '',
      },
      {
        text: `${strings.selectedModel}: ${settings.provider.flashModel} / ${settings.provider.proModel}`,
        kind: '',
      },
      {
        text: `${strings.micStatus}: ${status === 'listening' ? 'aktif' : status === 'muted' ? 'kapalı' : 'hazır'}`,
        kind: '',
      },
      { text: `${strings.tools}: ${DIAG_TOOL_LIST.join(', ')}`, kind: '' },
      ...(connectionError ? [{ text: connectionError, kind: 'error' }] : []),
    ]);
    // Gerçek günlük dosyasının son satırlarını çek (V1.2-095).
    void window.quatra?.log.read(40).then((r) => {
      if (r?.ok && Array.isArray(r.lines)) setLogTail(r.lines);
    });
  }, [connection, settings, status, connectionError]);
  // V1.2-018: ranOnce guard'ı liste güncellemelerini engelliyordu; refresh deps'iyle senkron.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // V1.2-017: bu düğme listeyi yenilemiyordu, günlük dosyasını temizler (V1.2-130: onaylı).
  const clearLogs = (): void => {
    setConfirmingClear(false);
    void window.quatra?.log.clear().then(() => {
      setCaption(strings.logsCleared);
      refresh();
    });
  };

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
      {logTail.length > 0 && (
        <div className="diagList" style={{ marginTop: 10, maxHeight: 180, overflow: 'auto' }}>
          {logTail.map((l, i) => (
            <div key={i} className="line" style={{ fontSize: 10.5, opacity: 0.85 }}>
              {l}
            </div>
          ))}
        </div>
      )}
      <div className="field" style={{ marginTop: 14 }}>
        <div className="row">
          <Button onClick={() => setConfirmingClear(true)}>{strings.clearLogs}</Button>
          <Button
            variant="primary"
            onClick={() => void window.quatra?.log.openLogs()}
            title="Günlük dosyalarının klasörünü açar"
          >
            Günlük dosyasını aç
          </Button>
        </div>
        <div className="hint">
          {logFile
            ? `Hata günlükleri kalıcı olarak tutulur: ${logFile} (1MB'da rotasyon).`
            : "Hata günlükleri kalıcı olarak tutulur ve 1MB'da rotasyona uğrar; dosya konumu için 'Günlük dosyasını aç' düğmesini kullan."}
        </div>
      </div>
      <div className="statusHint">
        Sahte sağlık puanı yoktur; gösterilen her şey gerçek durumdur.
      </div>
      {confirmingClear && (
        <Dialog
          title={strings.clearLogs}
          body="Günlük dosyasındaki tüm kayıtlar silinecek. Emin misin?"
          confirmLabel={strings.yes}
          cancelLabel={strings.no}
          danger
          onConfirm={clearLogs}
          onCancel={() => setConfirmingClear(false)}
        />
      )}
    </>
  );
}
