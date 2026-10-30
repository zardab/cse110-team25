import type { AssignedGates, GateType, LevelConfig } from '../types/circuit'
import { isGateType } from '../content/levelLoader'

export const PROGRESS_SCHEMA_VERSION = 1
export const PROGRESS_STORAGE_KEY = 'cse110-team25:progress'

/** The subset of browser Storage needed by the adapter; injectable in tests. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface LevelProgressSummary {
  readonly completed: boolean
  readonly stars: number
}

export interface LevelProgress extends LevelProgressSummary {
  readonly placements: AssignedGates
}

function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function summary(value: unknown): value is LevelProgressSummary {
  return record(value) && typeof value.completed === 'boolean'
    && typeof value.stars === 'number' && Number.isInteger(value.stars)
    && value.stars >= 0 && value.stars <= 3
}

function placements(value: unknown): value is AssignedGates {
  return record(value) && Object.values(value).every((gate) => gate === null || isGateType(gate))
}

function validPlacements(level: LevelConfig, value: unknown): value is AssignedGates {
  if (!placements(value)) return false
  const counts = new Map<GateType, number>()
  for (const [id, gate] of Object.entries(value)) {
    if (!Object.hasOwn(level.slots, id)) return false
    if (gate === null) continue
    const slot = level.slots[id]
    if ((gate === 'NOT' ? 1 : 2) !== slot.inputs.length
      || (slot.allowedGates !== undefined && !slot.allowedGates.includes(gate))) return false
    const count = (counts.get(gate) ?? 0) + 1
    if (count > level.availableGatePalette[gate]) return false
    counts.set(gate, count)
  }
  return true
}

function emptyProgress(): LevelProgress {
  return { completed: false, stars: 0, placements: {} }
}

/** Versioned progress storage, independent of the game store and evaluator. */
export class StorageAdapter {
  constructor(
    private readonly storage: StorageLike | null = browserStorage(),
    private readonly key: string = PROGRESS_STORAGE_KEY,
  ) {}

  /** Null means storage cannot be read; an empty object means no usable data. */
  private read(): Record<string, LevelProgress> | null {
    if (!this.storage) return null
    let raw: string | null
    try {
      raw = this.storage.getItem(this.key)
    } catch {
      return null
    }
    if (raw === null) return {}
    try {
      const saved: unknown = JSON.parse(raw)
      if (!record(saved) || saved.version !== PROGRESS_SCHEMA_VERSION || !record(saved.levels)) return {}
      return Object.fromEntries(Object.entries(saved.levels).flatMap(([id, progress]) => {
        if (id.trim().length === 0 || !summary(progress)) return []
        const board = record(progress) && placements(progress.placements) ? progress.placements : {}
        return [[id, { completed: progress.completed, stars: progress.stars,
          placements: { ...board },
        }]]
      }))
    } catch {
      return {}
    }
  }

  private write(levels: Record<string, LevelProgress>): boolean {
    if (!this.storage) return false
    try {
      this.storage.setItem(this.key, JSON.stringify({ version: PROGRESS_SCHEMA_VERSION, levels }))
      return true
    } catch {
      return false
    }
  }

  /** Summaries support a level-selection screen without exposing unvalidated boards. */
  getProgress(): Readonly<Record<string, LevelProgressSummary>> {
    return Object.fromEntries(Object.entries(this.read() ?? {}).map(([id, progress]) =>
      [id, { completed: progress.completed, stars: progress.stars }],
    ))
  }

  /** Restore a board only if every placement is valid for the current level. */
  loadLevel(level: LevelConfig): LevelProgress {
    const levels = this.read()
    if (!levels || !Object.hasOwn(levels, level.id)) return emptyProgress()
    const progress = levels[level.id]
    return { completed: progress.completed, stars: progress.stars,
      placements: validPlacements(level, progress.placements) ? { ...progress.placements } : {},
    }
  }

  /** Save the latest board while preserving earned completion and best stars. */
  saveLevel(level: LevelConfig, progress: LevelProgress): boolean {
    if (!summary(progress) || !validPlacements(level, progress.placements)) return false
    const levels = this.read()
    if (!levels) return false
    const previous = Object.hasOwn(levels, level.id) ? levels[level.id] : emptyProgress()
    const next = { completed: previous.completed || progress.completed,
      stars: Math.max(previous.stars, progress.stars), placements: { ...progress.placements },
    }
    return this.write({ ...levels, [level.id]: next })
  }

  removeLevel(levelId: string): boolean {
    const levels = this.read()
    if (!levels) return false
    delete levels[levelId]
    return this.write(levels)
  }

  /** Remove only this adapter's namespaced key, never unrelated browser data. */
  clear(): boolean {
    if (!this.storage) return false
    try {
      this.storage.removeItem(this.key)
      return true
    } catch {
      return false
    }
  }
}
