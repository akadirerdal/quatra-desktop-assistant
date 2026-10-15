/**
 * Şifre kasası doğrulama scripti — Electron ile koşar (node ile DEĞİL).
 * Kullanım: npx electron scripts/check-credentials.cjs
 * Gerçek safeStorage (DPAPI/Keychain) + atomik dosya akışını doğrular.
 */
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.whenReady().then(async () => {
  const results = {};

  results.encryptionAvailable = safeStorage.isEncryptionAvailable();

  const testDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'quatra-cred-'));
  const file = path.join(testDir, 'credentials.json');

  if (results.encryptionAvailable) {
    try {
      const enc = safeStorage.encryptString('test-key-12345');
      results.encryptOk = enc.length > 0;
      await fs.promises.writeFile(file, JSON.stringify({ version: 1, keyEnc: enc.toString('base64') }), 'utf8');
      const raw = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      const dec = safeStorage.decryptString(Buffer.from(raw.keyEnc, 'base64'));
      results.roundTripOk = dec === 'test-key-12345';
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
