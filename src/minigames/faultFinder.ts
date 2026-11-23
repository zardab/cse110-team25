import type { FaultLevel } from '../content/faultLevelLoader'
import { simulateCircuit } from '../simulation/evaluateCircuit'
import type { FaultMap, StuckAt } from '../types/circuit'

/**
 * "Fault Finder": the circuit design is fully visible and correct, but some gates are
 * secretly stuck at 0 or 1. The player sets inputs, runs tests, compares what the board
 * should output with what it actually outputs, and may attach a limited number of probes
 * to internal wires to read them directly. They win by marking exactly the stuck gates.
 */

export type Bit = 0 | 1

export type Bits = Readonly<Record<string, Bit>>

/** One test: the inputs used, what a healthy board would output, and what this board did. */
export interface TestRecord {
  readonly inputs: Bits
  readonly expected: Bits
  readonly actual: Bits
  /** Values read by the probes attached when the test ran, keyed by slot ID. */
  readonly readings: Bits
}

export type GameStatus = 'playing' | 'won' | 'lost'

export interface FaultGame {
  readonly level: FaultLevel
  /** The switches as the player currently has them. */
  readonly inputs: Bits
  readonly tests: readonly TestRecord[]
  /** Slots whose output wires carry a probe, in the order attached. Probes never come off. */
  readonly probes: readonly string[]
  /** The player's current marks: which gates they think are stuck, and at what. */
  readonly diagnosis: FaultMap
  readonly mistakes: number
  readonly status: GameStatus
}

export type DiagnosisOutcome =
  | { readonly kind: 'correct' }
  /** Marks don't add up to the number of stuck gates; nothing is charged. */
  | { readonly kind: 'wrongCount'; readonly expected: number }
  /** The marked gates could not have produced one of the tests already run. */
  | { readonly kind: 'contradicts'; readonly testIndex: number }
  /** The marked gates explain every test so far, but they are not the real faults. */
  | { readonly kind: 'fitsSoFar' }

/** What the player can observe for a fault set on one input vector: outputs plus probed wires. */
export function observe(level: FaultLevel, faults: FaultMap, inputs: Bits, probes: readonly string[]): {
  readonly outputs: Bits
  readonly readings: Bits
} {
  const wires = simulateCircuit(level, inputs, faults)
  const outputs = Object.fromEntries(level.primaryOutputs.map((id) => [id, wires[id] as Bit]))
  const readings = Object.fromEntries(probes.map((slotId) => [slotId, wires[level.slots[slotId].outputWireId] as Bit]))
  return { outputs, readings }
}

export function faultCount(level: FaultLevel): number {
  return Object.keys(level.faults).length
}

export function startGame(level: FaultLevel): FaultGame {
  return {
    level,
    inputs: Object.fromEntries(level.primaryInputs.map((id) => [id, 0])),
    tests: [],
    probes: [],
    diagnosis: {},
    mistakes: 0,
    status: 'playing',
  }
}

export function toggleInput(game: FaultGame, inputId: string): FaultGame {
  if (game.status !== 'playing' || !Object.hasOwn(game.inputs, inputId)) return game
  return { ...game, inputs: { ...game.inputs, [inputId]: game.inputs[inputId] === 1 ? 0 : 1 } }
}

export function setInputs(game: FaultGame, inputs: Bits): FaultGame {
  if (game.status !== 'playing') return game
  return { ...game, inputs: { ...game.inputs, ...inputs } }
}

export function probesLeft(game: FaultGame): number {
  return game.level.probeBudget - game.probes.length
}

export function testsLeft(game: FaultGame): number {
  return game.level.testBudget - game.tests.length
}

export function attachProbe(game: FaultGame, slotId: string): FaultGame {
  if (game.status !== 'playing' || probesLeft(game) <= 0) return game
  if (!Object.hasOwn(game.level.slots, slotId) || game.probes.includes(slotId)) return game
  return { ...game, probes: [...game.probes, slotId] }
}

/** Runs the current inputs through the real board and logs what came out. */
export function runTest(game: FaultGame): FaultGame {
  if (game.status !== 'playing' || testsLeft(game) <= 0) return game
  const { level, inputs, probes } = game
  const { outputs: expected } = observe(level, {}, inputs, [])
  const { outputs: actual, readings } = observe(level, level.faults, inputs, probes)
  return { ...game, tests: [...game.tests, { inputs, expected, actual, readings }] }
}

/** The latest test run with exactly these inputs, if any. */
export function testMatching(game: FaultGame, inputs: Bits): number | null {
  for (let index = game.tests.length - 1; index >= 0; index -= 1) {
    const test = game.tests[index]
    if (game.level.primaryInputs.every((id) => test.inputs[id] === inputs[id])) return index
  }
  return null
}

/** Cycles a gate's mark: healthy → stuck at 0 → stuck at 1 → healthy. */
export function cycleMark(game: FaultGame, slotId: string): FaultGame {
  if (game.status !== 'playing' || !Object.hasOwn(game.level.slots, slotId)) return game
  const diagnosis: Record<string, StuckAt> = { ...game.diagnosis }
  if (!Object.hasOwn(diagnosis, slotId)) diagnosis[slotId] = 0
  else if (diagnosis[slotId] === 0) diagnosis[slotId] = 1
  else delete diagnosis[slotId]
  return { ...game, diagnosis }
}

/** Whether `faults` would have produced every test's actual outputs and probe readings. */
export function explainsTests(level: FaultLevel, faults: FaultMap, tests: readonly TestRecord[]): boolean {
  return tests.every((test) => {
    const probed = Object.keys(test.readings)
    const { outputs, readings } = observe(level, faults, test.inputs, probed)
    return level.primaryOutputs.every((id) => outputs[id] === test.actual[id])
      && probed.every((slotId) => readings[slotId] === test.readings[slotId])
  })
}

function sameFaults(a: FaultMap, b: FaultMap): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((id) => b[id] === a[id])
}

export function submitDiagnosis(game: FaultGame): { readonly outcome: DiagnosisOutcome; readonly game: FaultGame } {
  const expected = faultCount(game.level)
  if (game.status !== 'playing') return { outcome: { kind: 'wrongCount', expected }, game }
  if (Object.keys(game.diagnosis).length !== expected) {
    return { outcome: { kind: 'wrongCount', expected }, game }
  }
  if (sameFaults(game.diagnosis, game.level.faults)) {
    return { outcome: { kind: 'correct' }, game: { ...game, status: 'won' } }
  }
  const mistakes = game.mistakes + 1
  const status: GameStatus = mistakes >= game.level.maxMistakes ? 'lost' : 'playing'
  const next = { ...game, mistakes, status }
  const failing = game.tests.findIndex((test) => !explainsTests(game.level, game.diagnosis, [test]))
  if (failing !== -1) return { outcome: { kind: 'contradicts', testIndex: failing }, game: next }
  return { outcome: { kind: 'fitsSoFar' }, game: next }
}

/** Every way to pick `size` stuck gates from the circuit, each at 0 or 1. */
export function candidateFaults(level: FaultLevel, size: number): FaultMap[] {
  const slotIds = level.executionOrder
  const results: FaultMap[] = []
  function pick(start: number, chosen: Record<string, StuckAt>, left: number): void {
    if (left === 0) {
      results.push({ ...chosen })
      return
    }
    for (let index = start; index <= slotIds.length - left; index += 1) {
      for (const stuckAt of [0, 1] as const) {
        chosen[slotIds[index]] = stuckAt
        pick(index + 1, chosen, left - 1)
        delete chosen[slotIds[index]]
      }
    }
  }
  pick(0, {}, size)
  return results
}

/** How many fault sets of the declared size are still consistent with every test run so far. */
export function countSuspects(game: FaultGame): number {
  return candidateFaults(game.level, faultCount(game.level))
    .filter((faults) => explainsTests(game.level, faults, game.tests)).length
}
