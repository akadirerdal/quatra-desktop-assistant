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
  pushToTalkKey: z.string().min(1).default('Ctrl+Shift+Space'),
  /** Uyandırma kelimesi (gerçek VAD + Whisper ile aranır). */
  wakeWord: z.string().min(2).max(20).default('quatra'),
});

const AppearanceSchema = z.object({
  /** Tema paleti — id listesi src/renderer/themes.ts ile senkron tutulmalı. */
  theme: z.enum(['gece', 'okyanus', 'zumrut', 'gunbatimi', 'gul', 'grafit', 'safak']).default('gece'),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#9B87F5'),
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

/**
 * Bilinmeyen/bozuk veriyi güvenle settings'e çevirir.
 * Geçerliyse korur; yapısal olarak bozuksa DEFAULT_SETTINGS'e düşer (recovery).
 * Hiçbir girdi için exception fırlatmaz.
 */
export function sanitizeSettings(input: unknown): Settings {
  const result = SettingsSchema.safeParse(input ?? {});
  return result.success ? result.data : DEFAULT_SETTINGS;
}

/** Ayarların geçerli olup olmadığını denetler (UI ön kontrolü). */
export function validateSettings(
  input: unknown,
): { ok: true; value: Settings } | { ok: false; issues: string[] } {
  const result = SettingsSchema.safeParse(input ?? {});
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
