/**
 * Model seviyeleri (tiers) — kullanıcı dostu kalite kademeleri.
 * Her seviye GERÇEK bir model + gerçek parametre kombinasyonudur (uydurma yok).
 */
import type { Settings } from '../../state/settings-schema';
import { DEFAULT_SETTINGS } from '../../state/settings-schema';
import { DEEPSEEK_CHAT_MODEL, DEEPSEEK_REASONER_MODEL } from '../agent/models';

export interface ModelTier {
  id: string;
  label: string;
  model: string;
  temperature: number;
  maxTokens: number;
  desc: string;
}

export const MODEL_TIERS: ModelTier[] = [
  {
    id: 'low',
    label: 'Düşük',
    model: DEEPSEEK_CHAT_MODEL,
    temperature: 0.3,
    maxTokens: 1024,
    desc: 'En hızlı ve en tutumlu — kısa sorular',
  },
  {
    id: 'default',
    label: 'Varsayılan',
    model: DEEPSEEK_CHAT_MODEL,
    temperature: 0.7,
    maxTokens: 2048,
    desc: 'Günlük kullanım dengesi',
  },
  {
    id: 'high',
    label: 'Yüksek',
    model: DEEPSEEK_REASONER_MODEL,
    temperature: 0.7,
    maxTokens: 4096,
    desc: 'Derin düşünme — kod ve analiz',
  },
  {
    id: 'max',
    label: 'Max',
    model: DEEPSEEK_REASONER_MODEL,
    temperature: 1.0,
    maxTokens: 8192,
    desc: 'En yüksek kalite, uzun cevaplar',
  },
  {
    id: 'ultra',
    label: 'Ultra Max',
    model: DEEPSEEK_REASONER_MODEL,
    temperature: 1.2,
    maxTokens: 8192,
    desc: 'Sınırları zorla — en yaratıcı',
  },
];

/**
 * V1.2-061: moda özel parametre alanları. Ayarlar şeması bu alanları eklediğinde
 * seviye seçimi yalnız aktif modun parametrelerini yazar; diğer mod bozulmaz.
 */
export interface PerModeProviderSettings {
  flashTemperature?: number;
  flashMaxTokens?: number;
  proTemperature?: number;
  proMaxTokens?: number;
}

/** applyTier dönüşü: mevcut şema alanları + (varsa) moda özel parametreler. */
export type TierPatch = Partial<Settings['provider']> & PerModeProviderSettings;

/** Şema moda özel alanları içeriyor mu? (İçermiyorsa eski ortak alan davranışı korunur.) */
const PROVIDER_SUPPORTS_PER_MODE =
  'flashTemperature' in (DEFAULT_SETTINGS.provider as Record<string, unknown>) ||
  'proTemperature' in (DEFAULT_SETTINGS.provider as Record<string, unknown>);

/** Aktif moda göre mevcut ayarın hangi seviyeye denk geldiğini bulur. */
export function currentTierId(settings: Settings, mode: 'flash' | 'pro'): string | null {
  const p = settings.provider as Settings['provider'] & PerModeProviderSettings;
  const model = mode === 'pro' ? p.proModel : p.flashModel;
  // V1.2-061: moda özel alan varsa onu, yoksa ortak alanı kullan.
  const temp = (mode === 'pro' ? p.proTemperature : p.flashTemperature) ?? p.temperature;
  const tokens = (mode === 'pro' ? p.proMaxTokens : p.flashMaxTokens) ?? p.maxTokens;
  const match = MODEL_TIERS.find(
    (t) => t.model === model && Math.abs(t.temperature - temp) < 0.05 && t.maxTokens === tokens,
  );
  return match?.id ?? null;
}

/**
 * Seviye seçimini ayarlara uygular (aktif modun modeli + moda özel parametreler).
 * V1.2-061: şema destekliyorsa yalnız o modun temperature/maxTokens alanları yazılır.
 */
export function applyTier(
  _settings: Settings,
  mode: 'flash' | 'pro',
  tierId: string,
): TierPatch | null {
  const tier = MODEL_TIERS.find((t) => t.id === tierId);
  if (!tier) return null;
  const modelPatch = mode === 'pro' ? { proModel: tier.model } : { flashModel: tier.model };
  if (PROVIDER_SUPPORTS_PER_MODE) {
    return mode === 'pro'
      ? { ...modelPatch, proTemperature: tier.temperature, proMaxTokens: tier.maxTokens }
      : { ...modelPatch, flashTemperature: tier.temperature, flashMaxTokens: tier.maxTokens };
  }
  // Şema henüz moda özel alan içermiyor: eski ortak alanlara yaz (davranış aynı kalır).
  return { ...modelPatch, temperature: tier.temperature, maxTokens: tier.maxTokens };
}
