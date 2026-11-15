/**
 * The sealed scenario store (PLAN §0.2, FENCE-DESIGN §1).
 *
 * One instance = one empty, fictional Logos. Lessons operate it through the
 * adapters and stage operations below, which mirror the app's real verbs —
 * the bubble's clipboard replace with its Undo and its return-to-interrupted
 * (lib/bubble.ts), the Library's delete/restore (lib/library.ts), the books'
 * import/bookmark/delete/restore (lib/books.ts) — but every write lands in
 * the scenario's own backends (backends.ts) and nowhere else.
 *
 * The sealing is by construction, and it is total:
 *  - this module (and the whole scenario/ folder) imports only its siblings;
 *  - it names no storage global, no bridge object and no DOM — there is no
 *    code path here that could reach a real backend, even by accident;
 *  - the single outward capability a host may inject is the LambdaPort: one
 *    boolean, the λ switch itself, which PLAN §0.2/OQ-1 names as the one real
 *    thing a lesson touches (it is the user's switch and holds no data).
 *    Fence 0 injects a port wired to the real settings seam and tallies it
 *    as exception E-λ; with no port injected, the toggle lands on the
 *    scenario's own settings copy and nothing real is touched at all.
 */
import { ScenarioDbHost, ScenarioKv, SCENARIO_BOOKS_DB, SCENARIO_DB } from './backends.ts'
import {
  BOOK_CONTENT,
  BOOK_META,
  CLIP_TEXT,
  FICTION_CLIPS,
  FICTION_IDS,
  FICTION_MARK,
  FICTION_PRONOUNCE,
  SCENARIO_TEXTS,
} from './fiction.ts'
import type { RealDataReader } from './realview.ts'
import { SCENARIO_PREFIX, type ScenarioBookContent, type ScenarioBookMeta, type ScenarioClip, type ScenarioMark, type ScenarioPronEntry, type ScenarioResumeCard, type ScenarioSession, type ScenarioSettings, type ScenarioText } from './types.ts'

/** The λ port: the scenario's only door out of the sandbox, and it can only
 *  flip one boolean. Implemented by the host (the engine in the app, the
 *  guarded harness in Fence 0). */
export interface LambdaPort {
  getBubbleOn(): boolean
  setBubbleOn(on: boolean): void
}

export type ScenarioOptions = {
  lambdaPort?: LambdaPort
  /** Optional read-only view of the real side (realview.ts). The scenario
   *  consults it only to prove it is not borrowing real material. */
  real?: RealDataReader
}

const DEFAULT_SETTINGS: ScenarioSettings = {
  uiLang: 'en',
  listenSpeed: 1,
  bubbleOn: false,
  bubbleAuto: true,
  bubbleText: true,
}

/** Fingerprint shape shared with the app (lib/marks.ts textKey, lib/bubble.ts
 *  clipKey): length + first 48 + last 48. */
const textKey = (t: string) => `${t.length}:${t.slice(0, 48)}:${t.slice(-48)}`

const sentencesOf = (text: string): string[] =>
  text
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)

export type Scenario = ReturnType<typeof createScenario>

export function createScenario(options: ScenarioOptions = {}) {
  const kv = new ScenarioKv()
  const dbs = new ScenarioDbHost()
  const lambdaPort = options.lambdaPort
  const real = options.real

  let session: ScenarioSession | null = null
  let stageKey = ''
  let resumeCard: ScenarioResumeCard | null = null
  let pendingUndo: { prevText: string } | null = null
  /** Sentences "rendered" for the current stage text — the scenario's own
   *  render namespace (FENCE-DESIGN §1.4/§1.6): playback renders here, never
   *  into any shared cache. */
  let rendered = new Set<number>()
  let tornDown = false
  let tick = 0
  const now = () => 1762901000000 + tick++ * 1000
  let savedClipSeq = 0
  let madeMarkSeq = 0
  const createdIds = new Set<string>()

  // ── kv-backed state ──────────────────────────────────────────────────────
  const readJson = <T>(key: string, fallback: T): T => {
    const raw = kv.get(key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }
  const writeJson = (key: string, value: unknown) => kv.set(key, JSON.stringify(value))

  const getSettings = (): ScenarioSettings => readJson('settings', DEFAULT_SETTINGS)
  const patchSettings = (patch: Partial<ScenarioSettings>) =>
    writeJson('settings', { ...getSettings(), ...patch })

  const getDrafts = (): { listen: string; create: string } => readJson('drafts', { listen: '', create: '' })
  const setDraft = (which: 'listen' | 'create', text: string) =>
    writeJson('drafts', { ...getDrafts(), [which]: text })

  const listMarks = (): ScenarioMark[] => readJson<ScenarioMark[]>('marks', [])
  const listPronounce = (): ScenarioPronEntry[] => readJson<ScenarioPronEntry[]>('pronounce', [])

  const saveResumeCard = () => {
    if (resumeCard) writeJson('bubble.resume', resumeCard)
    else kv.remove('bubble.resume')
  }

  // ── seed the fiction (PLAN §2 material only) ─────────────────────────────
  writeJson('settings', DEFAULT_SETTINGS)
  writeJson('drafts', { listen: '', create: '' })
  writeJson('marks', [FICTION_MARK])
  writeJson('pronounce', [...FICTION_PRONOUNCE])
  writeJson('kept', {})
  kv.set('shelf', 'saved')
  for (const clip of FICTION_CLIPS) void dbs.put(SCENARIO_DB, 'clips', { ...clip })

  // ── the stage ────────────────────────────────────────────────────────────
  const loadOnStage = (textId: string | null, text: string, title: string) => {
    session = { textId, text, title, idx: 0, playing: true, finished: false }
    rendered = new Set([0])
  }

  const retireCardIfOtherText = (text: string) => {
    // Mirrors bubble.ts's watcher: loading anything else by hand retires the
    // return-to-interrupted card.
    if (stageKey && textKey(text) !== stageKey) {
      stageKey = ''
      resumeCard = null
      saveResumeCard()
    }
  }

  const stage = {
    session: (): ScenarioSession | null => (session ? { ...session } : null),
    renderedCount: () => rendered.size,
    sentenceCount: () => (session ? sentencesOf(session.text).length : 0),

    /** Load a fiction text and play it (the lesson's own Listen). */
    playText(textId: string): ScenarioText {
      const found = SCENARIO_TEXTS.find((t) => t.id === textId)
      if (!found) throw new Error(`scenario: unknown fiction text ${textId}`)
      retireCardIfOtherText(found.text)
      setDraft('listen', found.text)
      loadOnStage(found.id, found.text, found.title)
      return found
    },

    /** Play a scenario Library clip's text. */
    async playClip(clipId: string): Promise<ScenarioClip> {
      const clip = await dbs.get<ScenarioClip>(SCENARIO_DB, 'clips', clipId)
      if (!clip) throw new Error(`scenario: unknown clip ${clipId}`)
      retireCardIfOtherText(clip.text)
      setDraft('listen', clip.text)
      loadOnStage(clip.id, clip.text, clip.title)
      return clip
    },

    /** Move the playhead one sentence forward. */
    advance(): void {
      if (!session || session.finished) return
      const last = Math.max(0, sentencesOf(session.text).length - 1)
      session.idx = Math.min(last, session.idx + 1)
      rendered.add(session.idx)
    },

    /**
     * The bubble's lever (mirrors playClipboardText in lib/bubble.ts): a
     * copied text takes the stage and REPLACES what was playing. The
     * interrupted reading leaves a resume card behind; the previous draft is
     * restorable through Undo. All of it lands in scenario backends — the
     * resume card in the scenario kv, never in the real bubble resume store.
     */
    playClipboardText(raw: string): { undoAvailable: boolean } {
      const text = raw.trim()
      if (!text) return { undoAvailable: false }
      if (session && session.playing && textKey(session.text) !== textKey(text) && textKey(session.text) !== stageKey) {
        resumeCard = { text: session.text, idx: session.idx, title: session.title }
        saveResumeCard()
      }
      stageKey = textKey(text)
      kv.set('bubble.lastClip', stageKey)
      const prevText = getDrafts().listen
      setDraft('listen', text)
      loadOnStage(CLIP_TEXT.id, text, CLIP_TEXT.title)
      pendingUndo = prevText.trim() && prevText.trim() !== text ? { prevText } : null
      return { undoAvailable: pendingUndo !== null }
    },

    /**
     * Undo the replace. Mirrors the real Undo in bubble.ts exactly: it
     * restores the previous draft and loads it — the real code contains no
     * play() call on this path (PLAN §2.6 bench item 1), so the scenario
     * loads the text paused rather than promising a resumed sound.
     */
    undoReplace(): boolean {
      if (!pendingUndo) return false
      const { prevText } = pendingUndo
      pendingUndo = null
      setDraft('listen', prevText)
      retireCardIfOtherText(prevText)
      const found = SCENARIO_TEXTS.find((t) => t.text === prevText)
      loadOnStage(found ? found.id : null, prevText, found ? found.title : '')
      if (session) session.playing = false
      return true
    },

    /**
     * The copied text ends: what it interrupted resumes itself, from the
     * sentence it was on (mirrors bubble.ts's return-to-interrupted watcher).
     */
    finishCurrent(): { resumed: boolean } {
      if (!session) return { resumed: false }
      session.playing = false
      session.finished = true
      if (stageKey && textKey(session.text) === stageKey && resumeCard) {
        const card = resumeCard
        stageKey = ''
        resumeCard = null
        saveResumeCard()
        const found = SCENARIO_TEXTS.find((t) => t.text === card.text)
        loadOnStage(found ? found.id : null, card.text, card.title)
        if (session) {
          session.idx = Math.min(card.idx, Math.max(0, sentencesOf(card.text).length - 1))
          session.playing = true
        }
        return { resumed: true }
      }
      return { resumed: false }
    },

    /** ⚑ — drop a mark on the moment being heard (scenario marks only). */
    markHere(): ScenarioMark | null {
      if (!session) return null
      const sents = sentencesOf(session.text)
      const mark: ScenarioMark = {
        id: `${SCENARIO_PREFIX}mark-made-${++madeMarkSeq}`,
        at: now(),
        title: session.title,
        sentence: sents[session.idx] ?? '',
        key: textKey(session.text),
        idx: session.idx,
      }
      createdIds.add(mark.id)
      writeJson('marks', [mark, ...listMarks()])
      return mark
    },

    /** Save what's playing to the scenario Library (the panel's save key). */
    async saveCurrentToLibrary(): Promise<ScenarioClip | null> {
      if (!session) return null
      const clip: ScenarioClip = {
        id: `${SCENARIO_PREFIX}clip-saved-${++savedClipSeq}`,
        title: session.title,
        text: session.text,
        voice: 'scenario-voice-en',
        lang: 'en',
        createdAt: now(),
        duration: Math.max(1, Math.round(session.text.split(/\s+/).length / 2.5)),
        format: 'mp3',
        size: 40960,
        kind: 'audio',
        pos: 0,
      }
      createdIds.add(clip.id)
      await dbs.put(SCENARIO_DB, 'clips', clip)
      return clip
    },

    /** «Listen later»: the same session, kept as TEXT (integration
     *  amendment, 1.4.166 — the keep sheet's second door; Q4's
     *  text-to-audio beats stand on the item this creates). */
    async saveCurrentAsText(): Promise<ScenarioClip | null> {
      if (!session) return null
      const clip: ScenarioClip = {
        id: `${SCENARIO_PREFIX}clip-saved-text-${++savedClipSeq}`,
        title: session.title,
        text: session.text,
        voice: '',
        lang: 'en',
        createdAt: now(),
        duration: Math.max(1, Math.round(session.text.split(/\s+/).length / 2.5)),
        format: '',
        size: 0,
        kind: 'text',
        pos: 0,
      }
      createdIds.add(clip.id)
      await dbs.put(SCENARIO_DB, 'clips', clip)
      return clip
    },

    /** Play the fiction book from its saved place (integration
     *  amendment, 1.4.166 — Continue's book door, AD9's bridge:
     *  after this, the stage holds a session and Listen's head can
     *  offer «Back to book»). */
    async playBook(bookId: string): Promise<ScenarioBookMeta> {
      const meta = await books.getBook(bookId)
      const content = await books.getContent(bookId)
      if (!meta || !content) throw new Error(`scenario: unknown book ${bookId}`)
      const ch = content.chapters[Math.min(meta.pos.ch, content.chapters.length - 1)]
      const text = ch.blocks.filter((b) => b.k === 'p').map((b) => b.t).join('\n\n')
      retireCardIfOtherText(text)
      setDraft('listen', text)
      loadOnStage(meta.id, text, meta.title)
      return meta
    },

    /**
     * Tap the λ. The one real touch a lesson is allowed (PLAN §0.2, OQ-1):
     * with a LambdaPort injected, the flip goes to the user's own switch
     * through the port — and nowhere else; without one, it lands on the
     * scenario's settings copy. Either way the scenario's copy tracks it so
     * the stage can show the gold dot.
     */
    setLambda(on: boolean): void {
      if (lambdaPort) lambdaPort.setBubbleOn(on)
      patchSettings({ bubbleOn: on })
    },
    lambdaOn(): boolean {
      return lambdaPort ? lambdaPort.getBubbleOn() : getSettings().bubbleOn
    },
  }

  // ── the scenario Library (mirrors lib/library.ts verbs) ─────────────────
  const library = {
    async listClips(): Promise<ScenarioClip[]> {
      const all = await dbs.getAll<ScenarioClip>(SCENARIO_DB, 'clips')
      return all.sort((a, b) => b.createdAt - a.createdAt)
    },
    async getClip(id: string): Promise<ScenarioClip | null> {
      return dbs.get<ScenarioClip>(SCENARIO_DB, 'clips', id)
    },
    async saveClip(clip: ScenarioClip): Promise<void> {
      if (clip.id.startsWith(SCENARIO_PREFIX) && !FICTION_IDS.includes(clip.id)) createdIds.add(clip.id)
      await dbs.put(SCENARIO_DB, 'clips', clip)
    },
    /** Delete returns the record, exactly as the real Undo path needs it. */
    async deleteClip(id: string): Promise<ScenarioClip | null> {
      const gone = await dbs.get<ScenarioClip>(SCENARIO_DB, 'clips', id)
      if (gone) await dbs.delete(SCENARIO_DB, 'clips', id)
      return gone
    },
    async restoreClip(clip: ScenarioClip): Promise<void> {
      await dbs.put(SCENARIO_DB, 'clips', clip)
    },
    /** Bulk delete (AD6's mass verb): returns every record it removed. */
    async deleteClips(ids: string[]): Promise<ScenarioClip[]> {
      const gone: ScenarioClip[] = []
      for (const id of ids) {
        const clip = await library.deleteClip(id)
        if (clip) gone.push(clip)
      }
      return gone
    },
  }

  // ── the scenario bookshelf (mirrors lib/books.ts verbs) ─────────────────
  const books = {
    /** Import the fiction mini-book (or any scenario-shaped book). */
    async importBook(meta: ScenarioBookMeta, content: ScenarioBookContent): Promise<ScenarioBookMeta> {
      await dbs.put(SCENARIO_BOOKS_DB, 'content', content)
      await dbs.put(SCENARIO_BOOKS_DB, 'books', meta)
      return meta
    },
    async listBooks(): Promise<ScenarioBookMeta[]> {
      return dbs.getAll<ScenarioBookMeta>(SCENARIO_BOOKS_DB, 'books')
    },
    async getBook(id: string): Promise<ScenarioBookMeta | null> {
      return dbs.get<ScenarioBookMeta>(SCENARIO_BOOKS_DB, 'books', id)
    },
    async getContent(id: string): Promise<ScenarioBookContent | null> {
      return dbs.get<ScenarioBookContent>(SCENARIO_BOOKS_DB, 'content', id)
    },
    /** Open the book at a place — opening is also position-keeping. */
    async openBook(id: string, pos: { ch: number; b: number }): Promise<ScenarioBookMeta | null> {
      const meta = await books.getBook(id)
      if (!meta) return null
      const next = { ...meta, pos, openedAt: now() }
      await dbs.put(SCENARIO_BOOKS_DB, 'books', next)
      return next
    },
    async addBookmark(id: string, bm: { ch: number; b: number; text: string }): Promise<ScenarioBookMeta | null> {
      const meta = await books.getBook(id)
      if (!meta) return null
      const next = { ...meta, bookmarks: [...(meta.bookmarks ?? []), { ...bm, at: now() }] }
      await dbs.put(SCENARIO_BOOKS_DB, 'books', next)
      return next
    },
    /** Delete returns meta + content together, as the real Undo needs both. */
    async deleteBook(id: string): Promise<{ meta: ScenarioBookMeta; content: ScenarioBookContent } | null> {
      const meta = await books.getBook(id)
      const content = await books.getContent(id)
      if (!meta || !content) return null
      await dbs.delete(SCENARIO_BOOKS_DB, 'books', id)
      await dbs.delete(SCENARIO_BOOKS_DB, 'content', id)
      return { meta, content }
    },
    async restoreBook(meta: ScenarioBookMeta, content: ScenarioBookContent): Promise<void> {
      await dbs.put(SCENARIO_BOOKS_DB, 'content', content)
      await dbs.put(SCENARIO_BOOKS_DB, 'books', meta)
    },
  }

  // ── pronunciation (scenario dictionary only) ─────────────────────────────
  const pronounce = {
    list: listPronounce,
    add(entry: ScenarioPronEntry): void {
      writeJson('pronounce', [...listPronounce(), entry])
    },
  }

  // ── proof surface for the fences ─────────────────────────────────────────
  /** Every record id currently held, across every scenario backend. */
  const allIds = async (): Promise<string[]> => {
    const ids: string[] = []
    for (const c of await library.listClips()) ids.push(c.id)
    for (const b of await books.listBooks()) ids.push(b.id)
    for (const m of listMarks()) ids.push(m.id)
    return ids.sort()
  }

  /**
   * The stage-is-fiction check (FENCE-DESIGN §1.4): everything the scenario
   * holds is either PLAN §2 fiction or an id a script created from it, and
   * no staged text is the user's real draft (checked against the read-only
   * reader, when one was handed in).
   */
  const fictionCheck = async (): Promise<{ ok: boolean; foreign: string[] }> => {
    const foreign: string[] = []
    for (const id of await allIds()) {
      if (!id.startsWith(SCENARIO_PREFIX)) foreign.push(id)
      else if (!FICTION_IDS.includes(id) && !createdIds.has(id)) foreign.push(id)
    }
    if (real) {
      const realIds = new Set([...real.clipIds(), ...real.bookIds(), ...real.markIds()])
      for (const id of await allIds()) if (realIds.has(id)) foreign.push(id)
      if (session && real.draftListen() && session.text === real.draftListen()) foreign.push('session==real-draft')
    }
    return { ok: foreign.length === 0, foreign }
  }

  /** Discard the scenario whole. The same path serves a finished module, a
   *  ✕ mid-scene and an abort (FENCE-DESIGN §7 clause 7). After teardown the
   *  backends are empty and the databases are dropped, not merely cleared. */
  const teardown = (): void => {
    session = null
    stageKey = ''
    resumeCard = null
    pendingUndo = null
    rendered = new Set()
    kv.clear()
    dbs.dropAll()
    tornDown = true
  }

  /** True when nothing of the scenario survives: kv empty, no records in any
   *  scenario database, no live session. (After a hard kill the harness drops
   *  the instance instead of calling this — the check then runs from the
   *  real side: no scenario trace in any real backend.) */
  const isGone = async (): Promise<boolean> => {
    if (session !== null || kv.size > 0) return false
    return dbs.isEmpty()
  }

  return {
    stage,
    library,
    books,
    pronounce,
    getSettings,
    patchSettings,
    getDrafts,
    setDraft,
    listMarks,
    allIds,
    fictionCheck,
    teardown,
    isGone,
    /** Fence introspection: backend occupancy, for "scenario gone" checks. */
    backendInfo: () => ({ kvSize: kv.size, databases: dbs.databaseNames(), tornDown }),
    /** The fiction book, for scripts that import it (P2). */
    fictionBook: { meta: BOOK_META, content: BOOK_CONTENT },
  }
}
