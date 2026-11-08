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

## 1.4.33 + Logos for Android (android-1, 2026-11-05)
- Android shell lives in branch `source` at android/ (package com.oscarvelz.logos, minSdk 29), workflow .github/workflows/android.yml builds on push to android/** and publishes release android-N with Logos.apk (https://github.com/Oscarvelz/Logos/releases/latest/download/Logos.apk). Signing key logos.p12 (alias logos); private copy + password in /workspace/work/logos-android-private. Working copy /workspace/work/logos-android.
- Shell: WebView on https://oscarvelz.github.io/Logos/ with app-private storage, UA tag "LogosAndroid/x", renderer priority important, native ACTION_OPEN_DOCUMENT picker (any file when accept lists extensions), share/open-with intents (text → ?title&text, files → ?sharedfiles=N#/library read via bridge sharedList/sharedChunk/sharedDone), downloads via bridge saveChunk/saveDone into Download/Logos (+share sheet for Share buttons), PlaybackService (mediaPlayback foreground service, MediaSession notification with prev/play/next, partial wake lock while playing), self-update check on android-N releases, plain dark Android 12 splash (page splash fades the mark in when UA has LogosAndroid).
- Web side: import.ts takeFromAndroid; audio.ts downloadBlob(blob, name, share) Android path; listen.ts reports playback to LogosAndroid.playing and listens for logosandroid-toggle/next/prev; phonon threads() also allows threads when shared WebAssembly memory works without cross-origin isolation (WebView).
- Unverified on a device: WebView speed / threads, notification, shares. No emulator in the sandbox.

## 1.4.34 (2026-11-05)
- Real cause of the Voices "drop": on a 384 px-wide phone the voice cards were 375 px (grid 1fr min-content), making the page 393 px wide; Android then zooms out and the fixed bottom bar slides down and gets clipped. Fix: voice-grid minmax(0,1fr), voice-card min-width 0, html/body overflow-x clip.
- In the Android app (UA LogosAndroid): Storage says "Kept inside the Logos app…", no Protect button, no Device voice bridge row.

## 1.4.35 (2026-11-05)
- Tablet (≥1100 px, Galaxy Tab S10 Ultra landscape): Listen editor/reader fill the screen height beside the player; Settings in two balanced columns (set-cols/set-group).
- Books shelf: cover size control (small/medium/large, localStorage logos.shelfSize; phone default large = 2 a row, tablet default medium). Phone S/M/L = 4/3/2 a row; wider screens minmax 100/138/184.
- Book reader text can now go down to 11 px (was 14).

## 1.4.36 (2026-11-06) — tablet only; phone frozen at Oscar's request
- Old-version flip-back: sw.js navigations now fetch with cache 'no-cache' (GitHub Pages' 10-min HTTP cache handed back the previous index.html), install pre-cache uses cache 'reload', other network-first GETs no-cache; register with updateViaCache 'none' and reg.update() on visibility.
- Ready/Voice status pill moved from the rail's bottom corner to under the brand (rail-status).
- Listen ≥1100: right column = player + TabletDesk (src/components/desk.tsx): Continue/Start reading book card, Favorite voices chips (hidden when height ≤900), Recent in Library (opens in Listen).
- Book reader ≥1100: contents/bookmarks pinned in a left column (TocBody side), header Contents button hidden there, bottom bar centred over the text column.

## 1.4.37 (2026-11-06) — big tablet (Tab S10 Ultra landscape ≈ 1973×1202 CSS, DPR 1.5; portrait ≈ 1232×1973)
- Measured from Oscar's screenshots (rail 138 px real = 92 CSS). ≥1500 px rules at the end of styles.css; phone untouched.
- Listen: text | player + desk | TextMap (stats: listening time, words, sentences, paragraphs, language, % heard; paragraph map that jumps with seek). Editor/reader fill the height.
- Create: text | settings | RecordingsPanel (play recordings in place).
- Library: Saved and Books side by side (lib-split), tabs hidden.
- Voices five across; Settings three columns; Book: contents | text (860) | BookInfo (progress ring, time left, Listen/Search/Text, bookmarks).
- Test: /tmp-style script big.mjs at 1973×1180 and 1232×1940.

## 1.4.38 (2026-11-06)
- Tablet (>=840): engine pill moved from the rail into Listen title line, right edge (.lh-status); rail pill hidden on Listen. Phone untouched.

## 1.4.39 (2026-11-06)
- Paste in the Android app: WebView blocks clipboard-read, so readClipboard() (src/lib/clipboard.ts) uses LogosAndroid.clipboard() (new in the shell, ClipboardManager) and falls back to navigator.clipboard.

## 1.4.40 (2026-11-06)
- Listen Paste button now loads the clipboard text and starts playing at once (was: open editor and only prepare). Test test/pastetest.mjs (stubs LogosAndroid.clipboard). Android signing moved to secrets LOGOS_KS_B64/LOGOS_KS_PASS, key v2 (v1 was public).

## 1.4.41 (2026-11-06, Muse, at Oscar's request)
- Books shelf grid: tile titles clamped to two lines with an ellipsis and a fixed two-line height, words no longer break mid-word (was overflow-wrap: anywhere, unlimited lines, uneven cards). Full title still shows in the reader and the book menu.
- Recently read sort: the tile sub-line now also says when the book was last read (Today / Yesterday / N d ago / date), so the order is visible on the cards.

## 1.4.42 (2026-11-06, Muse, at Oscar's request)
- Book reader: the bottom bar's progress line is now a seek bar. Drag (or tap) anywhere on it to move through the book by words, like scrubbing a video: while dragging, the bar previews the target percent and chapter in a small bubble and the % / chapter readout follows; releasing jumps there (undoable via Back). Arrow keys move 5% when the bar is focused. New inverse helper posAtProgress in lib/books.ts (progressAt's mirror). The drag works within a single chapter too, by block word counts.
- Reader header on phones: the book line is now one line with an ellipsis instead of wrapping, the chapter title is capped at two lines and no longer breaks words mid-word, and the header icons align to the top line instead of floating mid-title.

## 1.4.43 (2026-11-06, Muse, at Oscar's request)
- Listen "Back to book" card: only the book name's layout changed (icon and card design untouched). The title is now capped at two balanced lines with an ellipsis and no longer breaks words mid-word, so it sits evenly in the card instead of sprawling and leaving empty gaps.

## 1.4.49 (2026-11-07, Muse, at Oscar's request)
- No more Android-gray menus: the two native `<select>` sort controls (Books shelf, Library) are gone. A new `MenuSelect` in ui.tsx keeps the same themed pill when closed and opens the app's own Sheet (premium floating window, display-font title, menu-list rows, the current choice marked with a gold check) instead of the platform's gray option sheet.
- Premium media notification: Android draws the notification / lock-screen media card from Media Session metadata — the app cannot style the card, only feed it. Listen's metadata now titles the card with the book's title when the text came from a book (via the now-reading map) instead of the current sentence, which scrolled random headings across the card; both players (Listen and clips) offer a dedicated full-bleed artwork (`public/media-artwork.png`, 1024px, warm charcoal with gold lambda, arcs and ring, plus a 512px version) at absolute URLs, so the card takes the app's warm dark-and-gold theme instead of a generic system blue. The home-screen icons are unchanged.

## 1.4.48 (2026-11-06, Muse, at Oscar's request)
- OCR for scanned PDFs, as a fallback only: while a PDF is read page by page, any page whose text layer yields under 30 characters is rendered at 3× and read with Tesseract (English + Spanish), and the recognised lines — words with their positions and sizes — are converted into the same line shape the text layer produces, so segmentation, headings, chapters and the cover-title pass treat a scanned book exactly like a typed one. Typed pages never touch OCR. The engine and both language files are vendored under `public/ocr/` (~18 MB, fetched lazily on the first scanned page, so the app shell is unchanged) via the `tesseract.js` dependency; a page with no ink skips OCR entirely, words under 25% confidence are dropped, and the parser's existing line-quality filter still removes seal/logo noise afterwards. Verified beforehand on Oscar's scanned DC5-716 form: prose and field labels read at 95%+ (the import progress shows "Reading scanned pages (OCR)"); checkbox grids still come out rough, and a fully scanned book takes seconds per page — this rescues otherwise unreadable files, it does not make scans equal to typed text. The old "scanned pictures" error now only appears when OCR also recovers too little.

## 1.4.47 (2026-11-06, Muse, at Oscar's request)
- PDF titles: the importer now reads the title the way a person does — from the cover. A new pass over the first three pages takes the lines printed in display type (≥1.8× body height), groups them by size, and uses the biggest qualifying group as the title (title-cased when the cover shouts in caps). Guards: a lone short word in strictly the biggest type is the publisher's mark, not the title (the CBI-SUA cover leads with "UCCI" over "SUBSTANCE USE ADULT"); generic section words (Contents, Preface, Introduction…) never qualify; running heads are excluded. Priority is now metadata title → cover title → running head → first-heading guess → filename, so a good printed title is no longer outranked by the file's name. Verified against real files: the Grammar Checker Manual (no metadata) now imports under its printed title instead of a filename expansion, and CBI-SUA's cover resolves to "Substance Use Adult" when its metadata is ignored.

## 1.4.46 (2026-11-06, Muse, at Oscar's request)
- Importing a single book (PDF included) no longer leaves you on the shelf watching the Importing card: when the import finishes, the book loads straight into Listen and starts reading aloud from the beginning, with the text following along — the same session the book page's "Listen from here" builds (now-reading map, draft, 40,000-character session cap), started from chapter 1. A book with no readable text falls back to opening in the reader as before. Multi-file imports keep the previous behaviour (toast on the shelf, no auto-play).

## 1.4.45 (2026-11-06, Muse, at Oscar's request)
- Reader bottom bar: the bar is taller at the top (top padding 6px → 18px), giving the progress track its own lane above the buttons. In 1.4.44 the inset track (top 8px) landed in the buttons' band and the line crossed over the play and Follow buttons; now the track passes above them in its own space, clear of both. The drag strip shrinks to that lane (20px), and the mini player offset above the bar grows with it (78px → 90px).

## 1.4.44 (2026-11-06, Muse, at Oscar's request)
- Reader bottom bar: the progress track no longer rides the bar's top border, where the bar's rounded corners and overflow clipped it (and sliced the thumb in half at 0%/100%). The track now sits inside the bar (14px insets, 8px down, rounded ends, 4px tall) with the thumb riding inside it; drag fractions are measured against the inset track itself, so the thumb stays exactly under the finger, and the seek tooltip follows the same inset.

## 1.4.59 (2026-11-07, Muse — Oscar's correction to 1.4.58, his rule verbatim in substance)

The two rows were mine and he rejected them: the player window grew and the text window shrank — "Lo conveniente es reducir el tamaño de las pastillas y las letras para que todo vuelva a caber en la misma fila. Me gusta lo compacto y el buen uso del espacio, no crear espacio en blanco." So: one row again, exactly as before 1.4.58, and the four chips fit by being smaller — the player's chips are now 34px tall (were 40), type 12.5px (was 14), padding and gaps tightened, icons at 14px; the voice chip keeps a 170px cap its short names never reach. The player is back to its old height and the text window keeps its room. Standing lesson, his: compact is a feature; never buy legibility with vertical space that belongs to the text.

## 1.4.58 (2026-11-07, Muse, from Oscar's screenshot of the Listen player)

The four player chips shared one row, and the row starved them: the language chip read "Auto · …" and the voice chip "N…". His question was whether to rearrange them, present them differently, or remove one. Nothing was removed — each chip has a job — the row was split in two by kind: **identity on top** (language at the left, voice at the right, full 40px size, the voice chip's old 150px cap raised to 210px so a name fits whole) and **playback below** (sleep timer, speed, at a slightly smaller 36px). On any phone width both rows now hold their full text with room to spare, and the grouping reads at a glance: what is speaking, then how it plays.

## 1.4.57 (2026-11-07, Muse — the audio-engine round Oscar asked for: "elevemos a Logos a lo que siempre debe ser")

Five improvements, all pointed at the voice engine and at listening to whole books:

1. **Whole-book sessions.** Both doors into Listen (a fresh import, and Listen from here in a book) capped the session text at 40,000 characters, so a long book stopped mid-way. The cap is gone: a session is the whole book (or from here to the end). To keep a phone safe, the player's rendered-audio cache is now bounded — the synthesis lookahead is a 400-sentence window that follows the playhead (was 5,000), and rendered sentences far behind (30 kept for stepping back) or far ahead are dropped and simply re-render if you return to them.
2. **A pronunciation layer at the one funnel everything spoken passes through** (`speakable`, used by live listening and by export): codes are named, never spelled — UUIDs and hashes of 8+ hex characters become the word "code"/"código", and machine file names (share-media-<hash>.png, IMG_2044.jpg) are dropped entirely. A sentence that was only a code becomes a breath of silence in both the player and the exporter. Plus the reader's own **pronunciation dictionary** (Settings → Pronunciation): word → "say it as", whole-word and case-insensitive, stored on the device and applied to listening and exports alike.
3. **Make audiobook.** A book's info panel gains a button that renders the whole book through the existing export engine in the background (queued behind any running job, progress on the button) and lands it in Library as a normal audio clip.
4. **Finer per-sentence voice switching.** Auto mode already chose a voice per sentence, but only for sentences over 40 characters at high confidence — short quoted sentences in the other language kept the paragraph's voice. The threshold is now ~24 characters at 0.6 confidence, so a short English quote inside a Spanish book (and back) changes voice.
5. **Sleep timer + loudness levelling.** Listen gains a moon chip: 10–60 minutes, counting down on the chip, the last ten seconds fading to silence before it pauses (full volume restored for the next play; cleared when a new session loads). And every rendered sentence — live and exported — is levelled toward a common loudness (target RMS 0.16, gain capped ×0.6–×1.5, peak-guarded), so a long book sounds even instead of louder/softer per sentence.

Verified: the speech layer, the dictionary, the per-sentence switching and the levelling gains replayed in Node against the real compiled modules — 22 checks, all green (full/short hashes, UUID EN+ES, hashed and machine file names dropped, real words/versions/dates untouched, dictionary whole-word, a short quoted English sentence switching inside Spanish text, gain caps and the peak guard). Build (tsc + vite) green. On-device confirmation is Oscar's: reopen Logos (Settings → 1.4.57), listen to a long book past where 40,000 characters used to end it, share a chat with codes in it, and try the moon.

## 1.4.56 (2026-11-07, Muse, LIVE — web-only, no shell change)

Oscar's retest of 1.4.55, sharing Muse's own 1.4.55 report back into Logos: the title fix is confirmed on his phone — the book is titled from its own first line and the hash is gone. One ghost remained: the reader header showed a chapter called "Mm". The Muse card's blue logo mark OCRs as a lone "Mm", and the plain-text parser's chapter-line rule reads M as a Roman numeral, so the logo became a chapter. parseImage now drops a first line that is only that glyph when real text follows it. His test also re-confirmed the standing limit with numbers: the shared message runs about 290 words; the book holds 165 — everything up to the card's own cut point, read cleanly; the rest was never in the picture.

And the Keep sheet, at his word from a screenshot of it: five seconds is all the sheet gives you, so its legend is now two short lines in his own phrasing — "Keep saves it." / "Once removes it later." — one per line, instead of the single long sentence ("…when you move to another book"). The one word for the temporary choice is still Once, everywhere.

## 1.4.55 (2026-11-07, Muse, LIVE — web-only, no shell change)

Oscar's on-device test of 1.4.54: the text still arrived short and the title was the raw share filename. Two findings. (1) The books in his screenshot were imported by a Logos page that had been open since before the 1.4.54 publish — a loaded page keeps running the code it loaded with, so those imports ran the old single-pass OCR; a web push does not swap code mid-session, and the app must be reopened for a release to be the one that runs. (2) The title was a real defect in every version: the importing card labelled the import with Android's invented file name ("share-media-<hash>.png"), and a machine name could survive as a book's title. Now: `isMachineName`/`titleFromText` in finish.ts — the importing card shows "Shared image"/"Shared file" for machine names, finishBook ignores them as titles, and an image import whose file name is machine-made takes its title outright from its own OCR text (first strong line, cut at a word boundary, no ellipsis). Real file names behave exactly as before.

## 1.4.54 (2026-11-07, Muse, LIVE — web-only, no shell change)
- Oscar: sharing a conversation image into Logos plays only part of the text. Two causes, kept apart: (1) the sharing app itself cuts long messages — Muse's share card ends the text with "…" and a "from Muse app" footer (visible in Oscar's own 2026-11-07 share-sheet screenshot, before Logos is even chosen); those words are not in the pixels and no OCR can recover them. (2) Logos' image OCR scaled by the LONGEST side, so a tall screenshot's letters shrank with its height (a 1000×6160 card was read at 0.5×) and the bottom read worst.
- Image OCR (pdf.ts ocrImageText) now reads tall pictures in overlapping horizontal bands (1500px bands, 220px overlap, in scaled space) at a scale set by the picture's WIDTH (target ≈2000px, clamp 0.6–3), stitches the lines in order and drops duplicates read in an overlap (same normalised text, tops within 0.6 line height). The recogniser was factored into recognizePx (canvas pixels, y-down); ocrCanvasLines maps it exactly as before, so the scanned-PDF path is behaviour-identical. Verified: build (tsc+vite) green; the band/stitch logic was replayed in Node with the same vendored Tesseract build on a synthetic 1000×6160 card (120 lines, small 27px print, scale 2, 10 bands) — merged result: exactly 120/120 lines, no duplicates, last line present. Lines sliced by a band edge are skipped and read whole by the next band (overlap 220 scaled px ≫ line height). Note the desktop engine read even 1080×10120 single-pass — the banding defends the phone's smaller real print and canvas limits, it is not claimed the desktop ever cut.
- Shared-card honesty (image.ts): a trailing "…"/"..." cut mark and the "from … app" footer are detected after OCR; the footer and the mark are stripped, the book still imports with what arrived, and BookMeta.warn carries the explanation; importMany toasts it for 9s ("This shared image arrived cut off… For the whole message, copy it and use Paste in Listen."). RawBook.warn → finishBook → BookMeta.warn.
- Web-only; no shell change. Oscar's final proof on device: share a long Muse message (expect the cut-off warning) and a full tall scrolling screenshot (expect the complete text).
