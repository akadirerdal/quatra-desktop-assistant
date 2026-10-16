/**
 * Akış (streaming) metin cümle ayırıcı — TTS'e cümle cümle beslemek için.
 * Saf fonksiyon: her delta'da çağrılır, TAMAMLANMIŞ cümleleri döndürür; kalanı tamponda tutar.
 */

export interface SentenceSplit {
  sentences: string[];
  rest: string;
}

/**
 * Tampondaki tamamlanmış cümleleri ayıklar.
 * Cümle sonu: . ! ? … dizisi + boşluk veya metin sonu. "3.5" gibi ara sayılar bölünmez.
 * force=true → akış bitti: kalan yarım cümle de tek parça döner.
 */
export function takeSentences(buffer: string, force = false): SentenceSplit {
  const sentences: string[] = [];
  let rest = buffer;
  const re = /^([\s\S]*?[.!?…]+)(\s+|$)/;
  for (;;) {
    const m = re.exec(rest);
    if (!m) break;
    const sentence = m[1]!.trim();
    if (sentence) sentences.push(sentence);
    rest = rest.slice(m[0].length);
  }
  if (force && rest.trim()) {
    sentences.push(rest.trim());
    rest = '';
  }
  return { sentences, rest };
}
