/**
 * Şifre kasası doğrulama scripti — Electron ile koşar (node ile DEĞİL).
 * Kullanım: npx electron scripts/check-credentials.cjs
 *
 * Gerçek akışla (electron/credentials.ts) birebir aynı biçim ve yazım yolu denenir:
 *   - depo biçimi: { version: 2, keys: { <slot>: base64(safeStorage.encryptString(...)) } }
 *     (credentials.ts:16-19,58,84)
 *   - yazım: atomikWriteJson — geçici dosyaya yaz + rename (credentials.ts:108-113)
 *   - slotlar: deepseek | groq | mem0 (credentials.ts:14)
 * Eski v1 ({ keyEnc }) biçimi BİLEREK yazılmaz; o yalnızca okuma sırasında taşınır.
 */
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** credentials.ts atomicWriteJson ile aynı: yarım dosya riski yok. */
async function atomicWriteJson(file, data) {
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.promises.rename(tmp, file);
}

async function readJson(file) {
  return JSON.parse(await fs.promises.readFile(file, 'utf8'));
}

app.whenReady().then(async () => {
  const results = {};

  results.encryptionAvailable = safeStorage.isEncryptionAvailable();

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quatra-cred-'));
  const file = path.join(testDir, 'credentials.json');

  if (results.encryptionAvailable) {
    try {
      // setApiKey(deepseek) akışı: şifrele → { version: 2, keys } → atomik yaz.
      const deepseekEnc = safeStorage.encryptString('test-key-12345').toString('base64');
      await atomicWriteJson(file, { version: 2, keys: { deepseek: deepseekEnc } });

      const afterFirst = await readJson(file);
      results.formatV2 = afterFirst.version === 2 && typeof afterFirst.keys.deepseek === 'string';
      results.tmpCleaned = !fs.existsSync(`${file}.tmp`);

      // setApiKey(groq) akışı: mevcut keys okunur, üzerine eklenir.
      const groqEnc = safeStorage.encryptString('test-groq-key').toString('base64');
      await atomicWriteJson(file, { version: 2, keys: { ...afterFirst.keys, groq: groqEnc } });

      // getApiKey akışı: base64 → decryptString; diğer slot korunmalı.
      const stored = await readJson(file);
      results.slotsPreserved = ['deepseek', 'groq'].every(
        (id) => typeof stored.keys[id] === 'string',
      );
      results.roundTripOk =
        safeStorage.decryptString(Buffer.from(stored.keys.deepseek, 'base64')) ===
          'test-key-12345' &&
        safeStorage.decryptString(Buffer.from(stored.keys.groq, 'base64')) === 'test-groq-key';

      // clearApiKey akışı: slot silinince kalan slotlar korunur.
      delete stored.keys.deepseek;
      await atomicWriteJson(file, { version: 2, keys: stored.keys });
      const afterClear = await readJson(file);
      results.clearLeavesOthers = !('deepseek' in afterClear.keys) && 'groq' in afterClear.keys;
    } catch (e) {
      results.error = String(e && e.message);
    }
  }

  results.userDataPath = app.getPath('userData');
  results.appVersion = app.getVersion();

  console.log('SONUC=' + JSON.stringify(results, null, 2));
  fs.rmSync(testDir, { recursive: true, force: true });
  app.quit();
});
