// The library's safety net (Oscar's ask, 2026-11-08): one file that carries
// the irreplaceable things — books with their content and progress, reading
// bookmarks, Listen marks, the pronunciation dictionary, drafts, settings,
// and the Library's clips (H-31 cure, 2026-11-15): listen-later text clips
// in full, and audio clips with their audio encoded in the file — a text
// clip's words and an imported file's audio exist ONLY as clips, so the
// old "they can always be re-made" rationale was false for both and the
// clips are inside now, as the "whole library in one file" promise says.
import { books, refreshBooks, getBook, getBookCover, getContent, putBook, deleteBook, type BookMeta, type BookContent } from './books.ts'
import { settings, saveLastText, clampSettingNumber, type Settings } from './settings.ts'
import { drafts } from './drafts.ts'
import { pronEntries, savePronEntries, isValidPronEntry, type PronEntry } from './pronounce.ts'
import { loadMarks, mergeMarks } from './marks.ts'
import { downloadBlob } from './audio.ts'
import { library, refreshLibrary, getClip, restoreClips, restoreClip, deleteClip, type Clip, type ClipMeta } from './library.ts'
import { VOICE_BY_ID } from './voices.ts'

type BackupFile = {
  app: 'logos'
  version: 1
  at: number
  settings: Record<string, unknown>
  pronounce: PronEntry[]
  marks: ReturnType<typeof loadMarks>
  drafts: { listen: string }
  books: { meta: BookMeta & { coverB64?: string }; content: unknown }[]
  /** Library clips; the audio rides as a data-URL in blobB64, the same
   *  shape book covers already use. Absent in backups made before H-31. */
  clips?: (ClipMeta & { blobB64?: string })[]
  /** Ids of books this device once had in a backup and has since
   *  deleted (M-27 cure, 2026-11-15): an import honours the record and
   *  never resurrects a book the user deliberately removed. Absent in
   *  backups made before this cure — those files behave exactly as
   *  they always did. */
  deletedBooks?: string[]
}

// ── The deletion record (M-27 cure, 2026-11-15) ─────────────────
// Import used to put back EVERY book in the file, so re-importing an
// older backup resurrected books the user had deliberately deleted
// after that backup was taken. There is no delete hook in books.ts
// this module may call, so the record is kept here, from the two
// moments this module sees the whole shelf: export and import.
//   · `known` — the book ids present at the last export or import
//     on this device. An id in `known` that is no longer on the
//     shelf was here, was backed up, and is gone: deleted since.
//   · `tombstones` — ids proven deleted on this device, carried
//     forward across exports and merged with any file's own
//     `deletedBooks` record, so an old file imported after a newer
//     export still cannot bring a deleted book back.
// New exports carry the record in the file; imports honour it when
// present. A file with no record, on a device with no record, behaves
// exactly as imports always have — stated plainly: the cure is
// forward-only, and a book lost by storage eviction rather than by
// the user's hand reads the same as a deletion to the `known`
// derivation (a restore on a fresh device or profile, where no
// record exists, still lands every book in the file).
const TOMB_KEY = 'logos.backup.tombstones.v1'
const KNOWN_KEY = 'logos.backup.known.v1'
function readIdList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  } catch { return [] }
}
function writeIdList(key: string, ids: string[]) {
  try { localStorage.setItem(key, JSON.stringify([...new Set(ids)])) } catch { /* storage blocked: the record is a safety net, never a gate */ }
}
/** Ids proven deleted on this device: recorded tombstones, plus any
 *  id the last export/import knew that the shelf no longer holds. */
function provenDeleted(currentIds: Set<string>): Set<string> {
  const gone = new Set(readIdList(TOMB_KEY))
  for (const id of readIdList(KNOWN_KEY)) if (!currentIds.has(id)) gone.add(id)
  for (const id of currentIds) gone.delete(id)
  return gone
}

const blobToB64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result))
  r.onerror = () => rej(new Error('cover read failed'))
  r.readAsDataURL(b)
})

/** What an export actually did (F8 cure): how many books are inside,
 *  and how many shelf books were LEFT OUT because their text record
 *  is missing on this phone. The Settings toast declares both — a
 *  backup that silently omits a book teaches the reader to trust a
 *  file that does not hold what they think it holds. */
export type ExportReport = { books: number; skipped: number }

export async function exportBackup(): Promise<ExportReport> {
  await refreshBooks()
  await refreshLibrary()
  // The deletion record rides in the file (M-27): what this device
  // has proven deleted since its last backup, minus anything alive.
  const currentIds = new Set(books.get().list.map((m) => m.id))
  const deleted = provenDeleted(currentIds)
  writeIdList(TOMB_KEY, [...deleted])
  writeIdList(KNOWN_KEY, [...currentIds])
  const out: BackupFile = {
    app: 'logos', version: 1, at: Date.now(),
    settings: { ...settings.get() },
    pronounce: pronEntries(),
    marks: loadMarks(),
    drafts: { listen: drafts.get().listen },
    books: [],
    clips: [],
    deletedBooks: [...deleted],
  }
  let skipped = 0
  for (const m of books.get().list) {
    const content = await getContent(m.id)
    // F8 cure: a book whose text record is gone cannot ride in the
    // file — but the skip is COUNTED and declared (see ExportReport),
    // never silent.
    if (!content) { skipped++; continue }
    const meta = { ...m } as BookMeta & { coverB64?: string }
    // The list's metas are cover-free since M-11 — the cover rides
    // only in the full record, so fetch it for this book alone.
    const cover = m.cover ?? (await getBookCover(m.id))
    if (cover) { try { meta.coverB64 = await blobToB64(cover) } catch { /* cover is decoration */ } }
    delete (meta as { cover?: Blob }).cover
    out.books.push({ meta, content })
  }
  // The clips (H-31): every Library item rides in the file — text
  // clips in full (their text is the only copy there is) and audio
  // clips with their blob encoded, imported audio included (its blob
  // is the app's only copy of a file the user brought in).
  for (const m of library.get().clips) {
    const full = await getClip(m.id)
    if (!full) continue
    const { blob, ...meta } = full
    const entry = { ...meta } as ClipMeta & { blobB64?: string }
    if (blob) { try { entry.blobB64 = await blobToB64(blob) } catch { continue } }
    out.clips!.push(entry)
  }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' })
  const name = `logos-backup-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([blob], name, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Logos backup' }); return { books: out.books.length, skipped } } catch { /* cancelled */ }
  }
  downloadBlob(blob, name, true)
  return { books: out.books.length, skipped }
}

/**
 * The settings a backup file may restore (H-5 cure, 2026-11-15): the
 * export always carried settings but the import never read them.
 * A backup file is not trusted blindly — this mirrors load()'s
 * sanitisation in settings.ts: known fields land sanitised, enum
 * fields must match their whitelists, numbers must be finite AND
 * inside the envelope their own UI can produce (R2-T5-6, through
 * settings.ts's one clamp table), booleans must be booleans, and
 * defaultVoice merges over the current voices so a partial block
 * can never hollow it out. Two fields carry more than sanitisation:
 * favorites can never land EMPTY (R2-T5-4) — a list that filters to
 * nothing, ghosts or an explicit empty alike, is withheld whole and
 * reported, where every other field's filter fails safe; and fields
 * this version does not know are carried through VERBATIM (R2-T5-5),
 * the same honesty load()'s spread keeps across restarts — the
 * export writes the whole object, future fields included, and the
 * trip to a new phone is the one journey the backup exists for.
 */
const SETTINGS_KNOWN_KEYS = new Set([
  'theme', 'lastLegacy', 'uiLang', 'langMode', 'format',
  'autoDownload', 'deviceFallback', 'bubbleOn', 'bubbleAuto', 'bubbleText', 'bubbleFade', 'highlight',
  'listenSpeed', 'exportSpeed', 'sentencePauseMs', 'bubbleAlpha', 'panelAlpha', 'wordLeadMs', 'readerScale', 'jumpBackSec', 'jumpFwdSec',
  'bubbleSize', 'voiceOverride', 'favorites', 'defaultVoice',
])
function settingsPatch(raw: unknown): { patch: Partial<Settings>; favoritesWithheld: boolean } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { patch: {}, favoritesWithheld: false }
  const r = raw as Record<string, unknown>
  const patch: Partial<Settings> = {}
  if (r.theme === 'dark' || r.theme === 'light' || r.theme === 'system' || r.theme === 'tron' || r.theme === 'cyberpunk') patch.theme = r.theme
  if (r.lastLegacy === 'dark' || r.lastLegacy === 'light' || r.lastLegacy === 'system') patch.lastLegacy = r.lastLegacy
  if (r.uiLang === 'en' || r.uiLang === 'es') patch.uiLang = r.uiLang
  if (r.langMode === 'en' || r.langMode === 'es' || r.langMode === 'auto') patch.langMode = r.langMode
  if (r.format === 'mp3' || r.format === 'wav') patch.format = r.format
  for (const k of ['autoDownload', 'deviceFallback', 'bubbleOn', 'bubbleAuto', 'bubbleText', 'bubbleFade', 'highlight'] as const) {
    if (typeof r[k] === 'boolean') patch[k] = r[k] as boolean
  }
  for (const k of ['listenSpeed', 'exportSpeed', 'sentencePauseMs', 'bubbleAlpha', 'panelAlpha', 'wordLeadMs', 'readerScale', 'jumpBackSec', 'jumpFwdSec'] as const) {
    if (typeof r[k] === 'number' && Number.isFinite(r[k])) patch[k] = clampSettingNumber(k, r[k] as number)
  }
  // Whitelisted like load() (M-28 residue): the sanitiser used to
  // admit any string here, a value the load path would then repair —
  // writer and reader disagreed on what a legal bubbleSize is.
  if (r.bubbleSize === 's' || r.bubbleSize === 'm' || r.bubbleSize === 'l') patch.bubbleSize = r.bubbleSize
  // Voice ids must EXIST, not just be strings (H-29, same gate as the
  // settings cleanup): a backup made by a version whose catalogue had
  // a since-removed voice must not plant that ghost as the live
  // default/override/favorite until the next launch's cleanup.
  if (r.voiceOverride === null) patch.voiceOverride = null
  else if (typeof r.voiceOverride === 'string' && VOICE_BY_ID.has(r.voiceOverride)) patch.voiceOverride = r.voiceOverride
  // The one filter that could DESTROY local state (cure R2-T5-4):
  // every other field's rejection leaves the phone's value standing,
  // but a favorites list that filters to empty — all ghosts, the
  // cross-version case H-29 built the existence gate for — used to
  // replace the phone's real stars with [], in-session and persisted,
  // and no later load repaired it ([] is a valid array; load()'s own
  // floor fires only when filtering CHANGES the list). A patch whose
  // favorites end up empty never lands: the phone keeps its stars,
  // and the withholding is reported, not silent.
  let favoritesWithheld = false
  if (Array.isArray(r.favorites)) {
    const kept = r.favorites.filter((f): f is string => typeof f === 'string' && VOICE_BY_ID.has(f))
    if (kept.length) patch.favorites = kept
    else favoritesWithheld = true
  }
  if (r.defaultVoice && typeof r.defaultVoice === 'object' && !Array.isArray(r.defaultVoice)) {
    const dv = r.defaultVoice as Record<string, unknown>
    const merged = { ...settings.get().defaultVoice } as Record<string, unknown>
    if (typeof dv.en === 'string' && VOICE_BY_ID.has(dv.en)) merged.en = dv.en
    if (typeof dv.es === 'string' && VOICE_BY_ID.has(dv.es)) merged.es = dv.es
    // A newer version's extra voice slots ride through verbatim
    // (R2-T5-5) — the rebuild used to drop every key but en/es.
    for (const k of Object.keys(dv)) if (k !== 'en' && k !== 'es') merged[k] = dv[k]
    patch.defaultVoice = merged as Settings['defaultVoice']
  }
  // Unknown top-level fields ride through verbatim (R2-T5-5): what
  // load() preserves across every restart must also survive the trip
  // the backup exists for.
  for (const k of Object.keys(r)) {
    if (!SETTINGS_KNOWN_KEYS.has(k)) (patch as Record<string, unknown>)[k] = r[k]
  }
  return { patch, favoritesWithheld }
}

/** An import failure with its true reason, fit to show the user.
 *  The Settings page toasts this message as-is; anything that is not
 *  a BackupImportError keeps the old generic line. */
export class BackupImportError extends Error {}

/** What an import actually did — every stage reports, none is silent
 *  (F7 cure, 2026-11-16). The Settings page turns the kept counts
 *  into the toast, so a merge decision the user did not watch happen
 *  is still a merge decision they are told about. */
export type ImportReport = {
  /** Books the backup put on the shelf: brand-new ones, plus same-id
   *  books whose backup progress was strictly further along. */
  books: number
  /** Same-id books kept exactly as this phone has them, because the
   *  phone's progress was at least as far along (their bookmarks
   *  still merged in — the union below never loses one). */
  keptNewer: number
  pronAdded: number
  /** Backup pronunciations that did NOT land because the word already
   *  has a different reading on this phone — the phone's reading
   *  wins, and this count is how the refusal stops being silent. */
  pronKept: number
  /** 'landed' — the backup's Listen draft is the draft now (the phone
   *  had none); 'kept' — the phone already had a draft, so its text
   *  stayed and the backup's did not replace it; 'none' — the file
   *  carried no draft, or the same one. */
  draft: 'landed' | 'kept' | 'none'
  /** Marks that actually landed — merged by id under the standing
   *  cap, measured around the merge, not the file's raw count
   *  (cure R2-T5-3: the count used to be the file's, so marks the
   *  cap or the dedupe turned away were still announced as in). */
  marks: number
  /** Library clips written: new ones whole, existing ones only when
   *  the backup supplied a blob the local copy was missing (H-31). */
  clips: number
  /** Books the file carried that the deletion record suppressed —
   *  deliberately deleted on this phone (or recorded deleted in the
   *  file itself), so the import left them out ON PURPOSE and says
   *  how many (cure R2-T5-3: the skip used to be counted nowhere,
   *  and a reader re-importing an old backup to fetch a deleted
   *  book back was told only the restored count). */
  skippedDeleted: number
  /** The backup's favorites were withheld whole because they would
   *  have landed empty (every entry a ghost, or the list itself
   *  empty): the phone kept its own stars (cure R2-T5-4). */
  favoritesKept: boolean
}

// ── Whole-file validation (F6 cure, 2026-11-16) ─────────────────
// Import used to check two fields and then write book after book:
// a malformed entry aborted the restore halfway, the books before
// it stayed restored, everything after it never ran, and the page
// told the user the file was "not a Logos backup" — for a file that
// was one, and was now half inside the library. Now the WHOLE file
// is proven before a single write: version, every book's meta and
// content shape, every pronunciation, mark and clip — each exactly
// as deep as its consumers dereference (the draft, the settings
// block and the deletion record are tolerated as their consumers
// tolerate them, R2-T5-7). A malformed file fails at
// the door with the true reason and zero writes. What validation
// cannot foresee (a storage failure mid-restore) is covered by the
// staged apply below: every write carries its before-image, and a
// failure rolls the library back to exactly what it was.
const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
function damaged(reason: string): never {
  throw new BackupImportError(`This backup is damaged — ${reason}. Nothing was restored.`)
}

type ValidBackup = {
  books: { meta: BookMeta & { coverB64?: string }; content: BookContent }[]
  pronounce: PronEntry[]
  marks: ReturnType<typeof loadMarks>
  draftListen: string | null
  clips: (ClipMeta & { blobB64?: string })[]
  settingsRaw: unknown
  deletedBooks: string[]
}

const BOOK_KINDS = ['h1', 'h2', 'h3', 'p', 'q', 'li', 'pre']
function validateBook(raw: unknown, i: number): ValidBackup['books'][number] {
  const at = `book ${i + 1}`
  if (!isObj(raw)) damaged(`${at} is not a book entry`)
  const meta = raw.meta
  if (!isObj(meta)) damaged(`${at} has no details`)
  const label = typeof meta.title === 'string' && meta.title ? ` (“${meta.title}”)` : ''
  if (typeof meta.id !== 'string' || !meta.id) damaged(`${at}${label} has no id`)
  if (typeof meta.title !== 'string') damaged(`${at} has no title`)
  if (typeof meta.format !== 'string' || typeof meta.lang !== 'string') damaged(`${at}${label} is missing its format or language`)
  if (!isNum(meta.addedAt) || !isNum(meta.progress) || !isNum(meta.words) || !isNum(meta.links) || !isNum(meta.size)) damaged(`${at}${label} has unreadable numbers in its details`)
  if (!isObj(meta.pos) || !isNum(meta.pos.ch) || !isNum(meta.pos.b)) damaged(`${at}${label} has no reading place`)
  if (!Array.isArray(meta.chWords) || !meta.chWords.every(isNum)) damaged(`${at}${label} has an unreadable chapter map`)
  if (!Array.isArray(meta.toc) || !meta.toc.every(isObj)) damaged(`${at}${label} has an unreadable contents list`)
  if (meta.openedAt !== undefined && !isNum(meta.openedAt)) damaged(`${at}${label} has an unreadable last-opened time`)
  if (meta.pages !== undefined && !isNum(meta.pages)) damaged(`${at}${label} has an unreadable page count`)
  for (const k of ['fav', 'done', 'temp'] as const) if (meta[k] !== undefined && typeof meta[k] !== 'boolean') damaged(`${at}${label} has an unreadable ${k} flag`)
  if (meta.warn !== undefined && typeof meta.warn !== 'string') damaged(`${at}${label} has an unreadable warning`)
  if (meta.coverB64 !== undefined && typeof meta.coverB64 !== 'string') damaged(`${at}${label} has an unreadable cover`)
  if (meta.bookmarks !== undefined) {
    if (!Array.isArray(meta.bookmarks) || !meta.bookmarks.every((m) => isObj(m) && isNum(m.ch) && isNum(m.b) && isNum(m.at) && typeof m.text === 'string')) damaged(`${at}${label} has an unreadable bookmark`)
  }
  const content = raw.content
  if (!isObj(content)) damaged(`${at}${label} is missing its text`)
  if (content.id !== meta.id) damaged(`${at}${label} — its text belongs to a different book`)
  if (!Array.isArray(content.chapters) || !content.chapters.length) damaged(`${at}${label} has no chapters`)
  for (const ch of content.chapters) {
    if (!isObj(ch) || typeof ch.title !== 'string' || !Array.isArray(ch.blocks)) damaged(`${at}${label} has a chapter with no text`)
    for (const b of ch.blocks as unknown[]) {
      if (!isObj(b) || typeof b.k !== 'string' || !BOOK_KINDS.includes(b.k) || typeof b.t !== 'string') damaged(`${at}${label} has a passage that is not text`)
    }
  }
  return { meta: meta as BookMeta & { coverB64?: string }, content: content as unknown as BookContent }
}

const CLIP_KINDS = ['audio', 'text']
const CLIP_SOURCES = ['listen', 'create', 'import']
function validateClip(raw: unknown, i: number): ValidBackup['clips'][number] {
  const at = `Library item ${i + 1}`
  if (!isObj(raw)) damaged(`${at} is not a Library entry`)
  const label = typeof raw.title === 'string' && raw.title ? ` (“${raw.title}”)` : ''
  if (typeof raw.id !== 'string' || !raw.id) damaged(`${at}${label} has no id`)
  if (typeof raw.title !== 'string') damaged(`${at} has no title`)
  // The Library renders a text clip's word count from its text and
  // searches every clip's text; the player and the audio maker read
  // it too. A clip whose text is missing or not a string restores
  // "successfully" and then throws in the Library's render — the
  // poison this whole-file proof exists to keep out (R2-T5-2 cure,
  // 2026-11-17: the clips stage used to check three fields of a
  // seventeen-field record while the books stage checks twenty).
  // Clips are now proven the way books are: every field their
  // consumers dereference, typed as the Clip record declares it.
  if (typeof raw.text !== 'string') damaged(`${at}${label} has no words — its text is missing or unreadable`)
  if (typeof raw.voice !== 'string' || typeof raw.lang !== 'string' || typeof raw.format !== 'string') damaged(`${at}${label} is missing its voice, language or format`)
  if (!isNum(raw.createdAt) || !isNum(raw.duration) || !isNum(raw.size)) damaged(`${at}${label} has unreadable numbers in its details`)
  if (raw.kind !== undefined && (typeof raw.kind !== 'string' || !CLIP_KINDS.includes(raw.kind))) damaged(`${at}${label} has an unreadable kind`)
  if (raw.source !== undefined && (typeof raw.source !== 'string' || !CLIP_SOURCES.includes(raw.source))) damaged(`${at}${label} has an unreadable source`)
  for (const k of ['summary', 'url', 'site'] as const) if (raw[k] !== undefined && typeof raw[k] !== 'string') damaged(`${at}${label} has an unreadable ${k}`)
  for (const k of ['fav', 'done', 'rendering'] as const) if (raw[k] !== undefined && typeof raw[k] !== 'boolean') damaged(`${at}${label} has an unreadable ${k} flag`)
  for (const k of ['pos', 'playedAt'] as const) if (raw[k] !== undefined && !isNum(raw[k])) damaged(`${at}${label} has an unreadable ${k}`)
  if (raw.blobB64 !== undefined && typeof raw.blobB64 !== 'string') damaged(`${at}${label} has unreadable audio`)
  return raw as ValidBackup['clips'][number]
}

function validateBackup(data: unknown): ValidBackup {
  if (!isObj(data) || data.app !== 'logos') throw new BackupImportError('That file is not a Logos backup.')
  if (isNum(data.version) && data.version > 1) {
    throw new BackupImportError(`This backup was made by a newer Logos (backup version ${data.version}) — update Logos, then import it again.`)
  }
  if (data.version !== 1) damaged('its version marker is missing or unreadable')
  if (!Array.isArray(data.books)) damaged('its book list is missing')
  const books = data.books.map((b, i) => validateBook(b, i))
  let pronounce: PronEntry[] = []
  if (data.pronounce !== undefined) {
    if (!Array.isArray(data.pronounce)) damaged('its pronunciation list is unreadable')
    data.pronounce.forEach((e, i) => { if (!isValidPronEntry(e)) damaged(`pronunciation entry ${i + 1} is incomplete — it needs both the word and how to say it`) })
    pronounce = data.pronounce as PronEntry[]
  }
  let marks: ValidBackup['marks'] = []
  if (data.marks !== undefined) {
    if (!Array.isArray(data.marks)) damaged('its marks list is unreadable')
    data.marks.forEach((m, i) => {
      if (!isObj(m) || typeof m.id !== 'string' || !m.id || !isNum(m.at) || !isNum(m.idx) || typeof m.title !== 'string' || typeof m.sentence !== 'string' || typeof m.key !== 'string') damaged(`mark ${i + 1} is incomplete`)
    })
    marks = data.marks as ValidBackup['marks']
  }
  // Three blocks are validated only as deep as their consumers
  // dereference (cure R2-T5-7): the draft stage reads drafts.listen
  // only when it is a string, settingsPatch opens by tolerating any
  // shape, and the deletion stage consults a Set by string book id,
  // so a non-string member can never match anything. A non-object
  // settings block, a non-object drafts block, or a mixed-type
  // deletion list used to veto the WHOLE restore — perfect books
  // included — over damage that is inert downstream. They are now
  // treated the way their consumers treat them: absent, or filtered
  // to the members that can act.
  let draftListen: string | null = null
  if (isObj(data.drafts) && typeof data.drafts.listen === 'string' && data.drafts.listen.trim()) draftListen = data.drafts.listen
  let clips: ValidBackup['clips'] = []
  if (data.clips !== undefined) {
    if (!Array.isArray(data.clips)) damaged('its Library list is unreadable')
    clips = data.clips.map((c, i) => validateClip(c, i))
  }
  let deletedBooks: string[] = []
  if (Array.isArray(data.deletedBooks)) deletedBooks = data.deletedBooks.filter((x): x is string => typeof x === 'string')
  return { books, pronounce, marks, draftListen, clips, settingsRaw: isObj(data.settings) ? data.settings : undefined, deletedBooks }
}

/** The merge for a book that lives on both shelves (F7 cure).
 *  THE MERGE RULE, stated once for the whole import: the backup
 *  fills what this phone is missing and never silently rewinds
 *  what this phone has. Progress is the one place "newer" can be
 *  known for a book, so the further-along record supplies the
 *  reading place, the progress and the text; a tie keeps the
 *  phone's. Bookmarks are always the union of both lists (by
 *  place, the later mark winning a tie of place), and a book
 *  finished or starred on either side stays finished/starred —
 *  the same lossless instinct marks.ts already merged by. */
function mergeBookMeta(local: BookMeta, incoming: BookMeta): { meta: BookMeta; winner: 'local' | 'backup' } {
  const winner = incoming.progress > local.progress ? 'backup' : 'local'
  const meta: BookMeta = { ...(winner === 'backup' ? incoming : local) }
  const byPlace = new Map<string, NonNullable<BookMeta['bookmarks']>[number]>()
  for (const m of [...(local.bookmarks ?? []), ...(incoming.bookmarks ?? [])]) {
    const k = `${m.ch}:${m.b}`
    const prev = byPlace.get(k)
    if (!prev || m.at >= prev.at) byPlace.set(k, m)
  }
  const bookmarks = [...byPlace.values()].sort((a, b) => a.at - b.at)
  if (bookmarks.length) meta.bookmarks = bookmarks
  else delete meta.bookmarks
  if (local.done || incoming.done) meta.done = true
  if (local.fav || incoming.fav) meta.fav = true
  // L-4 cure: temp survives the merge only if BOTH copies are still
  // "for now". A book kept on either shelf is a kept book; the merged
  // record must not walk back into the temp sweep wearing the other
  // copy's flag (the winner-takes-the-record rule above would happily
  // carry a backup's temp: true over a phone book that was kept).
  meta.temp = local.temp === true && incoming.temp === true
  return { meta, winner }
}

export async function importBackup(file: File): Promise<ImportReport> {
  let parsed: unknown
  try { parsed = JSON.parse(await file.text()) } catch { throw new BackupImportError('That file is not a Logos backup — Logos could not read it.') }
  // The whole file is proven HERE, before a single write (F6).
  const data = validateBackup(parsed)
  // The deletion record (M-27): this device's proven deletions, plus
  // any the file itself carries. A book on that record that is NOT
  // on the shelf now was deliberately deleted after its backup was
  // taken — the import leaves it deleted. A book already on the
  // shelf is alive, not deleted, and merges by the rule above.
  await refreshBooks()
  const shelf = new Map(books.get().list.map((m) => [m.id, m]))
  const shelfIds = new Set(shelf.keys())
  const gone = provenDeleted(shelfIds)
  for (const id of data.deletedBooks) if (!shelfIds.has(id)) gone.add(id)

  // ── Prepare: every fallible read and decode happens here, while
  // nothing has been written yet. Each planned write carries the
  // before-image the rollback would need.
  type BookWrite = { meta: BookMeta; content: BookContent | null; before: { meta: BookMeta; content: BookContent | null } | null }
  const bookWrites: BookWrite[] = []
  let restored = 0
  let keptNewer = 0
  let skippedDeleted = 0
  for (const b of data.books) {
    if (gone.has(b.meta.id)) { skippedDeleted++; continue }
    const meta = { ...b.meta } as BookMeta & { coverB64?: string }
    if (meta.coverB64) {
      try { meta.cover = await (await fetch(meta.coverB64)).blob() } catch { /* cover is decoration */ }
      delete meta.coverB64
    }
    const clean = meta as BookMeta
    const local = shelf.get(b.meta.id)
    // L-4 cure: a book that exists only in the backup lands KEPT. It
    // used to land with the backup's temp flag verbatim, so a book the
    // reader had deliberately fetched back walked straight into the
    // temp sweep and could be deleted again before it was ever opened
    // on this phone. A restore is a keeping by deed.
    if (!local) { bookWrites.push({ meta: { ...clean, temp: false }, content: b.content, before: null }); restored++; continue }
    // The merge and the rollback must work from the FULL local
    // record, never from the shelf list: since M-11 the list is the
    // blob-free bookmeta twin, so a `local` taken from it is
    // coverless by construction — a winner-'local' write then
    // overwrote the books record without its cover, and every
    // rollback "put back" the book minus its cover while claiming
    // the library was restored exactly as it was (R2-T3-3 cure,
    // 2026-11-17). getBook reads the real record, cover included;
    // the twin remains only as the fallback if the record vanished
    // between the refresh and this read.
    const localFull = (await getBook(local.id)) ?? local
    const localContent = await getContent(local.id)
    const { meta: merged, winner } = mergeBookMeta(localFull, clean)
    if (winner === 'backup') {
      bookWrites.push({ meta: merged, content: b.content, before: { meta: localFull, content: localContent } })
      restored++
    } else {
      keptNewer++
      // The phone's record stands. A write is owed only when the
      // bookmark union (or a done/fav the phone lacked) changed the
      // meta, or the phone's own text is missing and the backup's
      // rescues it — the progress itself is never rewritten.
      const grew = (merged.bookmarks?.length ?? 0) > (localFull.bookmarks?.length ?? 0) || merged.done !== localFull.done || merged.fav !== localFull.fav
      if (grew || !localContent) bookWrites.push({ meta: merged, content: localContent ?? b.content, before: { meta: localFull, content: localContent } })
    }
  }
  // Pronunciations (F7): the phone's reading of a word wins over the
  // backup's older one — but the keep is counted, and a word the
  // phone does not have lands whole, exactly as the restore promises.
  const prevPron = pronEntries()
  const haveTo = new Map(prevPron.map((e) => [e.from.toLowerCase(), e.to]))
  const pronAdd: PronEntry[] = []
  let pronKept = 0
  for (const e of data.pronounce) {
    const key = e.from.toLowerCase()
    const existing = haveTo.get(key)
    if (existing === undefined) { pronAdd.push(e); haveTo.set(key, e.to) }
    else if (existing !== e.to) pronKept++
  }
  // The Listen draft (F7): it lands when the phone has none — and
  // lands DURABLY this time (saveLastText, the same persistence the
  // Listen page itself uses; a bare drafts.set used to evaporate at
  // the next launch). When the phone already holds a draft, its text
  // stays — and the report says so instead of vetoing in silence.
  const prevDraft = drafts.get().listen
  const draftState: ImportReport['draft'] = data.draftListen === null || data.draftListen === prevDraft ? 'none' : prevDraft.trim() ? 'kept' : 'landed'
  // Clips (H-31): rebuilt as full clip records, blobs decoded back
  // from their data-URLs. Merging by id never clobbers local state:
  // a clip that already lives here keeps its local record (title,
  // progress, done…) exactly as it is — the backup may only fill in
  // a blob the local copy is missing. New clips land whole.
  type ClipWrite = { clip: Clip; before: Clip | null }
  const clipWrites: ClipWrite[] = []
  for (const raw of data.clips) {
    const { blobB64, ...meta } = raw
    let blob: Blob | undefined
    if (blobB64) { try { blob = await (await fetch(blobB64)).blob() } catch { /* audio lost, text/meta still land */ } }
    const existing = await getClip(raw.id)
    if (existing) {
      if (!existing.blob && blob) clipWrites.push({ clip: { ...existing, blob, size: blob.size }, before: existing })
      continue
    }
    clipWrites.push({ clip: { ...(meta as ClipMeta), ...(blob ? { blob, size: blob.size } : {}) } as Clip, before: null })
  }
  // Settings (H-5): sanitised field by field by settingsPatch, and
  // pushed through settings.set at apply time so the store, its
  // subscribers and persistence all update together.
  const { patch, favoritesWithheld } = settingsPatch(data.settingsRaw)
  const prevSettings = settings.get()
  // The marks count is measured around the merge, not read off the
  // file (R2-T5-3): the dedupe and the standing 120 cap can each
  // turn a file mark away, and the report tells what landed.
  const marksBefore = loadMarks().length

  // ── Apply: staged, with rollback. If any write fails here, every
  // write already made is undone from its before-image and the
  // error says the library was put back — a half-restored library
  // claiming success is the F6 disease, and it does not recur.
  const report: ImportReport = { books: restored, keptNewer, pronAdded: pronAdd.length, pronKept, draft: draftState, marks: 0, clips: clipWrites.length, skippedDeleted, favoritesKept: favoritesWithheld }
  const doneBooks: BookWrite[] = []
  const doneClips: ClipWrite[] = []
  let pronApplied = false
  let draftApplied = false
  let settingsApplied = false
  try {
    for (const w of bookWrites) { await putBook(w.meta, w.content); doneBooks.push(w) }
    for (const w of clipWrites) { await restoreClips([w.clip]); doneClips.push(w) }
    if (pronAdd.length) { savePronEntries([...prevPron, ...pronAdd]); pronApplied = true }
    if (draftState === 'landed' && data.draftListen !== null) { drafts.set({ listen: data.draftListen }); saveLastText(data.draftListen); draftApplied = true }
    if (Object.keys(patch).length) { settings.set(patch); settingsApplied = true }
    // Marks merge last: mergeMarks cannot throw (its reads and
    // writes are guarded inside marks.ts), so once it runs the
    // restore is complete.
    if (data.marks.length) mergeMarks(data.marks)
    report.marks = loadMarks().length - marksBefore
  } catch (e) {
    if (settingsApplied) { try { settings.set({ ...prevSettings }) } catch { /* rollback is best-effort */ } }
    if (draftApplied) { try { drafts.set({ listen: prevDraft }); saveLastText(prevDraft) } catch { /* best-effort */ } }
    if (pronApplied) { try { savePronEntries(prevPron) } catch { /* best-effort */ } }
    for (const w of [...doneClips].reverse()) { try { if (w.before) await restoreClip(w.before); else await deleteClip(w.clip.id) } catch { /* best-effort */ } }
    for (const w of [...doneBooks].reverse()) { try { if (w.before) await putBook(w.before.meta, w.before.content); else await deleteBook(w.meta.id, { force: true }) } catch { /* best-effort */ } }
    try { await refreshBooks() } catch { /* best-effort */ }
    throw new BackupImportError(`The restore stopped partway (${e instanceof Error ? e.message : 'a storage error'}) — your library was put back exactly as it was, and nothing was half-restored.`)
  }
  await refreshBooks()
  // File the record forward (M-27): tombstones keep every proven
  // deletion that is still deleted; `known` becomes the shelf as it
  // now stands, so the next import can tell deleted from new.
  const nowIds = new Set(books.get().list.map((m) => m.id))
  writeIdList(TOMB_KEY, [...gone].filter((id) => !nowIds.has(id)))
  writeIdList(KNOWN_KEY, [...nowIds])
  return report
}
