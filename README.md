# Quatra — Voice-First Desktop Assistant

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-6e5fc4)
![status](https://img.shields.io/badge/status-v0.1.0%20source%20preview-6e5fc4)
![voice](https://img.shields.io/badge/voice-T%C3%BCrk%C3%A7e-6e5fc4)

**English** · [Türkçe](README.tr.md)

**Quatra is a modular, voice-first desktop assistant for Windows and macOS.** You talk, it acts: say the wake word **“Quatra”**, hear **“Efendim?”** (at your service), speak your command — and get a spoken answer. It holds a continuous conversation, lets you interrupt mid-sentence, and actually uses tools on your machine — with real, enforced permissions.

Built with Electron + Vite + React + TypeScript. Brain: **DeepSeek** · Ears: **Groq Whisper** · Voice: **Edge Neural TTS** with a system-speech fallback.

> The voice experience and UI are **Turkish-first**. This README documents only what actually works — the project follows a strict “no fake UI” rule: nothing is shown as working unless it really works.

## Features

**🎙 Voice**

- Wake word **“Quatra”** (pronunciation variants like *kuatra/quatro* are recognized) → **“Efendim?”** → your command.
- **Continuous conversation** (on by default): after an answer it keeps listening — no wake word needed; if you stay silent it returns to standby (default 5 s, adjustable).
- **Push-to-talk hotkey** (global): `Ctrl+Shift+Space` on Windows · `⌘⇧Space` on macOS — changeable in Settings.
- **Barge-in**: talk over Quatra and it stops and listens immediately.
- **Voice stop**: say “sus” / “dur” / “yeter” — it goes quiet without ending the conversation.
- **Standby**: say “uyu” — the conversation ends, the mic stays open, and the wake word listens again.
- Natural Turkish voices (Emel/Ahmet, Edge Neural) with automatic fallback to system speech when Edge is unreachable.

**🧠 Brain**

- DeepSeek (`deepseek-chat` / `deepseek-reasoner`); the real model list is fetched from the provider and validated — no hardcoded fake lists.
- Five **model tiers** (Düşük → Ultra Max) and two work modes (**Hızlı** / **Düşünceli**) — switchable by voice or from the bottom bar.
- **Backup provider**: if DeepSeek fails temporarily, Groq takes over automatically; if both are down you get an honest spoken error.

**🛠 Tools (real, permission-gated)**

- `sysinfo`, `open_app` (strict allowlist), `open_url` (http/https only), `not_al` (markdown note to a folder you pick), `clipboard_yaz`, `clipboard_oku`.
- Three permission levels: **safe / low-risk / sensitive**. Sensitive actions ask for **spoken confirmation** (“evet” / “hayır”, 20 s timeout) — no popup boxes. The model can never widen its own permissions, and there is no shell access.

**🧷 Memory**

- Local by default (`memory.json`): “hatırla: …” stores things silently; “adım ne?” reads them back; useful personal details are learned from conversation (silent learning — can be turned off).
- Manage everything in Settings → **Hafıza** (Memory): list, delete, clear — deletions are backed up first.
- Optional **mem0** cloud memory engine (key stored in the OS vault); the local engine is the default.

**🖥 Desktop app**

- Tray mode: closing the window sends Quatra to the tray — it keeps working; quit from the tray menu (macOS: ⌘Q).
- Launch at login (installed builds; honestly marked as unsupported when running from source).
- 7 themes, UI scale, reduced motion.
- Audit log (“İşlem Kaydı”), note backups with one-click restore, token counters, diagnostics, settings export/import (API keys never included).
- Window chrome: custom title bar on Windows; native traffic lights + app menu on macOS. Opens fullscreen on first launch (F11 / ⌃⌘F).

## How it works

```
Microphone → level/VAD → “Quatra” wake → Groq Whisper (STT) → DeepSeek + tools → Edge Neural TTS → Speaker
```

Audio is used for live transcription only — it is never written to disk.

## Quick start (from source)

> No installers are published yet — that is intentional. Quatra is developed from source until the product is approved for packaging (see [Packaging](#packaging)).

**Requirements:** Node.js ≥ 22 (Windows 10/11 or macOS), an internet connection (the brain and ears are cloud services), and two free API keys (below).

```bash
git clone https://github.com/akadirerdal/quatra-desktop-assistant.git
cd quatra-desktop-assistant
npm install
npm run dev:electron
```

### First-run setup

1. The app opens with a **“Quatra’yı kur”** (Set up Quatra) banner.
2. Go to **Settings → AI Sağlayıcı** (AI Provider):
   - Paste your **DeepSeek API key** (platform.deepseek.com → API keys) — the brain.
   - Paste your **Groq API key** (console.groq.com → API keys) — speech-to-text and the wake word (the free tier is enough).
   - Keys are stored in the OS-encrypted vault (Windows DPAPI / macOS Keychain) — never in plain files, never in the renderer.
3. Click **Test et** (Test) — a real request is made; “connected” only lights up if it truly connects. **Modelleri getir** (Fetch models) pulls the real model list.
4. Grant **microphone permission** when asked (macOS shows a system dialog; Windows: Settings → Privacy → Microphone).
5. Say **“Quatra”** or press `Ctrl+Shift+Space` / `⌘⇧Space`.

### macOS notes

- Same commands: `npm install` → `npm run dev:electron`.
- Mic permission is requested on first use; if you deny it → System Settings → Privacy & Security → Microphone (the app appears as **Electron** in dev mode, **Quatra** in packaged builds).
- Push-to-talk default is **⌘⇧Space**; conflicts are reported and can be changed in Settings.
- Data lives in `~/Library/Application Support/Quatra`.
- `open_app` mapping: TextEdit · Calculator · Finder · Terminal · Activity Monitor (Paint has no macOS equivalent — Quatra returns an honest error instead of pretending).
- macOS adaptation is complete in code; real-Mac verification is in progress — see [docs/platform-matrix.md](docs/platform-matrix.md).
- DMG can only be built on macOS: `npm run package:mac`.

### Packaging

```bash
npm run package:win   # Windows NSIS installer → release/   (not published yet)
npm run package:mac   # macOS DMG → release/               (macOS only; not published yet)
```

Installers will be produced and shared only when the product is approved. Until then, run from source.

## Usage

Say **“Quatra”** → “Efendim?” → your command. During an active conversation the wake word is not needed; silence returns it to standby.

| You say (Turkish) | What happens |
|---|---|
| “Quatra, not defterini aç” | Opens Notepad (Windows) / TextEdit (macOS) |
| “Hesap makinesini aç” | Calculator |
| “Görev yöneticisini aç” | Task Manager / Activity Monitor |
| “10 dakika sonra çayı hatırlat” | Local reminder (2 s – 24 h); spoken when it fires |
| “hatırla: yarın sınavım var” | Stores it in local memory, silently |
| “adım ne?” | Answers from memory |
| “yazılım moduna geç” / “normal moda geç” | Switches work mode (Pro / Fast) |
| “detaylı anlat” | Asks for a longer answer instead of the short default |
| “sus” | Stops speaking immediately |
| “uyu” | Ends the conversation — mic stays open for the next wake word |
| “bilgisayar bilgisi ver” | Runs the `sysinfo` tool |
| “github.com’u aç” | Opens the URL in your default browser (http/https only) |

Sensitive actions (reading the clipboard, writing note files) ask a spoken “evet/hayır” confirmation first.

## Configuration

Settings has nine sections (the UI is in Turkish):

| Section | What you'll find |
|---|---|
| **Genel** (General) | Startup / launch-at-login behavior, export & import settings (keys excluded), app version |
| **AI Sağlayıcı** (AI Provider) | DeepSeek & Groq keys, real connection test, model list |
| **Ses ve Giriş** (Voice & Input) | Mic test with live level, input device, VAD sensitivity, capture filters, TTS voice/rate/pitch |
| **Etkinleştirme** (Activation) | Push-to-talk shortcut, wake-word and continuous-conversation toggles |
| **Görünüm** (Appearance) | 7 themes, accent color, UI scale, reduced motion |
| **Hafıza** (Memory) | Memory list & management, engine (local / mem0), auto-learn toggle |
| **Gizlilik** (Privacy) | Conversation transcripts (off by default) and their deletion |
| **İşlem Kaydı** (Action Log) | The audit log of what Quatra did — view & clear |
| **Teşhis** (Diagnostics) | Logs, token usage, version info |

**Model tiers** (bottom bar, model pill):

| Tier | Model | Temperature | Max tokens |
|---|---|---|---|
| Düşük (Low) | deepseek-chat | 0.3 | 1024 |
| Varsayılan (Default) | deepseek-chat | 0.7 | 2048 |
| Yüksek (High) | deepseek-reasoner | 0.7 | 4096 |
| Max | deepseek-reasoner | 1.0 | 8192 |
| Ultra Max | deepseek-reasoner | 1.2 | 8192 |

## Tools & permissions

| Tool | Level | Action |
|---|---|---|
| `sysinfo` | safe | OS & app info |
| `open_app` | low-risk | Opens an allowlisted app only: notepad, calculator, file explorer, command prompt / PowerShell, task manager, Paint (Windows); TextEdit, Calculator, Finder, Terminal, Activity Monitor (macOS) |
| `open_url` | low-risk | Opens http/https links in the default browser |
| `not_al` | low-risk + confirm | Writes a markdown note to your chosen folder (the folder is remembered; existing notes are backed up before overwrite) |
| `clipboard_yaz` | low-risk | Copies text to the clipboard |
| `clipboard_oku` | sensitive + confirm | Reads the clipboard |

Permissions are enforced in the native layer — the model cannot grant itself anything.

## Memory & privacy

**Where your data lives:**

| Windows | macOS |
|---|---|
| `%APPDATA%\Quatra` | `~/Library/Application Support/Quatra` |

| File | Contents |
|---|---|
| `credentials.json` | API keys — encrypted by the OS vault (DPAPI / Keychain); readable only by the main process |
| `settings.json` (+ `.bak`) | Settings, atomically written with backup recovery |
| `memory.json` (+ `.bak`) | Local memory entries; deletions are backed up |
| `logs/quatra.log` | Rolling log (~1 MB rotation); secrets are redacted |
| `audit.jsonl` | Action log — last 800 entries, redacted |
| `transcripts.jsonl` | Conversation transcripts — **only if you opt in**; clearable |
| `token-usage.json` | Token counters (monthly + total) |
| `notes-dir.txt` | The notes folder you picked |

**What leaves your machine:** the text of your commands goes to Groq (speech-to-text) and DeepSeek (answers); the answer text goes to Microsoft's Edge TTS endpoint for speech. Audio is never stored. If you enable the optional mem0 engine, memory syncs there — otherwise everything stays local. API keys never leave your machine.

## Development

```bash
npm install           # install dependencies
npm run dev           # renderer only, in a browser
npm run dev:electron  # full app with live reload (recommended)
npm run test          # 241 unit tests — no real API keys needed
npm run verify        # typecheck + lint + tests + secret scan (the gate)
npm run build         # production build (dist + dist-electron)
npm run check:secrets # secret scan (also part of verify)
npm run format        # Prettier
```

**Project map:**

| Area | Where |
|---|---|
| Electron main — window, tray, shortcuts, IPC, vault, audit | `electron/` |
| Audio pipeline — capture, levels, VAD, recording, barge-in, TTS queue | `src/features/audio/` |
| Wake word | `src/features/audio/wake-word.ts` |
| Assistant flow — wake → answer → listen again | `src/features/assistant/assistant-controller.ts` |
| Agent loop, streaming, context | `src/features/agent/` |
| Tools & permissions | `src/features/tools/` |
| Providers — DeepSeek client, Groq transcription | `src/providers/` |
| Memory store & extraction | `src/services/memory/` |
| Settings schema (zod) & stores (zustand) | `src/state/` |
| UI — main screen, settings, title bar | `src/features/`, `src/renderer/` |
| Tests (vitest) | `tests/` |

Windows convenience: `scripts/quatra-baslat.vbs` runs the dev app hidden (desktop-shortcut friendly).

## Project status

- **v0.1.0 — source preview.** Windows is developed and verified on real hardware. macOS adaptation is complete in code; on-device verification is in progress — platform claims are tracked honestly in [docs/platform-matrix.md](docs/platform-matrix.md).
- **Next up:** the “Ses Stüdyosu” microphone rebuild — a real DSP chain, stages S1–S8, planned in [MIKROFON.md](MIKROFON.md). Then: browser & desktop agent phases ([TODO.md](TODO.md)).
- **Packaging is gated:** NSIS / DMG installers are produced only after the product is approved.

## Known limitations (honest list)

- UI and voice are Turkish; there is no English UI yet.
- The wake word runs through Groq — it needs internet. A fully local wake-word engine is planned.
- No system volume control and no output-device picker — the app marks these as unsupported instead of faking them.
- Edge Neural TTS needs internet; offline it falls back to the system voice.
- Linux is untested; only Windows and macOS are targeted.
- No auto-update yet. Packaged builds are unsigned → OS security warnings are possible once packaging starts.
- The microphone capture chain is being rebuilt step by step (the current chain works; the studio upgrade is in progress).

## Troubleshooting

| Problem | Check |
|---|---|
| Quatra doesn't hear me | Mic button state; Settings → Ses ve Giriş → live level test; system microphone permission |
| Wake word does nothing | Groq API key present? Say “Quatra” clearly; check Settings → Etkinleştirme |
| No speech output | Edge TTS needs internet; otherwise the system voice takes over — on Windows, add more voices via Settings → Time & Language → Speech → Add voices |
| Window closed but the app still runs | That's tray mode — reopen from the tray icon; quit via the tray menu |
| Provider errors | Settings → AI Sağlayıcı → **Test et** / **Modelleri getir** show the real error |
| Where are the logs? | Settings → Teşhis, or `%APPDATA%\Quatra\logs\quatra.log` (`~/Library/Application Support/Quatra` on macOS) |

## Docs

- 📘 [User guide (PDF, Turkish)](docs/Quatra-Kullanim-Kilavuzu.pdf)
- 🗺 [Platform matrix](docs/platform-matrix.md) — what is verified where
- 🎛 [MIKROFON.md](MIKROFON.md) — microphone studio plan (S1–S8)
- 🗓 [TODO.md](TODO.md) — roadmap & history (the single source of truth)
- ❓ [SORULAR.md](SORULAR.md) — open questions
- 🧩 [EKSIKLER.md](EKSIKLER.md) — known gaps
- 📦 [V1-UPDATE.md](V1-UPDATE.md) — v1 backlog

## License

No license has been chosen yet — all rights reserved for now. Ideas and feedback are welcome via GitHub Issues.
