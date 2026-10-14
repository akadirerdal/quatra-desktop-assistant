# Quatra Desktop Assistant

Modüler masaüstü asistan. `TODO.md` tek kaynak plan dosyasıdır.

## Mimari

```
src/core/       # config, logger, event-bus
src/modules/    # plugins (öncelikli), assistant, voice, ...
src/shared/     # ortak utils/tipler
src/renderer/   # React UI
electron/       # main + preload
tests/unit/     # Vitest testleri
```

## Komutlar

```bash
npm install
npm run dev          # Vite renderer
npm run dev:electron # Electron + Vite
npm run test
npm run typecheck
npm run lint
npm run verify       # typecheck + lint + test (kapı)
npm run build
```
