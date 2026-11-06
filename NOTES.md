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

## 1.4.15 web import (moved from project brief)
- src/lib/webtext.ts fetchWebText: Wikipedia API → Jina Reader (r.jina.ai JSON) → raced CORS relays (api.cors.lol, codetabs, allorigins, corsproxy.io) + @mozilla/readability. finish() strips links, images, tables, [n], captions/credits, bylines, dates, junk, stop sections.
- Sandbox IP blocked by Jina/relays; tests route api.cors.lol to curl (test/webrelay1415.mjs, test/webui1415.mjs).
- UI components/webimport.tsx: input → loading → preview → Listen now / Listen later / Save the audio. Library + opens it; clipboard URL on Listen opens it; bare URL in editor shows .url-banner. Clips carry url and site.
## 1.4.22
- text.ts expandAbbrev (ES_ABBR) via speakable(text, lang) in listen + exporter: EEUU/EE.UU./E.E.U.U. → Estados Unidos, RR.HH., FF.AA., JJ.OO., Sr./Sra./Dr., etc.
## 1.4.23
- src/engine/keep.ts startKeeping() (main.tsx): persist() at start; after each engine/lang turns ready, checks the cache 4 s later and stamps localStorage logos.kept; on start a stamp without a cache sets logos.keepNote 'cleared'; a failed write sets 'notSaved'. Settings Storage row shows Protected/Not protected and the note. Test test/keep1423.mjs.
## 1.4.24
- vite.config.ts plugin pocketAssets swaps pocket-tts-onnx's dist/assets.js for src/engine/pocket-assets.js (page + worker; NOPATCH=1 disables). Downloads into one buffer and caches it once (stock kept ~3 copies, ~530 MB peak). Streaming response.clone() into Cache.put failed ("network error") for the 177 MB model in Chrome, so not used. Tests test/pocketcache1424.mjs, test/phononcache1424.mjs (both cache fine in sandbox).

## 1.4.27 Books (2026-11-05)
- Library has a Saved | Books switch (`logos.shelf`). Books live in IndexedDB `logos-books` (stores `books` = BookMeta incl. cover Blob, `content` = chapters). `src/lib/books.ts`.
- Import: `src/lib/book/import.ts` → epub.ts (JSZip; spine, nav/ncx contents, internal links + footnotes; a long file is split where a contents entry lands on a heading), pdf.ts (pdfjs-dist **legacy** build, since the modern build needs Uint8Array.toHex; rebuilds paragraphs/headings, drops running heads and page numbers, reads printed page numbers, keeps outline and link annotations snapped to words, cover = page 1 render; scanned PDFs refused), formats.ts (docx via mammoth, fb2, html, md incl. footnotes, txt incl. Gutenberg START/END + chapter-line detection, rtf). Shared `html.ts` walker and `finish.ts` (chapterize, resolve links, contents, auto links: contents-page lines, "capítulo IV"/"chapter 4" mentions, "página 37" in PDFs).
- Reader `src/pages/BookPage.tsx` at `#/book/<id>` (hides topbar/nav via html[data-book]): header (search, contents, Aa), chapter view, Back chip after link jumps, note pop-up for footnotes, search across the book (accent/case-insensitive, 500 cap, find bar with prev/next), tap a paragraph → Listen from here / bookmark / copy, bottom bar with progress, time left, Listen. Position saved per book.
- Not supported: MOBI/AZW/DJVU/DOC/ODT (message asks for EPUB or PDF); OCR for scanned PDFs; sharing files into Logos.
- Tests: test/books1427.mjs (import summary), test/reader1427.mjs (reader flows); fixtures in test/books (not pushed).

## 1.4.28 Share books into Logos (2026-11-05)
- manifest share_target is now POST multipart to ./share-target (title, text, url, files "books": epub/pdf/docx/fb2/txt/md/html/rtf + octet-stream). sw.js takeShare(): files → Cache `logos-share` (`__share/<stamp>-<i>`, x-name header) then 303 to `?sharedfiles=N#/library`; text → 303 to `?title&text&url` (old consumeShareTarget path). LibraryPage takeSharedFiles() → importMany() one after another ("Importing 2 of 5"). Needs the SW active (any earlier visit). Test test/sharefiles1428.mjs.

## 1.4.29 PDF import cleanup (2026-11-05)
Oscar's OCR'd PDF (How the Mind Works) imported badly: blurb as title, running heads "24 I HOW THE MIND WORKS" kept, OCR junk lines as chapters.
- pdf.ts: per page, drop caps join their line; OCR noise lines dropped (letter share < 45 % or word quality < 0.5). Running heads matched fuzzily (letters-only key, top 3/bottom 2 lines, ≥3 % of pages, contains/Levenshtein). Printed page numbers also read from the start of a running head.
- Title: PDF metadata (junk-filtered) → most frequent running head (title-cased) → file name with 2+ words → first big line on page 1.
- No outline: chapters from the printed contents page (entries "IX. Title 89", sub-entries ending in comma dropped, running-head garbage cut before the chapter number), placed via printed→PDF page map or its usual offset, matched to the heading on that page.
- Headings must not start lowercase and need word quality ≥ 0.7.
- Book reader: mini player hidden on #/book; the bottom bar Listen turns into Pause while playing. Mini player text now wraps, no ellipsis.
- Fixture test/books/talks.pdf (archive.org talkstoteacherso00jame_bw, OCR layer): 15+2 chapters from its contents page, real title.

## 1.4.30 Book polish (2026-11-05)
- Reader header shows the short title (before ":"/"—") wrapped, no line clamp/ellipsis. Import card title and web-loading line wrap instead of ellipsis.
- PDF cover: first non-blank page of 1–4 (ink > 1.2 %), else the drawn cover.
- Author "James, William, 1842-1910" → "William James" (tidyAuthor in finish.ts).

## 1.4.31 (2026-11-05)
- Launch splash in index.html (pure HTML/CSS, shows before JS): starts as the exact app icon (matches Android's native splash), gold shine sweeps the lambda, sound ripples pulse from the arcs, mark lifts and shrinks, "Logos" letters rise, tagline "Listen to anything", then zoom/blur fade. Min 2.9 s, max 6 s, once per session (sessionStorage logos-splash), reduced-motion static. main.tsx calls window.__logosReady after paint + fonts. Frame test test/splashframes.mjs (pauses animations at set times).
- Voice chip shows the voice actually reading (voiceFor(lang) / s.voices[current]); before it showed the saved override even when Auto picked the other language.
- PDF contents: parsed line by line first ("J Standard Equipment 3" → 1.; OCR digit map J l I | ! O S B; roman front-matter pages like "Preface ix" placed by title), with the paragraph reading as fallback; the reading with more chapters wins. Fixture test/books/mindlike.pdf (fpdf2, synthetic Pinker-like).
- Pages taller than 2.2 screens (Voices) enter without blur (pageInLong) — Oscar saw the screen drop on Voices.
- index.html now also copied to the source branch.

## 1.4.32 (2026-11-05)
- Splash: first frame now matches Android's native splash on Samsung (squircle rx 200/512, content at .91 scale, 98% size, 10px above centre); during the lift the squircle morphs to the 116 radius and content to full size (1.15 s, starts .7 s). Ripples/arcs/glow wait ~.5 s so the first frames are the still icon. Lockup is absolutely positioned around the screen centre.
- Book ⇄ Listen: listenFrom saves a paragraph map (lib/book/nowreading.ts, localStorage logos.nowReading). Book bar shows Pause + "Follow" (→ Listen) when this book is the one in Listen. Listen head shows the book card "Back to book", which sets the book's pos to the paragraph being read and opens it. Test follow1431.mjs.
