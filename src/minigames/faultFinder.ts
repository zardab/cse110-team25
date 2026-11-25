import type { FaultLevel } from '../content/faultLevelLoader'
import { simulateCircuit } from '../simulation/evaluateCircuit'
import type { FaultMap } from '../types/circuit'

/**
 * "Fault Finder": the circuit's gates and wiring are visible, but some gates are secretly
 * stuck at 0 or 1. The player knows how many. They set inputs and run tests; each test lights
 * every wire with what the faulty board really carries (never what a healthy board would).
 * They then mark which gates they think are faulty (just where, not how) and submit the
 * whole set at once: it is either exactly right or wrong, with no indication of which mark
 * was off.
 */

export type Bit = 0 | 1

export type Bits = Readonly<Record<string, Bit>>

/** One test: the inputs used and the value on every wire of the faulty board. */
export interface TestRecord {
  readonly inputs: Bits
  /** Every wire (primary inputs, gate outputs, primary outputs) keyed by wire ID. */
  readonly wires: Bits
}

export type GameStatus = 'playing' | 'won' | 'lost'

export interface FaultGame {
  readonly level: FaultLevel
  /** The switches as the player currently has them. */
  readonly inputs: Bits
  readonly tests: readonly TestRecord[]
  /** The slots the player has marked as faulty, in the order marked. */
  readonly diagnosis: readonly string[]
  readonly mistakes: number
  readonly status: GameStatus
}

export type DiagnosisOutcome =
  | { readonly kind: 'correct' }
  /** Marks don't add up to the number of stuck gates; nothing is charged. */
  | { readonly kind: 'wrongCount'; readonly expected: number }
  /** The marks are not exactly the real faults. Deliberately says nothing about which. */
  | { readonly kind: 'wrong' }

/** Every wire's value for a fault set on one input vector. */
export function observe(level: FaultLevel, faults: FaultMap, inputs: Bits): Bits {
  return simulateCircuit(level, inputs, faults) as Bits
}

export function faultCount(level: FaultLevel): number {
  return Object.keys(level.faults).length
}

export function startGame(level: FaultLevel): FaultGame {
  return {
    level,
    inputs: Object.fromEntries(level.primaryInputs.map((id) => [id, 0])),
    tests: [],
    diagnosis: [],
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

export function testsLeft(game: FaultGame): number {
  return game.level.testBudget - game.tests.length
}

/** Runs the current inputs through the real (faulty) board and logs every wire. */
export function runTest(game: FaultGame): FaultGame {
  if (game.status !== 'playing' || testsLeft(game) <= 0) return game
  const { level, inputs } = game
  return { ...game, tests: [...game.tests, { inputs, wires: observe(level, level.faults, inputs) }] }
}

/** The latest test run with exactly these inputs, if any. */
export function testMatching(game: FaultGame, inputs: Bits): number | null {
  for (let index = game.tests.length - 1; index >= 0; index -= 1) {
    const test = game.tests[index]
    if (game.level.primaryInputs.every((id) => test.inputs[id] === inputs[id])) return index
  }
  return null
}

/** Marks a gate as faulty, or clears the mark if it already has one. */
export function toggleMark(game: FaultGame, slotId: string): FaultGame {
  if (game.status !== 'playing' || !Object.hasOwn(game.level.slots, slotId)) return game
  const diagnosis = game.diagnosis.includes(slotId)
    ? game.diagnosis.filter((id) => id !== slotId)
    : [...game.diagnosis, slotId]
  return { ...game, diagnosis }
}

/** All-or-nothing: the marked gates must be exactly the faulty ones. */
export function submitDiagnosis(game: FaultGame): { readonly outcome: DiagnosisOutcome; readonly game: FaultGame } {
  const expected = faultCount(game.level)
  if (game.status !== 'playing') return { outcome: { kind: 'wrongCount', expected }, game }
  if (game.diagnosis.length !== expected) {
    return { outcome: { kind: 'wrongCount', expected }, game }
  }
  if (game.diagnosis.every((slotId) => Object.hasOwn(game.level.faults, slotId))) {
    return { outcome: { kind: 'correct' }, game: { ...game, status: 'won' } }
  }
  const mistakes = game.mistakes + 1
  const status: GameStatus = mistakes >= game.level.maxMistakes ? 'lost' : 'playing'
  return { outcome: { kind: 'wrong' }, game: { ...game, mistakes, status } }
}
