/**
 * Alt çubuk — iki pill (OpenCode tarzı):
 * 1) Model pill: tıkla → seviyeler (Düşük/Varsayılan/Yüksek/Max/Ultra Max) + gerçek model listesi.
 * 2) Mod pill: tıkla → Hızlı (flash) / Düşünceli (pro) seç.
 * Popup'lar yukarı açılır; dışına tıkla veya Esc ile kapanır.
 */
import { useEffect, useRef, useState } from 'react';
import { useAssistantStore } from '../../state/assistant-store';
import { useSettingsStore } from '../../state/settings-store';
import { applyTier, currentTierId, MODEL_TIERS } from './model-tiers';
import { strings } from '../../renderer/strings';

type Popup = 'none' | 'model' | 'mode';

export function BottomBar(): React.JSX.Element {
  const mode = useAssistantStore((s) => s.mode);
  const setMode = useAssistantStore((s) => s.setMode);
  const setCaption = useAssistantStore((s) => s.setCaption);
  const settings = useSettingsStore((s) => s.settings);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const [popup, setPopup] = useState<Popup>('none');
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const currentModel = mode === 'pro' ? settings.provider.proModel : settings.provider.flashModel;
  const tierId = currentTierId(settings, mode);
  const tier = MODEL_TIERS.find((t) => t.id === tierId) ?? null;

  // Dışına tıklama + Esc ile kapan.
  useEffect(() => {
    if (popup === 'none') return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPopup('none');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup('none');
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [popup]);

  const openModelPopup = async (): Promise<void> => {
    if (popup === 'model') {
      setPopup('none');
      return;
    }
    setPopup('model');
    setModelsError(null);
    const known = Array.from(new Set([settings.provider.flashModel, settings.provider.proModel]));
    let fetched: string[] = [];
    try {
      setModelsLoading(true);
      const has = await window.quatra?.credentials.has('deepseek');
      if (has) {
        const res = await window.quatra?.provider.models();
        if (res?.ok && res.models) fetched = res.models.map((m) => m.id);
        else if (res && !res.ok) setModelsError(res.message ?? 'Model listesi alınamadı');
      } else {
        setModelsError(strings.noKeyFirst);
      }
    } catch {
      setModelsError('Model listesi alınamadı');
    } finally {
      setModelsLoading(false);
    }
    setModels(Array.from(new Set([...known, ...fetched])));
  };

  const selectTier = async (id: string): Promise<void> => {
    const patch = applyTier(settings, mode, id);
    if (!patch) return;
    await updateProvider(patch);
    const t = MODEL_TIERS.find((x) => x.id === id);
    setCaption(`${t?.label ?? id} · ${t?.model ?? ''}`);
    setPopup('none');
  };

  const selectModel = async (id: string): Promise<void> => {
    if (mode === 'pro') {
      await updateProvider({ proModel: id });
    } else {
      await updateProvider({ flashModel: id });
    }
    setCaption(`Model: ${id} (${mode === 'pro' ? strings.modePro : strings.modeFlash})`);
    setPopup('none');
  };

  const selectMode = (m: 'flash' | 'pro'): void => {
    setMode(m);
    const model = m === 'pro' ? settings.provider.proModel : settings.provider.flashModel;
    setCaption(`${m === 'pro' ? strings.modePro : strings.modeFlash}: ${model}`);
    setPopup('none');
  };

  return (
    <div className="bottomBar" ref={wrapRef}>
      {/* ---------------- model pill ---------------- */}
      <div className="pillWrap">
        {popup === 'model' && (
          <div className="popup" role="menu" aria-label={strings.modelSelect}>
            <div className="popupTitle">DeepSeek · {strings.modelSelect}</div>
            {modelsLoading && <div className="popupHint">{strings.testing}</div>}
            {modelsError && <div className="popupHint warn">{modelsError}</div>}
            {MODEL_TIERS.map((t) => (
              <button
                key={t.id}
                className={`popupItem ${tierId === t.id ? 'active' : ''}`}
                role="menuitemradio"
                aria-checked={tierId === t.id}
                onClick={() => void selectTier(t.id)}
              >
                <span className="check">{tierId === t.id ? '✓' : ''}</span>
                {t.label}
                <span className="popupSub">
                  {t.model} · {t.desc}
                </span>
              </button>
            ))}
            <div className="popupTitle" style={{ marginTop: 4 }}>
              {strings.rawModels}
            </div>
            {models.map((m) => (
              <button
                key={m}
                className={`popupItem ${m === currentModel && !tierId ? 'active' : ''}`}
                role="menuitemradio"
                aria-checked={m === currentModel && !tierId}
                onClick={() => void selectModel(m)}
              >
                <span className="check">{m === currentModel && !tierId ? '✓' : ''}</span>
                {m}
              </button>
            ))}
            <div className="popupHint">{strings.modelFromSettings}</div>
          </div>
        )}
        <button className="pill" onClick={() => void openModelPopup()} title={strings.modelSelect}>
          <span className="pillDim">DeepSeek</span>
          <span>{tier ? tier.label : currentModel}</span>
        </button>
      </div>

      {/* ---------------- mod pill ---------------- */}
      <div className="pillWrap">
        {popup === 'mode' && (
          <div className="popup" role="menu" aria-label={strings.modeSelect}>
            <div className="popupTitle">{strings.modeSelect}</div>
            <button
              className={`popupItem ${mode === 'flash' ? 'active' : ''}`}
              role="menuitemradio"
              aria-checked={mode === 'flash'}
              onClick={() => selectMode('flash')}
            >
              <span className="check">{mode === 'flash' ? '✓' : ''}</span>
              {strings.modeFlash}
              <span className="popupSub">{settings.provider.flashModel} · günlük sorular, hızlı yanıt</span>
            </button>
            <button
              className={`popupItem ${mode === 'pro' ? 'active' : ''}`}
              role="menuitemradio"
              aria-checked={mode === 'pro'}
              onClick={() => selectMode('pro')}
            >
              <span className="check">{mode === 'pro' ? '✓' : ''}</span>
              {strings.modePro}
              <span className="popupSub">{settings.provider.proModel} · kod, derin analiz</span>
            </button>
            <div className="popupHint">Sesli komut: “yazılım moduna geç” / “normal moda geç”</div>
          </div>
        )}
        <button className="pill" onClick={() => setPopup(popup === 'mode' ? 'none' : 'mode')} title={strings.modeSelect}>
          <span>{mode === 'pro' ? strings.modePro : strings.modeFlash}</span>
        </button>
      </div>
    </div>
  );
}
