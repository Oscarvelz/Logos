# Logos — notes

Logos is a phone-first, private text-to-speech PWA. It is a simplified rebuild of
[BetterTTS](https://github.com/SysAdminDoc/BetterTTS) by SysAdminDoc (MIT). The
upstream LICENSE is kept, with an added copyright line for the Logos changes.

## What it does

- **Listen** (`#/listen`): paste or type text, or share it in from another app, and
  press Play. The text is split into sentences. Logos prepares audio until what is
  ready covers the rest of the text at the measured speed, then reads to the end
  without stopping while the remainder renders in the background. Play/pause,
  previous/next sentence, a draggable progress bar (YouTube-style, sentence
  tooltip), speed 0.5× to 2.5× (instant, pitch kept), a live spectrum drawn on its
  own thread, and the current sentence highlighted. Tap any sentence to jump there;
  sentences already rendered play instantly. Lock-screen controls via the Media
  Session API. While audio is being prepared an inaudible track keeps the page
  alive, so it keeps working while you use other apps and starts speaking on its
  own. Detects English vs Spanish per paragraph, or force EN / ES. Remembers your
  last text.
- **Create** (`#/create`): renders the whole text into an **MP3** (128 kbps, encoded
  as it goes) or **WAV** file, with voice, speed (time-stretched, pitch kept) and a
  title. Play, Download, Share, and an automatic save to the Library.
- **Library** (`#/library`): clips in IndexedDB; replay with seek, download, share,
  open in Listen, delete with Undo, search.
- **Voices** (`#/voices`): PocketTTS voices — English: Alba, Anna, Michael, Liat,
  Omer; Spanish: Lola, Javert. Preview clips in `public/previews/pk_*.mp3`
  (generated in Node with pocket-tts-onnx). Star favourites, set a default per
  language.
- **Settings** (`#/settings`): voice status and download progress, Download now,
  Delete model, storage with "Protect", download on first play, device voice
  bridge (off by default), speed, pause between sentences, highlight, theme, About.
- **Offline**: the service worker caches the app shell, the ONNX Runtime WASM, and
  the PocketTTS manifest/voice files; pocket-tts-onnx keeps the models in Cache
  Storage (`pocket-tts-models-v2`). After the first download everything works
  offline.
- **Share target**: installed PWA appears in Android's share sheet.

## Voice engine

- [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) by Kyutai (100M params,
  CC BY 4.0), exported to ONNX by
  [pocket-tts-onnx](https://github.com/thewh1teagle/pocket-tts-onnx) (CC BY 4.0),
  running on ONNX Runtime Web (WASM, multi-threaded) in a Web Worker.
- One model per language (~179 MB each), downloaded the first time that language is
  read. One worker per language; phones keep one loaded at a time.
- `src/engine/pocket.ts` (manager + priority queue), `src/engine/pocket.worker.ts`,
  `src/engine/engine.ts` (the app-facing API and status store).
- A cached model loading into memory shows as Ready; play waits for it quietly.
- The service worker adds COOP/COEP headers (cross-origin isolation, adapted from
  BetterTTS) so ONNX Runtime can use threads on GitHub Pages.

## Build & deploy (GitHub Pages)

```bash
npm install
npm run build              # → dist/
```

- Base path in `vite.config.ts` (`VITE_BASE`, default `/Logos/`).
- Deploy: copy the contents of `dist/` to the root of `Oscarvelz/Logos` (main),
  keep `.nojekyll` and `LICENSE`. Source lives on the `source` branch.

## Licences

- Code: MIT (© SysAdminDoc, © Oscar Arnoldo Velasquez for the Logos changes).
- Pocket TTS models: CC BY 4.0 (Kyutai); pocket-tts-onnx: CC BY 4.0. Credited in
  About and LICENSE.
- `@breezystack/lamejs` (MP3): LGPL-3.0. Fonts: Manrope, Instrument Serif (OFL).

## Tests (headless Chromium)

`test/`: `ui.mjs` (pages, layouts, themes, share target), `pocket120.mjs`
(PocketTTS English + Spanish playback), `seek121.mjs` (instant back, scrubber),
`bg122.mjs` (keep-alive while preparing), `viz113.mjs` (off-thread spectrum).
`chain-proxy.mjs` lets headless Chromium reach Hugging Face. Real audio output,
lock-screen controls and true background behaviour need a real phone.
