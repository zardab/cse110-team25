import type { FaultLevel } from '../content/faultLevelLoader'
import { evaluateGate } from '../simulation/gates'
import { faultCount, observe, type Bit, type Bits } from './faultFinder'

/**
 * Proves a Fault Finder level is fair. The player sees every wire and only has to say which
 * gates are faulty, so a gate is caught on a test exactly when its output wire disagrees with
 * what its gate type gives for the values on its input wires. A level is fair when one set of
 * tests within the budget catches every faulty gate. Levels that fail are not shipped.
 */

export class FaultLevelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FaultLevelError'
  }
}

export interface FaultAnalysis {
  readonly levelId: string
  /** Fewest tests that catch every faulty gate misbehaving at least once. */
  readonly minTests: number
}

/** Every assignment of the level's inputs, in binary counting order. */
export function allInputRows(level: FaultLevel): Bits[] {
  const ids = level.primaryInputs
  const rows: Bits[] = []
  for (let n = 0; n < 1 << ids.length; n += 1) {
    rows.push(Object.fromEntries(ids.map((id, index) => [id, ((n >> (ids.length - 1 - index)) & 1) as Bit])))
  }
  return rows
}

/** The faulty gates whose visible output contradicts their visible inputs on this row. */
export function exposedFaults(level: FaultLevel, inputs: Bits): string[] {
  const wires = observe(level, level.faults, inputs)
  return Object.keys(level.faults).filter((slotId) => {
    const slot = level.slots[slotId]
    if (slot.assignedGate === 'NULL') return false
    const seen = slot.inputs.map((source) =>
      wires[source.sourceType === 'PRIMARY_INPUT' ? source.sourceId : level.slots[source.sourceId].outputWireId])
    return evaluateGate(slot.assignedGate, seen) !== wires[slot.outputWireId]
  })
}

function subsets<T>(items: readonly T[], maxSize: number): T[][] {
  const results: T[][] = [[]]
  for (const item of items) {
    const grown = results.filter((subset) => subset.length < maxSize).map((subset) => [...subset, item])
    results.push(...grown)
  }
  return results.sort((a, b) => a.length - b.length)
}

/** Fewest rows covering every mask, or null. `masks[i]` has bit r set when fault i shows on row r. */
function minimumCover(masks: readonly number[], rowCount: number, maxSize: number): number | null {
  if (masks.some((mask) => mask === 0)) return null
  const rows = Array.from({ length: rowCount }, (_, index) => index)
  for (const chosen of subsets(rows, maxSize)) {
    if (chosen.length === 0) continue
    const cover = chosen.reduce((mask, row) => mask | (1 << row), 0)
    if (masks.every((mask) => (mask & cover) !== 0)) return chosen.length
  }
  return null
}

/** Throws a FaultLevelError if a careful player could not catch every fault within the budget. */
export function analyzeFaultLevel(level: FaultLevel): FaultAnalysis {
  const rows = allInputRows(level)
  const exposed = rows.map((inputs) => exposedFaults(level, inputs))
  const masks = Object.keys(level.faults).map((slotId) =>
    exposed.reduce((mask, caught, row) => (caught.includes(slotId) ? mask | (1 << row) : mask), 0))
  const minTests = minimumCover(masks, rows.length, Math.min(level.testBudget, faultCount(level)))
  if (minTests === null) {
    throw new FaultLevelError(
      `${level.id}: ${level.testBudget} test(s) cannot catch every faulty gate misbehaving `
      + '(some fault never shows, or the faults need more tests than the budget)',
    )
  }
  return { levelId: level.id, minTests }
}
