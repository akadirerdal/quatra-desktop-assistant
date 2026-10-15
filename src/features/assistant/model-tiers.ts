/**
 * Model seviyeleri (tiers) — kullanıcı dostu kalite kademeleri.
 * Her seviye GERÇEK bir model + gerçek parametre kombinasyonudur (uydurma yok).
 */
import type { Settings } from '../../state/settings-schema';

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
    model: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 1024,
    desc: 'En hızlı ve en tutumlu — kısa sorular',
  },
  {
    id: 'default',
    label: 'Varsayılan',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2048,
    desc: 'Günlük kullanım dengesi',
  },
  {
    id: 'high',
    label: 'Yüksek',
    model: 'deepseek-reasoner',
    temperature: 0.7,
    maxTokens: 4096,
    desc: 'Derin düşünme — kod ve analiz',
  },
  {
    id: 'max',
    label: 'Max',
    model: 'deepseek-reasoner',
    temperature: 1.0,
    maxTokens: 8192,
    desc: 'En yüksek kalite, uzun cevaplar',
  },
  {
    id: 'ultra',
    label: 'Ultra Max',
    model: 'deepseek-reasoner',
    temperature: 1.2,
    maxTokens: 8192,
    desc: 'Sınırları zorla — en yaratıcı',
  },
];

/** Aktif moda göre mevcut ayarın hangi seviyeye denk geldiğini bulur. */
export function currentTierId(settings: Settings, mode: 'flash' | 'pro'): string | null {
  const model = mode === 'pro' ? settings.provider.proModel : settings.provider.flashModel;
  const temp = settings.provider.temperature;
  const tokens = settings.provider.maxTokens;
  const match = MODEL_TIERS.find(
    (t) => t.model === model && Math.abs(t.temperature - temp) < 0.05 && t.maxTokens === tokens,
  );
  return match?.id ?? null;
}

/** Seviye seçimini ayarlara uygular (aktif modun modeli + ortak parametreler). */
export function applyTier(
  _settings: Settings,
  mode: 'flash' | 'pro',
  tierId: string,
): Partial<Settings['provider']> | null {
  const tier = MODEL_TIERS.find((t) => t.id === tierId);
  if (!tier) return null;
  return {
    ...(mode === 'pro' ? { proModel: tier.model } : { flashModel: tier.model }),
    temperature: tier.temperature,
    maxTokens: tier.maxTokens,
  };
}
