/**
 * The real side, as the scenario is allowed to see it: READ-ONLY (PLAN §0.2).
 *
 * A lesson may need to *check* the real world — above all, to prove it is not
 * borrowing it (the scenario never stages the user's current Listen text or a
 * real book). For that, the host may hand the scenario a RealDataReader: a
 * frozen snapshot with getters and no mutators. There is deliberately no
 * setter, no store handle and no write-shaped method on this interface — the
 * read-only-ness is in the type, not in a promise.
 */
import type { ScenarioPronEntry } from './types.ts'

/** Plain snapshot data the host copies OUT of the real stores to build a
 *  reader. The scenario receives copies, never live references. */
export type RealSnapshotData = {
  settings: Record<string, unknown>
  draftListen: string
  clipIds: string[]
  bookIds: string[]
  markIds: string[]
  pronounce: ScenarioPronEntry[]
}

export interface RealDataReader {
  /** The user's real settings, as a frozen copy. */
  settings(): Readonly<Record<string, unknown>>
  /** The user's current Listen draft — to compare against, never to stage. */
  draftListen(): string
  /** Ids of the user's real Library clips. */
  clipIds(): readonly string[]
  /** Ids of the user's real books. */
  bookIds(): readonly string[]
  /** Ids of the user's real loose marks. */
  markIds(): readonly string[]
  /** The user's real pronunciation entries, as frozen copies. */
  pronounce(): readonly Readonly<ScenarioPronEntry>[]
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v)
    Object.freeze(value)
  }
  return value
}

/** Build a reader from plain snapshot data. Everything is copied and frozen
 *  here, so even the host cannot mutate the real side through the reader. */
export function createRealReader(data: RealSnapshotData): RealDataReader {
  const settings = deepFreeze(structuredClone(data.settings))
  const clipIds = deepFreeze([...data.clipIds])
  const bookIds = deepFreeze([...data.bookIds])
  const markIds = deepFreeze([...data.markIds])
  const pronounce = deepFreeze(data.pronounce.map((e) => ({ ...e })))
  const draft = data.draftListen
  return {
    settings: () => settings,
    draftListen: () => draft,
    clipIds: () => clipIds,
    bookIds: () => bookIds,
    markIds: () => markIds,
    pronounce: () => pronounce,
  }
}
