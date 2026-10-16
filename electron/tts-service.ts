/**
 * Edge Neural TTS — ücretsiz, doğal sesler (Microsoft Edge "Read Aloud" servisi).
 * API anahtarı gerektirmez; internet gerektirir. Başarısızsa renderer sistem TTS'ine düşer.
 */
import { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } from 'msedge-tts';
import { ProviderError } from '../src/providers/types';

export interface EdgeVoice {
  shortName: string;
  locale: string;
  gender: string;
}

export const DEFAULT_EDGE_VOICE = 'tr-TR-EmelNeural';

let client: MsEdgeTTS | null = null;
let currentVoice = '';

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
    throw new ProviderError('network', 'Edge ses listesi alınamadı — internet bağlantısını kontrol et.');
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

export async function synthesizeEdge(
  text: string,
  voice: string,
  rate: number,
  pitch: number,
): Promise<{ audio: Buffer; mime: string }> {
  const chosen = voice || DEFAULT_EDGE_VOICE;
  try {
    if (!client || currentVoice !== chosen) {
      try {
        client?.close();
      } catch {
        // yok say
      }
      client = new MsEdgeTTS();
      await client.setMetadata(chosen, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      currentVoice = chosen;
    }
    const prosody = new ProsodyOptions();
    const p = prosodyOf(rate, pitch);
    prosody.rate = p.rate;
    prosody.pitch = p.pitch;

    const { audioStream } = client.toStream(text.slice(0, 4000), prosody);
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 25_000);
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      audioStream.on('end', () => {
        clearTimeout(timer);
        resolve();
      });
      audioStream.on('close', () => {
        clearTimeout(timer);
        resolve();
      });
      audioStream.on('error', (e: Error) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    const audio = Buffer.concat(chunks);
    if (audio.length === 0) {
      throw new ProviderError('server', 'Edge boş ses döndürdü.');
    }
    return { audio, mime: 'audio/mpeg' };
  } catch (e) {
    try {
      client?.close();
    } catch {
      // yok say
    }
    client = null;
    currentVoice = '';
    if (e instanceof ProviderError) throw e;
    if (e instanceof Error && e.message === 'timeout') {
      throw new ProviderError('timeout', 'Edge ses sentezi zaman aşımına uğradı.');
    }
    throw new ProviderError('network', 'Edge ses sentezi başarısız (internet gerekli).');
  }
}

export function disposeTts(): void {
  try {
    client?.close();
  } catch {
    // yok say
  }
  client = null;
  currentVoice = '';
}
