import type { CompiledCircuit, Fault, FaultMap } from '../types/circuit'
import { LevelValidationError, compileCircuit, isGateType } from './levelLoader'

/**
 * A "Fault Finder" level: a complete circuit in which some gates are secretly stuck.
 * The player runs tests, sees every wire, and works out which gates are stuck.
 */
export interface FaultLevel extends CompiledCircuit {
  readonly id: string
  readonly title: string
  /** The real faults: stuck at 0/1, or acting like another gate. The player is told how many, not where. */
  readonly faults: FaultMap
  /** How many test vectors the player may run. */
  readonly testBudget: number
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
  if (entries.length === 0) fail('faults', 'expected at least one faulty gate')
  return Object.fromEntries(entries.map(([slotId, fault]): [string, Fault] => {
    const path = `faults.${slotId}`
    if (!Object.hasOwn(circuit.slots, slotId)) fail(path, 'unknown slot')
    if (fault === 0 || fault === 1) return [slotId, fault]
    if (!isGateType(fault)) fail(path, 'expected a stuck-at value of 0 or 1, or a gate type')
    const slot = circuit.slots[slotId]
    if (fault === slot.assignedGate) fail(path, `acting like its own gate (${fault}) is not a fault`)
    if ((fault === 'NOT' ? 1 : 2) !== slot.inputs.length) fail(path, `${fault} does not fit a gate with ${slot.inputs.length} input(s)`)
    return [slotId, fault]
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
  const circuit = compileCircuit(level)
  if (circuit.primaryInputs.length > MAX_FAULT_LEVEL_INPUTS) {
    fail('primaryInputs', `expected at most ${MAX_FAULT_LEVEL_INPUTS} inputs`)
  }
  for (const slot of Object.values(circuit.slots)) {
    if (slot.assignedGate === 'NULL') fail(`slots.${slot.id}.assignedGate`, 'fault levels must be complete circuits')
  }
  return {
    id, title, ...circuit,
    faults: faults(level.faults, circuit),
    testBudget: count(level.testBudget, 'testBudget', 1),
    maxMistakes: count(level.maxMistakes, 'maxMistakes', 1),
  }
}
