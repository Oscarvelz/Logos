/**
 * The scenario's own storage backends (FENCE-DESIGN §1.4).
 *
 * The scenario never touches the app's backends. Behind its adapters it keeps:
 *  - a key/value map for the localStorage-class stores (settings copy, drafts,
 *    marks, resume cards, pronunciation, keep stamps, shelf), and
 *  - its own record databases — `logos-scenario` and `logos-scenario-books`,
 *    same store shapes as the real `logos` / `logos-books` — held in a host
 *    object that exists only inside the scenario instance.
 *
 * Both backends are volatile by construction: they are plain in-memory
 * structures created with the scenario and referenced by nothing outside it.
 * Teardown drops them whole; a hard kill drops the only reference, and since
 * no scenario byte ever transited a persisted backend, there is nothing to
 * clean up (FENCE-DESIGN §1.4, exit path 3).
 */

/** In-memory key/value backend for the localStorage-class scenario stores.
 *  Values are JSON strings, exactly as the real stores keep them. */
export class ScenarioKv {
  private map = new Map<string, string>()

  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }

  set(key: string, value: string): void {
    this.map.set(key, value)
  }

  remove(key: string): void {
    this.map.delete(key)
  }

  get size(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }
}

type RecordMap = Map<string, unknown>
type StoreMap = Map<string, RecordMap>

/** A minimal record-database host with the app's IndexedDB shapes: named
 *  databases, named object stores, records keyed by their `id`. Async surface
 *  mirrors the real tx()/run() helpers' promise shape without being them. */
export class ScenarioDbHost {
  private dbs = new Map<string, StoreMap>()

  private store(db: string, name: string): RecordMap {
    let stores = this.dbs.get(db)
    if (!stores) {
      stores = new Map()
      this.dbs.set(db, stores)
    }
    let records = stores.get(name)
    if (!records) {
      records = new Map()
      stores.set(name, records)
    }
    return records
  }

  async put<T extends { id: string }>(db: string, store: string, record: T): Promise<void> {
    this.store(db, store).set(record.id, record)
  }

  async get<T>(db: string, store: string, id: string): Promise<T | null> {
    const rec = this.store(db, store).get(id)
    return rec === undefined ? null : (rec as T)
  }

  async delete(db: string, store: string, id: string): Promise<void> {
    this.store(db, store).delete(id)
  }

  async getAll<T>(db: string, store: string): Promise<T[]> {
    return [...this.store(db, store).values()] as T[]
  }

  async count(db: string, store: string): Promise<number> {
    return this.store(db, store).size
  }

  /** The database names that currently exist in this host. */
  databaseNames(): string[] {
    return [...this.dbs.keys()]
  }

  /** Delete a whole database (teardown, FENCE-DESIGN §1.4). */
  deleteDatabase(name: string): void {
    this.dbs.delete(name)
  }

  /** True when no database holds any record. */
  isEmpty(): boolean {
    for (const stores of this.dbs.values()) {
      for (const records of stores.values()) {
        if (records.size > 0) return false
      }
    }
    return true
  }

  dropAll(): void {
    this.dbs.clear()
  }
}

/** The scenario database names — deliberately NOT the real ones. */
export const SCENARIO_DB = 'logos-scenario'
export const SCENARIO_BOOKS_DB = 'logos-scenario-books'
