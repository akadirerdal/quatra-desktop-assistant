/**
 * Mikrofon düğmesi — "Ekolayzır" (V1-16, konsept C).
 * Dinlerken çubuklar GERÇEK mikrofon seviyesiyle oynar; konuşurken gerçek çıkış
 * sinyalini kullanır (sinyal yoksa sakin sabit desen). Uydurma rastgele hareket YOK.
 * Tıklama: sustur / aç. Sürekli açık mikrofon davranışı V1-04'te genişleyecek.
 */
import { useAssistantStore } from '../../state/assistant-store';
import { useSettingsStore } from '../../state/settings-store';
import { strings } from '../../renderer/strings';
import { eqBarScales } from './mic-eq';

/** Dinleme dışı ve hareket-azaltma durumlarında sabit desenler (uydurma hareket yok). */
const RESTING = [0.15, 0.19, 0.17, 0.14];
const THINKING = [0.34, 0.55, 0.44, 0.3];
const ACTIVE_STATIC = [0.42, 0.62, 0.52, 0.36];
const OFF = [0.14, 0.14, 0.14, 0.14];

export function MicButton(props: { onToggle: () => void }): React.JSX.Element {
  const status = useAssistantStore((s) => s.status);
  const mutedByUser = useAssistantStore((s) => s.mutedByUser);
  const micLevel = useAssistantStore((s) => s.micLevel);
  const speakLevel = useAssistantStore((s) => s.speakLevel);
  const reducedMotion = useSettingsStore((s) => s.settings.appearance.reducedMotion);
  const systemReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = reducedMotion || systemReducedMotion;

  const isOff = status === 'muted' || status === 'error' || mutedByUser;

  let scales: number[];
  if (isOff) {
    scales = OFF;
  } else if (status === 'listening') {
    scales = reduced ? ACTIVE_STATIC : eqBarScales(micLevel);
  } else if (status === 'speaking') {
    scales = !reduced && speakLevel > 0.02 ? eqBarScales(speakLevel) : ACTIVE_STATIC;
  } else if (status === 'processing') {
    scales = THINKING;
  } else {
    scales = RESTING;
  }

  let stateClass = 'is-idle';
  if (status === 'error') stateClass = 'is-error';
  else if (isOff) stateClass = 'is-muted';
  else if (status === 'listening') stateClass = 'is-listening';
  else if (status === 'speaking') stateClass = 'is-speaking';
  else if (status === 'processing') stateClass = 'is-processing';

  const label = mutedByUser ? strings.micUnmute : strings.micMute;

  return (
    <button
      className={`micEq ${stateClass}`}
      onClick={props.onToggle}
      title={label}
      aria-label={label}
      aria-pressed={mutedByUser}
    >
      {scales.map((scale, i) => (
        <i key={i} style={{ transform: `scaleY(${scale.toFixed(3)})` }} />
      ))}
    </button>
  );
}
