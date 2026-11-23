import type { FaultLevel } from '../content/faultLevelLoader'
import type { FaultMap } from '../types/circuit'
import { candidateFaults, faultCount, observe, type Bit, type Bits } from './faultFinder'

/**
 * Proves a Fault Finder level is fair: with some choice of probes within the probe budget,
 * a perfect player can tell the real faults apart from every other fault set of the same
 * size using no more tests than the test budget. Levels that fail are not shipped.
 */

export class FaultLevelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FaultLevelError'
  }
}

export interface FaultAnalysis {
  readonly levelId: string
  /** Fewest tests that isolate the faults, using the probes listed. */
  readonly minTests: number
  /** The probe placement that achieves `minTests`. Empty when outputs alone suffice. */
  readonly probes: readonly string[]
  /** Fewest tests that isolate the faults using outputs only, or null if that's impossible. */
  readonly minTestsWithoutProbes: number | null
  /** Number of competing fault sets the player has to rule out. */
  readonly rivals: number
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

function sameFaults(a: FaultMap, b: FaultMap): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((id) => b[id] === a[id])
}

/** A compact string of everything observable for one fault set on one row. */
function observation(level: FaultLevel, faults: FaultMap, inputs: Bits, probes: readonly string[]): string {
  const { outputs, readings } = observe(level, faults, inputs, probes)
  return level.primaryOutputs.map((id) => outputs[id]).join('') + '|' + probes.map((id) => readings[id]).join('')
}

function subsets<T>(items: readonly T[], maxSize: number): T[][] {
  const results: T[][] = [[]]
  for (const item of items) {
    const grown = results.filter((subset) => subset.length < maxSize).map((subset) => [...subset, item])
    results.push(...grown)
  }
  return results.sort((a, b) => a.length - b.length)
}

/**
 * Fewest rows whose observations rule out every rival, or null if some rival matches the
 * real faults on every row. `rowMasks[i]` has bit r set when rival i differs on row r.
 */
function minimumCover(rowMasks: readonly number[], rowCount: number, maxSize: number): number | null {
  if (rowMasks.some((mask) => mask === 0)) return null
  if (rowMasks.length === 0) return 1
  const rows = Array.from({ length: rowCount }, (_, index) => index)
  for (const chosen of subsets(rows, maxSize)) {
    if (chosen.length === 0) continue
    const cover = chosen.reduce((mask, row) => mask | (1 << row), 0)
    if (rowMasks.every((mask) => (mask & cover) !== 0)) return chosen.length
  }
  return null
}

/** Throws a FaultLevelError if a careful player could not solve the level within its budgets. */
export function analyzeFaultLevel(level: FaultLevel): FaultAnalysis {
  const rows = allInputRows(level)
  const size = faultCount(level)
  const rivals = candidateFaults(level, size).filter((faults) => !sameFaults(faults, level.faults))
  const healthyAndReal: FaultMap[] = [{}]
  const probeChoices = subsets(level.executionOrder, level.probeBudget)

  let best: { minTests: number; probes: readonly string[] } | null = null
  let withoutProbes: number | null = null
  for (const probes of probeChoices) {
    const truth = rows.map((inputs) => observation(level, level.faults, inputs, probes))
    const masks = [...rivals, ...healthyAndReal].map((faults) =>
      rows.reduce((mask, inputs, row) =>
        observation(level, faults, inputs, probes) === truth[row] ? mask : mask | (1 << row), 0))
    // Everything must be ruled out, including the healthy board.
    const minTests = minimumCover(masks, rows.length, level.testBudget)
    if (probes.length === 0) withoutProbes = minTests
    if (minTests !== null && (best === null || minTests < best.minTests)) best = { minTests, probes }
  }

  if (best === null) {
    throw new FaultLevelError(
      `${level.id}: no probe placement within the budget of ${level.probeBudget} lets ${level.testBudget} test(s) `
      + 'single out the real faults from every rival fault set (or from a healthy board)',
    )
  }
  return { levelId: level.id, minTests: best.minTests, probes: best.probes, minTestsWithoutProbes: withoutProbes, rivals: rivals.length }
}
