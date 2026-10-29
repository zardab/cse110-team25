import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssignedGates, LevelConfig } from '../types/circuit'
import { loadLevel } from '../content/levelLoader'
import {
  PROGRESS_SCHEMA_VERSION, PROGRESS_STORAGE_KEY, StorageAdapter,
  type LevelProgress, type StorageLike,
} from './storageAdapter'

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>()
  failRead = false
  failWrite = false
  failRemove = false
  writes = 0

  getItem(key: string): string | null {
    if (this.failRead) throw new Error('Storage blocked')
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrite) throw new Error('Quota exceeded')
    this.data.set(key, value)
    this.writes += 1
  }

  removeItem(key: string): void {
    if (this.failRemove) throw new Error('Storage blocked')
    this.data.delete(key)
  }
}

function fixture(id = 'two-step'): LevelConfig {
  return loadLevel({
    id, title: 'Invert then AND', difficulty: 'EASY',
    availableGatePalette: { NOT: 1, AND: 1, OR: 1 },
    primaryInputs: ['a', 'b'], primaryOutputs: ['y'],
    slots: {
      start: { id: 'start', inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'a' }],
        outputWireId: 'middle',
      },
      finish: { id: 'finish', allowedGates: ['AND'], inputs: [
        { sourceType: 'SLOT_OUTPUT', sourceId: 'start' },
        { sourceType: 'PRIMARY_INPUT', sourceId: 'b' },
      ], outputWireId: 'y' },
    },
    truthTableTarget: [{ inputs: { a: 0, b: 1 }, expected: { y: 1 } }], hints: [],
  })
}

function progress(placements: AssignedGates = { start: 'NOT', finish: 'AND' }): LevelProgress {
  return { completed: true, stars: 2, placements }
}

function saved(levels: unknown, version = PROGRESS_SCHEMA_VERSION): string {
  return JSON.stringify({ version, levels })
}

afterEach(() => vi.unstubAllGlobals())

describe('StorageAdapter', () => {
  it('returns fresh safe defaults when there is no saved level', () => {
    const adapter = new StorageAdapter(new MemoryStorage())
    expect(adapter.getProgress()).toEqual({})
    expect(adapter.loadLevel(fixture())).toEqual({ completed: false, stars: 0, placements: {} })
    expect(adapter.loadLevel(fixture())).not.toBe(adapter.loadLevel(fixture()))
  })

  it('round-trips completed levels, stars, and placements across adapter instances', () => {
    const storage = new MemoryStorage()
    const level = fixture()
    expect(new StorageAdapter(storage).saveLevel(level, progress())).toBe(true)
    const restored = new StorageAdapter(storage)
    expect(restored.loadLevel(level)).toEqual(progress())
    expect(restored.getProgress()).toEqual({ 'two-step': { completed: true, stars: 2 } })
    expect(JSON.parse(storage.data.get(PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 1, levels: { 'two-step': progress() },
    })
  })

  it('saves only the persistence fields, not compiled levels or derived state', () => {
    const storage = new MemoryStorage()
    const adapter = new StorageAdapter(storage)
    adapter.saveLevel(fixture(), { ...progress(), executionOrder: ['start'], wireStates: { y: 1 },
      simulationResult: { isSolved: true },
    } as LevelProgress)
    expect(JSON.parse(storage.data.get(PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 1, levels: { 'two-step': progress() },
    })
  })

  it('keeps different levels and adapters from overwriting each other’s progress', () => {
    const storage = new MemoryStorage()
    const first = new StorageAdapter(storage)
    const second = new StorageAdapter(storage)
    first.saveLevel(fixture('one'), progress())
    second.saveLevel(fixture('two'), { ...progress(), stars: 3 })
    first.saveLevel(fixture('one'), { ...progress(), stars: 1 })
    expect(first.getProgress()).toEqual({
      one: { completed: true, stars: 2 }, two: { completed: true, stars: 3 },
    })
  })

  it('preserves earned achievements while replacing saved placements for replay', () => {
    const storage = new MemoryStorage()
    const adapter = new StorageAdapter(storage)
    const level = fixture()
    adapter.saveLevel(level, { ...progress(), stars: 3 })
    adapter.saveLevel(level, { completed: false, stars: 0, placements: { start: null } })
    expect(adapter.loadLevel(level)).toEqual({
      completed: true, stars: 3, placements: { start: null },
    })
  })

  it('supports incomplete boards, explicit empty slots, and omitted slots', () => {
    const adapter = new StorageAdapter(new MemoryStorage())
    const level = fixture()
    const partial = { completed: false, stars: 0, placements: { start: 'NOT', finish: null } } as const
    expect(adapter.saveLevel(level, partial)).toBe(true)
    expect(adapter.loadLevel(level)).toEqual(partial)
    expect(adapter.saveLevel(level, { ...partial, placements: {} })).toBe(true)
    expect(adapter.loadLevel(level).placements).toEqual({})
  })

  it('does not retain mutable input or expose mutable internal state', () => {
    const adapter = new StorageAdapter(new MemoryStorage())
    const placements: Record<string, 'NOT' | 'AND' | null> = { start: 'NOT', finish: 'AND' }
    adapter.saveLevel(fixture(), progress(placements))
    placements.start = null
    const result = adapter.loadLevel(fixture())
    const returnedBoard = result.placements as Record<string, unknown>
    const returnedSummary = adapter.getProgress()['two-step'] as { stars: number }
    returnedBoard.start = null
    returnedSummary.stars = 0
    expect(adapter.loadLevel(fixture())).toEqual(progress())
  })

  it.each([
    '{broken', 'null', '[]', '{}',
    saved({ 'two-step': progress() }, 0), saved({ 'two-step': progress() }, 2),
    JSON.stringify({ version: '1', levels: { 'two-step': progress() } }),
    saved([]), saved(null),
  ])('tolerates malformed or unsupported storage without changing it: %s', (raw) => {
    const storage = new MemoryStorage()
    storage.data.set(PROGRESS_STORAGE_KEY, raw)
    const adapter = new StorageAdapter(storage)
    expect(adapter.loadLevel(fixture())).toEqual({ completed: false, stars: 0, placements: {} })
    expect(adapter.getProgress()).toEqual({})
    expect(storage.data.get(PROGRESS_STORAGE_KEY)).toBe(raw)
    expect(storage.writes).toBe(0)
  })

  it('ignores malformed level summaries while preserving valid levels', () => {
    const storage = new MemoryStorage()
    storage.data.set(PROGRESS_STORAGE_KEY, saved({
      valid: progress(), badStars: { ...progress(), stars: 4 },
      fraction: { ...progress(), stars: 1.5 }, negative: { ...progress(), stars: -1 },
      badCompleted: { ...progress(), completed: 'yes' }, ' ': progress(), broken: null,
    }))
    expect(new StorageAdapter(storage).getProgress()).toEqual({ valid: { completed: true, stars: 2 } })
  })

  it.each([
    { missing: 'NOT' }, { start: 'MAGIC' }, { start: 'AND' }, { finish: 'OR' },
    { start: 'NULL' }, [], null, 'NOT',
  ])('clears an invalid saved board but preserves its earned progress: %j', (placements) => {
    const storage = new MemoryStorage()
    storage.data.set(PROGRESS_STORAGE_KEY, saved({ 'two-step': { ...progress(), placements } }))
    const adapter = new StorageAdapter(storage)
    expect(adapter.loadLevel(fixture())).toEqual({ ...progress(), placements: {} })
    expect(adapter.getProgress()).toEqual({ 'two-step': { completed: true, stars: 2 } })
  })

  it('rejects over-inventory saved boards against the current level configuration', () => {
    const level = fixture()
    const expanded = { ...level, slots: { ...level.slots,
      extra: { ...level.slots.start, id: 'extra', outputWireId: 'unused' },
    } }
    const storage = new MemoryStorage()
    storage.data.set(PROGRESS_STORAGE_KEY, saved({
      'two-step': progress({ start: 'NOT', extra: 'NOT' }),
    }))
    const adapter = new StorageAdapter(storage)
    expect(adapter.loadLevel(expanded).placements).toEqual({})
    expect(adapter.saveLevel(expanded, progress({ start: 'NOT', extra: 'NOT' }))).toBe(false)
  })

  it.each([
    { ...progress(), stars: -1 }, { ...progress(), stars: 4 }, { ...progress(), stars: NaN },
    { ...progress(), completed: 'true' }, { ...progress(), placements: { unknown: 'NOT' } },
    { ...progress(), placements: { start: 'OR' } }, { ...progress(), placements: { finish: 'OR' } },
    { ...progress(), placements: { start: 'MAGIC' } }, { ...progress(), placements: null },
  ])('rejects invalid save requests without overwriting existing progress: %j', (invalid) => {
    const storage = new MemoryStorage()
    const adapter = new StorageAdapter(storage)
    adapter.saveLevel(fixture(), progress())
    const before = storage.data.get(PROGRESS_STORAGE_KEY)
    expect(adapter.saveLevel(fixture(), invalid as LevelProgress)).toBe(false)
    expect(storage.data.get(PROGRESS_STORAGE_KEY)).toBe(before)
  })

  it('revalidates placements when a level definition changes', () => {
    const adapter = new StorageAdapter(new MemoryStorage())
    const original = fixture()
    adapter.saveLevel(original, progress())
    expect(adapter.loadLevel({ ...original, availableGatePalette: {
      ...original.availableGatePalette, NOT: 0,
    } })).toEqual({ ...progress(), placements: {} })
  })

  it('works without browser storage and returns false on attempted writes', () => {
    const adapter = new StorageAdapter(null)
    expect(adapter.loadLevel(fixture())).toEqual({ completed: false, stars: 0, placements: {} })
    expect(adapter.saveLevel(fixture(), progress())).toBe(false)
    expect(adapter.removeLevel('two-step')).toBe(false)
    expect(adapter.clear()).toBe(false)
  })

  it('tolerates an unavailable or throwing browser localStorage accessor', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(new StorageAdapter().saveLevel(fixture(), progress())).toBe(false)
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('Storage denied') },
    })
    expect(new StorageAdapter().loadLevel(fixture()).placements).toEqual({})
  })

  it('uses browser localStorage by default', () => {
    const storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    expect(new StorageAdapter().saveLevel(fixture(), progress())).toBe(true)
    expect(storage.data.has(PROGRESS_STORAGE_KEY)).toBe(true)
  })

  it('handles read, quota, and removal failures without preventing play', () => {
    const storage = new MemoryStorage()
    const adapter = new StorageAdapter(storage)
    storage.failRead = true
    expect(adapter.loadLevel(fixture()).placements).toEqual({})
    expect(adapter.saveLevel(fixture(), progress())).toBe(false)
    expect(adapter.removeLevel('two-step')).toBe(false)
    expect(storage.writes).toBe(0)
    storage.failRead = false
    storage.failWrite = true
    expect(adapter.saveLevel(fixture(), progress())).toBe(false)
    storage.failRemove = true
    expect(adapter.clear()).toBe(false)
  })

  it('removes one level, and clears only the namespaced key', () => {
    const storage = new MemoryStorage()
    storage.data.set('unrelated-key', 'keep')
    const adapter = new StorageAdapter(storage)
    adapter.saveLevel(fixture('one'), progress())
    adapter.saveLevel(fixture('two'), progress())
    expect(adapter.removeLevel('one')).toBe(true)
    expect(adapter.getProgress()).toEqual({ two: { completed: true, stars: 2 } })
    expect(adapter.clear()).toBe(true)
    expect(storage.data.has(PROGRESS_STORAGE_KEY)).toBe(false)
    expect(storage.data.get('unrelated-key')).toBe('keep')
  })

  it('isolates custom storage keys', () => {
    const storage = new MemoryStorage()
    new StorageAdapter(storage, 'custom').saveLevel(fixture(), progress())
    expect(new StorageAdapter(storage).getProgress()).toEqual({})
    expect(new StorageAdapter(storage, 'custom').loadLevel(fixture())).toEqual(progress())
  })

  it('handles special record keys without treating inherited names as saved data', () => {
    const storage = new MemoryStorage()
    const adapter = new StorageAdapter(storage)
    expect(adapter.loadLevel(fixture('constructor')).completed).toBe(false)
    expect(adapter.saveLevel(fixture('__proto__'), progress())).toBe(true)
    expect(adapter.loadLevel(fixture('__proto__'))).toEqual(progress())
    expect(Object.hasOwn(adapter.getProgress(), '__proto__')).toBe(true)
  })
})
