import type { CompiledCircuit, FaultMap, StuckAt } from '../types/circuit'
import { LevelValidationError, compileCircuit } from './levelLoader'

/**
 * A "Fault Finder" level: a complete, working circuit design in which some gates are
 * secretly stuck. The player runs tests and attaches probes to work out which ones.
 */
export interface FaultLevel extends CompiledCircuit {
  readonly id: string
  readonly title: string
  /** One or two sentences shown before the first test. */
  readonly briefing: string
  /** The real faults. The player is told how many there are, not where. */
  readonly faults: FaultMap
  /** How many test vectors the player may run. */
  readonly testBudget: number
  /** How many internal wires the player may attach a probe to. */
  readonly probeBudget: number
  /** Wrong diagnoses allowed before the board is lost. */
  readonly maxMistakes: number
}

/** More inputs than this makes the analyzer's exhaustive checks slow for no gameplay gain. */
export const MAX_FAULT_LEVEL_INPUTS = 5

function fail(path: string, reason: string): never {
  throw new LevelValidationError(path, reason)
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'expected a nonempty string')
  return value
}

function count(value: unknown, path: string, min: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    fail(path, `expected a safe integer of at least ${min}`)
  }
  return value
}

function faults(value: unknown, circuit: CompiledCircuit): FaultMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('faults', 'expected an object')
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) fail('faults', 'expected at least one stuck gate')
  return Object.fromEntries(entries.map(([slotId, stuckAt]) => {
    if (!Object.hasOwn(circuit.slots, slotId)) fail(`faults.${slotId}`, 'unknown slot')
    if (stuckAt !== 0 && stuckAt !== 1) fail(`faults.${slotId}`, 'expected a stuck-at value of 0 or 1')
    return [slotId, stuckAt as StuckAt]
  }))
}

/** Parse and validate an untrusted fault level without mutating the supplied object. */
export function loadFaultLevel(input: unknown): FaultLevel {
  let parsed = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input) as unknown
    } catch {
      fail('level', 'invalid JSON syntax')
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) fail('level', 'expected an object')
  const level = parsed as Record<string, unknown>
  const id = text(level.id, 'id')
  const title = text(level.title, 'title')
  const briefing = text(level.briefing, 'briefing')
  const circuit = compileCircuit(level)
  if (circuit.primaryInputs.length > MAX_FAULT_LEVEL_INPUTS) {
    fail('primaryInputs', `expected at most ${MAX_FAULT_LEVEL_INPUTS} inputs`)
  }
  for (const slot of Object.values(circuit.slots)) {
    if (slot.assignedGate === 'NULL') fail(`slots.${slot.id}.assignedGate`, 'fault levels must be complete circuits')
  }
  return {
    id, title, briefing, ...circuit,
    faults: faults(level.faults, circuit),
    testBudget: count(level.testBudget, 'testBudget', 1),
    probeBudget: count(level.probeBudget, 'probeBudget', 0),
    maxMistakes: count(level.maxMistakes, 'maxMistakes', 1),
  }
}
