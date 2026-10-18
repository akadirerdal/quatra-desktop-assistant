/**
 * Groq Whisper — ses tanıma (STT). Electron'da Web Speech çalışmadığı için
 * gerçek çözüm: kısa kayıt → Groq /audio/transcriptions → metin.
 * Anahtar yalnızca main süreçte okunur; ses dosyası diske YAZILMAZ (yalnız bellek).
 */
import { ProviderError } from '../../providers/types';

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const MODEL = 'whisper-large-v3-turbo';

/**
 * Whisper, sessizlik/gürültü ya da anlaşılmaz kısa sesler verildiğinde "altyazı künyesi"
 * uydurur (bilinen klasik: "Altyazı M.K."; kapanış kalıpları: "İzlediğiniz için teşekkür
 * ederim."). Bu kalıplar gerçek kullanıcı konuşması olamayacak kadar spesifik — eşleşirse
 * metin boşaltılır ve "duyulmadı" sayılır (caption/agent'a asla ulaşmaz).
 */
const HALLUCINATION_PATTERNS: readonly RegExp[] = [
  /^alt\s*yaz[ıi](lar)?(?:[.\s]+m\.?\s*k\.?)?$/,
  /^m\.?\s*k\.?$/,
  /m\.?\s*k\.?\s+tarafından/,
  /^çeviri[.\s]+m\.?\s*k\.?$/,
  /^(bizi )?izlediğiniz için teşekkür( ederim|ler)?\.?$/,
  /^(kanala )?abone olmay[ıi] unutmay[ıi]n/,
  /amara\.org/,
  /mooji\.org/,
  /^subtitles? by/,
  /^transcri(bed|ption) by/,
  /^thanks? for watching/,
];

/** Karşılaştırma için sadeleştir: Türkçe küçük harf, birleşik işaretleri at, noktalama→boşluk (nokta kalır). */
function normalizeForMatch(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bilinen Whisper hayalet kalıbıysa boş string döner; değilse metin (kırpılmış hâli korunarak) aynen kalır. */
export function stripHallucination(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const flat = normalizeForMatch(trimmed);
  return HALLUCINATION_PATTERNS.some((re) => re.test(flat)) ? '' : trimmed;
}

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
  /** Hayalet kalıp filtrelendiyse ham model çıktısı (yalnız log/teşhis için). */
  filtered?: string;
}

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscribeResult> {
  if (!options.apiKey) {
    throw new ProviderError(
      'auth',
      'Ses tanıma için Groq anahtarı gerekli (Ayarlar → AI Sağlayıcı).',
    );
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
        throw new ProviderError(
          'rate_limit',
          'Ses tanıma hız limiti — biraz sonra dene.',
          res.status,
        );
      }
      throw new ProviderError('server', 'Ses tanıma servisi hata verdi.', res.status);
    }

    const data = (await res.json()) as { text?: string };
    const raw = (data.text ?? '').trim();
    const text = stripHallucination(raw);
    const result: TranscribeResult = { text, model: MODEL };
    if (raw && !text) result.filtered = raw; // hayalet kalıp — teşhis için ham çıktı taşınır
    return result;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      // Dış iptal ile iç zaman aşımı ayrılır — iptal 'timeout' diye raporlanmaz.
      if (options.signal?.aborted) {
        throw new ProviderError('cancelled', 'Ses tanıma iptal edildi.');
      }
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
