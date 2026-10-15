/**
 * Groq Whisper — ses tanıma (STT). Electron'da Web Speech çalışmadığı için
 * gerçek çözüm: kısa kayıt → Groq /audio/transcriptions → metin.
 * Anahtar yalnızca main süreçte okunur; ses dosyası diske YAZILMAZ (yalnız bellek).
 */
import { ProviderError } from '../../providers/types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MODEL = 'whisper-large-v3-turbo';

export interface TranscribeOptions {
  apiKey: string;
  audio: Uint8Array;
  mimeType: string;
  language?: string; // 'tr'
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TranscribeResult {
  text: string;
  model: string;
}

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscribeResult> {
  if (!options.apiKey) {
    throw new ProviderError('auth', 'Ses tanıma için Groq anahtarı gerekli (Ayarlar → AI Sağlayıcı).');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    // Uint8Array → ArrayBuffer kopyası (tip uyumu + güvenli gönderim)
    const ab = new ArrayBuffer(options.audio.byteLength);
    new Uint8Array(ab).set(options.audio);

    const form = new FormData();
    form.append('model', MODEL);
    if (options.language) form.append('language', options.language);
    form.append('response_format', 'json');
    form.append('file', new Blob([ab], { type: options.mimeType || 'audio/webm' }), 'ses.webm');

    const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}` },
      body: form,
      signal,
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError('auth', 'Groq anahtarı geçersiz.', res.status);
      }
      if (res.status === 429) {
        throw new ProviderError('rate_limit', 'Ses tanıma hız limiti — biraz sonra dene.', res.status);
      }
      throw new ProviderError('server', 'Ses tanıma servisi hata verdi.', res.status);
    }

    const data = (await res.json()) as { text?: string };
    return { text: (data.text ?? '').trim(), model: MODEL };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      throw new ProviderError('timeout', 'Ses tanıma zaman aşımına uğradı.');
    }
    if (e instanceof TypeError) {
      throw new ProviderError('network', 'Ses tanıma için ağ bağlantısı kurulamadı.');
    }
    throw new ProviderError('unknown', 'Ses tanıma başarısız oldu.');
  } finally {
    clearTimeout(timer);
  }
}
