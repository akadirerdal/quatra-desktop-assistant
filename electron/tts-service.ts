/**
 * Edge Neural TTS — ücretsiz, doğal sesler (Microsoft Edge "Read Aloud" servisi).
 * API anahtarı gerektirmez; internet gerektirir. Başarısızsa renderer sistem TTS'ine düşer.
 */
import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from 'msedge-tts';
import type { Readable } from 'node:stream';
import { ProviderError } from '../src/providers/types';

export interface EdgeVoice {
  shortName: string;
  locale: string;
  gender: string;
}

export const DEFAULT_EDGE_VOICE = 'tr-TR-EmelNeural';

// V1.2-031: istek başına istemci — paylaşılan client kapandığında süren sentez ölmez.
const CONNECTION_TIMEOUT_MS = 10_000;
const METADATA_TIMEOUT_MS = 10_000;
const STREAM_TIMEOUT_MS = 25_000;

const activeClients = new Set<MsEdgeTTS>();

export async function listEdgeVoices(): Promise<EdgeVoice[]> {
  const tts = new MsEdgeTTS();
  try {
    const voices = await tts.getVoices();
    return voices.map((v) => ({
      shortName: v.ShortName,
      locale: v.Locale,
      gender: String(v.Gender),
    }));
  } catch {
    throw new ProviderError(
      'network',
      'Edge ses listesi alınamadı — internet bağlantısını kontrol et.',
    );
  } finally {
    try {
      tts.close();
    } catch {
      // yok say
    }
  }
}

/** Çarpan (0.5–2.0) → Edge prosody formatı. */
export function prosodyOf(rate: number, pitch: number): { rate: string; pitch: string } {
  const ratePct = Math.round((rate - 1) * 100);
  const pitchHz = Math.round((pitch - 1) * 50);
  return {
    rate: `${ratePct >= 0 ? '+' : ''}${ratePct}%`,
    pitch: `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`,
  };
}

/** Kendi zaman aşımımız — hata mesajı "timeout" olan gerçek bir hataya dönüşsün. */
class EdgeTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new EdgeTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Ses akışını toplar; akış sağlayıcıda asılı kalırsa net zaman aşımına düşer. */
function readAudioStream(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => reject(new EdgeTimeoutError()), STREAM_TIMEOUT_MS);
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    stream.on('close', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    stream.on('error', (e: Error) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export async function synthesizeEdge(
  text: string,
  voice: string,
  rate: number,
  pitch: number,
): Promise<{ audio: Buffer; mime: string }> {
  const chosen = voice || DEFAULT_EDGE_VOICE;
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
    synthesisTimeoutMs: STREAM_TIMEOUT_MS,
  });
  activeClients.add(tts);
  try {
    await withTimeout(
      tts.setMetadata(chosen, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3),
      METADATA_TIMEOUT_MS,
    );
    const prosody = new ProsodyOptions();
    const p = prosodyOf(rate, pitch);
    prosody.rate = p.rate;
    prosody.pitch = p.pitch;

    const { audioStream } = tts.toStream(text.slice(0, 4000), prosody);
    const audio = await readAudioStream(audioStream);
    if (audio.length === 0) {
      throw new ProviderError('server', 'Edge boş ses döndürdü.');
    }
    return { audio, mime: 'audio/mpeg' };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof EdgeTimeoutError) {
      throw new ProviderError('timeout', 'Edge ses sentezi zaman aşımına uğradı.');
    }
    throw new ProviderError('network', 'Edge ses sentezi başarısız (internet gerekli).');
  } finally {
    activeClients.delete(tts);
    try {
      tts.close();
    } catch {
      // yok say
    }
  }
}

/** Süren tüm sentezleri kapat (uygulama kapanışı). */
export function disposeTts(): void {
  for (const tts of [...activeClients]) {
    try {
      tts.close();
    } catch {
      // yok say
    }
  }
  activeClients.clear();
}
