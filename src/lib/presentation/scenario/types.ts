/**
 * Scenario sandbox — shared types.
 *
 * The scenario is the sealed fiction a Presentation module runs on (PLAN §0.2,
 * FENCE-DESIGN §1): built material only, held in memory, gone when the module
 * ends. Every record the scenario creates carries an id with the `scenario:`
 * prefix, so fiction can never be mistaken for the user's data — and the leak
 * scan (leakscan.ts) can prove none of it rides a payload out.
 *
 * The shapes mirror the app's own records (Clip in lib/library.ts, BookMeta /
 * BookContent in lib/books.ts, LooseMark in lib/marks.ts, PronEntry in
 * lib/pronounce.ts) so lessons rehearse the real operations — but they are
 * declared here, in the sandbox, on purpose: this folder imports nothing from
 * the app's store modules, so no import path from scenario code to a real
 * persistence writer exists (see index.ts for the sealing construction).
 */

/** Every scenario-born id starts with this prefix. */
export const SCENARIO_PREFIX = 'scenario:'

export type ScenarioLang = 'en' | 'es'

/** A readable fiction text the lessons can play (PLAN §2). */
export type ScenarioText = {
  id: string
  lang: ScenarioLang
  title: string
  text: string
}

/** Mirror of the app's Clip (lib/library.ts), minus the audio Blob: scenario
 *  "audio" is a byte count, never a real render (FENCE-DESIGN §1.6). */
export type ScenarioClip = {
  id: string
  title: string
  text: string
  voice: string
  lang: string
  createdAt: number
  duration: number
  format: string
  size: number
  kind: 'audio' | 'text'
  fav?: boolean
  done?: boolean
  pos?: number
}

/** Mirror of the app's book block (lib/books.ts): a link inside a block
 *  points at "ch:b" — a place in the same book. */
export type ScenarioBlock = {
  k: 'h1' | 'h2' | 'h3' | 'p' | 'q' | 'li' | 'pre'
  t: string
  l?: { s: number; e: number; to: string }[]
}

export type ScenarioChapter = { title: string; blocks: ScenarioBlock[] }

/** Mirror of BookMeta (lib/books.ts), trimmed to what lessons touch. */
export type ScenarioBookMeta = {
  id: string
  title: string
  titleEs: string
  author: string
  format: string
  lang: string
  addedAt: number
  openedAt?: number
  pos: { ch: number; b: number }
  progress: number
  words: number
  temp?: boolean
  bookmarks?: { ch: number; b: number; at: number; text: string }[]
}

export type ScenarioBookContent = { id: string; chapters: ScenarioChapter[] }

/** Mirror of LooseMark (lib/marks.ts). */
export type ScenarioMark = {
  id: string
  at: number
  title: string
  sentence: string
  /** fingerprint of the text the moment lives in */
  key: string
  idx: number
}

/** Mirror of PronEntry (lib/pronounce.ts). */
export type ScenarioPronEntry = { from: string; to: string }

/** The scenario's own settings copy — an empty app's defaults, never the
 *  user's real settings object. */
export type ScenarioSettings = {
  uiLang: ScenarioLang
  listenSpeed: number
  bubbleOn: boolean
  bubbleAuto: boolean
  bubbleText: boolean
}

/** The live reading on the fiction stage (the future Q2/AD1 stage machinery,
 *  mirroring player/listen.ts + lib/bubble.ts stage state). */
export type ScenarioSession = {
  /** id of the fiction text or clip on stage, or null between texts */
  textId: string | null
  text: string
  title: string
  /** current sentence index */
  idx: number
  playing: boolean
  finished: boolean
}

/** The return-to-interrupted card, mirroring bubble.ts's ResumeCard — held in
 *  the scenario's own kv backend, never in the real `logos.bubble.resume`. */
export type ScenarioResumeCard = { text: string; idx: number; title: string }
