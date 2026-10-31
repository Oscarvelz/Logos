# Logos — notes

Logos is a phone-first, private text-to-speech PWA. It is a simplified rebuild of
[BetterTTS](https://github.com/SysAdminDoc/BetterTTS) by SysAdminDoc (MIT). The
upstream LICENSE is kept, with an added copyright line for the Logos changes.

## What it does

- **Listen** (`#/listen`): paste or type text, or share it in from another app, and
  press Play. The text is split into sentences. The first chunk is kept short so
  audio starts fast. Kokoro renders that chunk first, playback begins, and the
  next 3 sentences are rendered while it plays (6 when the screen is off). You get
  play/pause, previous/next sentence, a speed setting from 0.5× to 2.5× (applies
  instantly, pitch kept), a live waveform, and the current sentence highlighted.
  Tap any sentence to jump there. Lock-screen controls work through the Media
  Session API, and one `<audio>` element plays everything so Android keeps going in
  the background. The page has Paste, Clear, character and word counts, and an
  estimated listening time. It detects English vs Spanish per paragraph, or you
  can force EN or ES. It remembers your last text.
- **Create** (`#/create`): renders the whole text into an **MP3** (128 kbps, encoded
  as it goes) or **WAV** file. You can set the voice, Kokoro's own speed (0.6× to
  1.6×), and a title. It shows progress and time left, and you can cancel. When it
  finishes you get Play, Download, Share (the Android share sheet with the file),
  and an automatic save to the Library.
- **Library** (`#/library`): clips are stored in IndexedDB. You can replay with
  seek, download, share, open in Listen, delete with Undo, and search once there
  are more than 3 clips.
- **Voices** (`#/voices`): 16 hand-picked Kokoro voices (US: Heart, Bella, Nicole,
  Kore, Sarah, Aoede, Michael, Fenrir, Puck · UK: Emma, Isabella, George, Fable ·
  ES: Dora, Alex, Santa). Each has a ready-made preview clip that plays without the
  model (`public/previews/*.mp3`). You can star favourites and set a default voice
  for each language.
- **Settings** (`#/settings`): engine (Auto / WebGPU / WASM), engine status and
  download progress, Download now, Delete model, storage use with a "Protect"
  button (asks the browser to keep storage), download on first play, the device
  voice bridge, default speed, pause between sentences, highlight on/off, theme
  (Dark / Light / System), and About & credits.
- **Device voice bridge**: until the Kokoro model has downloaded, Listen speaks
  with the phone's built-in voice (`speechSynthesis`). It switches to Kokoro at the
  next sentence once Kokoro is ready.
- **Offline**: the service worker caches the app shell and the ONNX Runtime WASM.
  Transformers.js caches the model in Cache Storage. After the first download
  everything works offline.
- **Share target**: the manifest declares `share_target` (GET with title, text and
  url) pointing to `./`. The app reads the query, puts the text into Listen, and
  cleans the URL to `#/listen`. To appear in Android's share sheet, the app must
  be *installed* (Chrome menu → Install app / Add to Home screen).

## Engine details

- Kokoro-82M v1.0 ONNX (`onnx-community/Kokoro-82M-v1.0-ONNX`) runs in a Web Worker
  through kokoro-js and Transformers.js 3.8 (ONNX Runtime Web 1.22).
- Auto picks **WASM q8** (92 MB download) on phones and **WebGPU fp32** (326 MB) on
  desktops/tablets that report a WebGPU adapter and are not mobile. If WebGPU fails
  to load, it falls back to WASM. You can force either one in Settings.
- English uses the kokoro-js phonemizer. Spanish uses eSpeak-NG phonemes (`ephone`,
  Romance pack only) fed straight into the model. That path is adapted from
  BetterTTS.
- The service worker adds COOP/COEP headers (cross-origin isolation, also adapted
  from BetterTTS), so ONNX Runtime can use multi-threaded WASM on GitHub Pages. The
  first visit reloads once to turn this on.

## Build & deploy (GitHub Pages)

```bash
npm install
npm run build              # → dist/
```

- **Base path**: set in `vite.config.ts` (`const BASE = process.env.VITE_BASE ?? '/Logos/'`),
  or per build with `VITE_BASE=/Other/ npm run build`. The manifest and service
  worker use relative paths, so nothing else needs changing.
- **Deploy**: copy the **contents** of `dist/` to the root of the `Oscarvelz/Logos`
  repo (or to `docs/`), then enable Pages for that branch/folder. The site is then
  `https://oscarvelz.github.io/Logos/`. Add an empty `.nojekyll` file next to
  `index.html` to be safe.
- The total size of `dist/` is about 25 MB, most of it the ONNX Runtime WASM
  (21.6 MB, about 5 MB when gzip-served by Pages). The app's own JS is about 97 KB
  gzipped. The Kokoro and Transformers chunks load only when the engine starts.
- **Voice previews**: to regenerate them, run `test/previews.mjs` (headless) while
  the built site is served locally.

## Licences

- Code: MIT (© SysAdminDoc, © Oscar Arnoldo Velasquez for the Logos changes).
- Kokoro-82M weights: Apache-2.0. kokoro-js and Transformers.js: Apache-2.0.
- `ephone` (eSpeak NG, used for Spanish): **GPL-3.0-or-later**. `@breezystack/lamejs`
  (MP3): **LGPL-3.0**. Upstream BetterTTS ships both too. Keep this in mind if the
  app is ever distributed commercially.
- Fonts: Manrope and Instrument Serif (SIL OFL), self-hosted.

## Dropped from upstream

Electron/Windows, sidecar, browser extension, CLI, Qwen, RVC, Chatterbox,
MeloTTS/Piper/Kitten, subtitle re-voicing, EPUB/PDF/DOCX import, M4B audiobooks,
benchmark and diagnostics panels, and upstream's build gates (SBOM, budgets,
locale checks). M4B was left out because upstream's implementation is about 950
lines with chapter muxing, which is not cheap to keep. MP3 and WAV cover
downloads.

## Tests (headless Chromium)

The scripts are in `test/`: `ui.mjs` (pages, navigation, phone/tablet layouts,
themes, share target), `engine.mjs` (real Kokoro WASM: English + Spanish
streaming, MP3 and WAV export through actual downloads), and `previews.mjs`.
`chain-proxy.mjs` is a local helper that lets headless Chromium reach Hugging Face
while keeping `127.0.0.1` a secure context. Screenshots are in `test/shots/`.

## Test results (headless Chromium 133, aarch64 sandbox, 2 CPU cores)

- All 5 pages render. Hash navigation works from the bottom nav (412×915) and the
  side rail (1280×800). No horizontal overflow and no page errors. Dark and light
  themes were both checked.
- Service worker active, `crossOriginIsolated === true` under `/Logos/`.
- Share target: `?title=&text=&url=` lands in Listen with the text filled in and
  the URL cleaned to `#/listen`.
- Kokoro WASM q8: the 92 MB model downloaded and loaded (about 6 s from cache).
  English and Spanish (ef_dora) synthesized real audio. Streaming playback moved
  forward sentence by sentence. Tap-to-seek into a Spanish paragraph switched to
  Dora automatically. Mixed EN/ES text was detected per paragraph.
- Export: MP3 (16.6 s, 128 kbps, 24 kHz mono) and WAV (6.9 s, PCM 16-bit) were
  downloaded through the real Download buttons and checked with ffprobe; silence
  detection shows the expected sentence gaps. Both clips appeared in the Library.
- Pause/resume, the speed sheet, voice previews (pre-rendered, which pause
  Listen), and the mini player on other pages were all exercised.
- Speed in this sandbox: about 4× *slower* than real time (2 weak cores). Expect
  much faster on a modern phone (4 WASM threads) or with WebGPU.

### Not verifiable headless
- Real audio output and listening quality; lock-screen Media Session controls;
  background playback with the screen off; the Android share sheet (needs an
  installed PWA); clipboard Paste on a real device; the device-voice bridge
  (headless has no speechSynthesis voices, so it correctly fell back to waiting
  for Kokoro); WebGPU (no GPU in the sandbox); synthesis speed on a Pixel-class
  phone or tablet.
