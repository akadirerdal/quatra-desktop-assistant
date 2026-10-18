/**
 * Ayarlar şeması — zod doğrulamalı, tek doğru kaynak.
 * API anahtarı BURADA DEĞİLDİR: credentials vault'ta tutulur (bkz. electron/credentials.ts).
 */
import { z } from 'zod';

const ProviderSchema = z.object({
  id: z.enum(['deepseek']).default('deepseek'),
  /** Sohbet modu modeli (hızlı). */
  flashModel: z.string().min(1).default('deepseek-chat'),
  /** Yazılım/proje modu modeli (derin). */
  proModel: z.string().min(1).default('deepseek-reasoner'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(8192).default(2048),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

const VoiceSchema = z.object({
  autoSpeak: z.boolean().default(true),
  rate: z.number().min(0.5).max(2).default(1),
  pitch: z.number().min(0.5).max(1.5).default(1),
  voiceName: z.string().default(''),
  /** Ses tanıma motoru: auto = önce web, yoksa groq whisper. */
  sttEngine: z.enum(['auto', 'groq', 'off']).default('auto'),
  /** Konuşma motoru: edge = doğal neural sesler (internet), system = çevrimdışı SAPI. */
  ttsEngine: z.enum(['edge', 'system']).default('edge'),
  /** Cevap bitince mikrofon kendiliğinden dinlemeye döner (insan gibi sohbet). */
  continuous: z.boolean().default(true),
  /** Quatra konuşurken sözünü kesince dinlemeye geçer (GPT voice tarzı). */
  bargeIn: z.boolean().default(true),
  // ---- Mikrofon filtreleri (gerçek getUserMedia kısıtları) ----
  micNoiseSuppression: z.boolean().default(true),
  micEchoCancellation: z.boolean().default(true),
  micAutoGain: z.boolean().default(true),
  /** Mikrofon hassasiyeti 1(en hassas)..10(az hassas). */
  vadSensitivity: z.number().int().min(1).max(10).default(5),
  /** Ek yazılım kazancı: off|low|mid|high (tarayıcı AGC'den ayrı, kayda uygulanır). */
  micGainLevel: z.enum(['off', 'low', 'mid', 'high']).default('off'),
  /** Yazılım gürültü kapısı: bu seviyenin altındaki anlar kayıtta kısılır. */
  micGateLevel: z.enum(['off', 'low', 'mid', 'high']).default('off'),
  /** Mikrofon cihazı ('' = sistem varsayılanı). */
  inputDeviceId: z.string().default(''),
  /** Sohbette bu süre sessiz kalırsan beklemeye (uyku) geçilir (sn). */
  sleepAfterSec: z.number().int().min(2).max(30).default(5),
});

const MemorySchema = z.object({
  /** Hafızanın prompt'a eklenip eklenmeyeceği (kayıtlar hep yerel kalır). */
  enabled: z.boolean().default(true),
  /** Konuşmalardan otomatik öğrenme — yalnızca kalıcı değer taşıyan bilgiler. */
  autoLearn: z.boolean().default(true),
  /** Motor: local (varsayılan, cihazda) | mem0 (bulut, ek anahtar gerekir). */
  engine: z.enum(['local', 'mem0']).default('local'),
});

const ActivationSchema = z.object({
  mode: z.enum(['manual', 'push_to_talk', 'wake_word']).default('push_to_talk'),
  /** CommandOrControl: Windows'ta Ctrl, macOS'te ⌘ — kısayol her platformda doğal kalır. */
  pushToTalkKey: z.string().min(1).default('CommandOrControl+Shift+Space'),
  /** Uyandırma kelimesi (gerçek VAD + Whisper ile aranır). */
  wakeWord: z.string().min(2).max(20).default('quatra'),
});

const AppearanceSchema = z.object({
  /** Tema paleti — id listesi src/renderer/themes.ts ile senkron tutulmalı. */
  theme: z
    .enum(['gece', 'okyanus', 'zumrut', 'gunbatimi', 'gul', 'grafit', 'safak'])
    .default('gece'),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#9B87F5'),
  intensity: z.number().min(0).max(1).default(0.7),
  animationSpeed: z.number().min(0.5).max(2).default(1),
  glow: z.number().min(0).max(1).default(0.35),
  uiScale: z.number().min(0.85).max(1.3).default(1),
  reducedMotion: z.boolean().default(false),
});

const PrivacySchema = z.object({
  retainTranscripts: z.boolean().default(false),
  clipboardReadEnabled: z.boolean().default(false),
});

const ToolsSchema = z.object({
  enabled: z.record(z.string(), z.boolean()).default({}),
});

export const SettingsSchema = z.object({
  assistantName: z.string().min(1).max(40).default('Quatra'),
  personality: z.string().max(2000).default(''),
  language: z.enum(['tr']).default('tr'),
  provider: ProviderSchema.default(ProviderSchema.parse({})),
  voice: VoiceSchema.default(VoiceSchema.parse({})),
  activation: ActivationSchema.default(ActivationSchema.parse({})),
  appearance: AppearanceSchema.default(AppearanceSchema.parse({})),
  privacy: PrivacySchema.default(PrivacySchema.parse({})),
  tools: ToolsSchema.default(ToolsSchema.parse({})),
  memory: MemorySchema.default(MemorySchema.parse({})),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});

/** Kurtarma raporu: geçerli alanlar korunur, geçersiz alanlar varsayılana/mevcuda çekilir. */
export interface SettingsRecovery {
  settings: Settings;
  /** Kurtarılamayan alanların kısa Türkçe açıklamaları; her şey geçerliyse boş. */
  issues: string[];
}

/** zod hatasını kısa Türkçe mesaja çevirir (V1.2-011). */
function issueToMessage(issue: z.ZodIssue, prefix: PropertyKey[] = []): string {
  const field = [...prefix, ...issue.path].map(String).join('.') || 'ayarlar';
  switch (issue.code) {
    case 'too_big':
      return `${field}: en fazla ${issue.maximum}`;
    case 'too_small':
      return `${field}: en az ${issue.minimum}`;
    case 'invalid_type':
      return `${field}: beklenen tür ${typeLabel(issue.expected)}`;
    case 'invalid_format':
      return `${field}: geçersiz biçim`;
    case 'invalid_value':
      return `${field}: geçersiz değer`;
    default:
      return `${field}: geçersiz değer`;
  }
}

function typeLabel(expected: string): string {
  switch (expected) {
    case 'string':
      return 'metin';
    case 'number':
      return 'sayı';
    case 'boolean':
      return 'evet/hayır';
    case 'object':
      return 'nesne';
    case 'array':
      return 'liste';
    default:
      return expected;
  }
}

/** ZodDefault/ZodOptional gibi sarmalları açıp içteki şemayı verir. */
function unwrapSchema(schema: z.ZodType): z.ZodType {
  let current = schema;
  for (let i = 0; i < 5; i++) {
    const maybe = current as unknown as { unwrap?: () => z.ZodType };
    if (typeof maybe.unwrap !== 'function') break;
    current = maybe.unwrap();
  }
  return current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface RecoveredValue {
  value: unknown;
  issues: string[];
}

/**
 * Alan bazlı kurtarma (V1.2-072): şemaya uymayan alan tek tek `fallback`e çekilir,
 * uyanlar korunur. Nesne/record şemaları alt alanlarına iner.
 */
function recoverValue(
  schema: z.ZodType,
  raw: unknown,
  fallback: unknown,
  path: PropertyKey[],
): RecoveredValue {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { value: parsed.data, issues: [] };

  const inner = unwrapSchema(schema);
  if (inner instanceof z.ZodObject && isPlainObject(raw)) {
    const fallbackObj = isPlainObject(fallback) ? fallback : {};
    const value: Record<string, unknown> = {};
    const issues: string[] = [];
    for (const key of Object.keys(inner.shape)) {
      const child = recoverValue(inner.shape[key], raw[key], fallbackObj[key], [...path, key]);
      value[key] = child.value;
      issues.push(...child.issues);
    }
    return { value, issues };
  }

  // Record'lar (ör. tools.enabled): geçerli girişler korunur, bozuklar bildirilir.
  if (inner instanceof z.ZodRecord && isPlainObject(raw)) {
    const value: Record<string, unknown> = {};
    const issues: string[] = [];
    for (const [key, entry] of Object.entries(raw)) {
      const child = recoverValue(inner.def.valueType as z.ZodType, entry, undefined, [
        ...path,
        key,
      ]);
      if (child.issues.length === 0) value[key] = child.value;
      else issues.push(...child.issues);
    }
    return { value, issues };
  }

  return { value: fallback, issues: parsed.error.issues.map((i) => issueToMessage(i, path)) };
}

/**
 * Bilinmeyen/bozuk veriyi alan bazlı kurtarıp Settings'e çevirir.
 * Geçerli alanlar korunur; yalnızca geçersiz alanlar `fallback`e (genelde mevcut ayarlar) çekilir.
 * null/undefined (dosya yok) sorunsuz kabul edilir; hiçbir girdi exception fırlatmaz.
 */
export function recoverSettings(input: unknown, fallback: Settings): SettingsRecovery {
  const recovered = recoverValue(SettingsSchema, input, fallback, []);
  return { settings: recovered.value as Settings, issues: recovered.issues };
}

/** Ayarları yüklerken kullanılan sürüm: kurtarma raporunu da döner (V1.2-072). */
export function sanitizeSettingsWithReport(input: unknown): SettingsRecovery {
  if (input === null || input === undefined) return { settings: DEFAULT_SETTINGS, issues: [] };
  return recoverSettings(input, DEFAULT_SETTINGS);
}

/** Geriye dönük uyumlu sade sürüm: yalnızca temizlenmiş ayarları döner. */
export function sanitizeSettings(input: unknown): Settings {
  return sanitizeSettingsWithReport(input).settings;
}

/** Ayarların geçerli olup olmadığını denetler (UI ön kontrolü). */
export function validateSettings(
  input: unknown,
): { ok: true; value: Settings } | { ok: false; issues: string[] } {
  const result = SettingsSchema.safeParse(input ?? {});
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: result.error.issues.map((i) => issueToMessage(i)) };
}
