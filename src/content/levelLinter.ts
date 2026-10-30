import type { AssignedGates, GateType, SignalState } from '../types/circuit'
import { evaluateGate } from '../simulation/gates.ts'
import { GATE_TYPES, loadLevel } from './levelLoader.ts'

export class LevelLintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LevelLintError'
  }
}

export interface LevelLintResult {
  readonly levelId: string
  readonly solution: AssignedGates
}

/** Validate wiring, then find one complete assignment satisfying every target row. */
export function lintLevel(
  input: unknown,
  { maxSearchSteps = 1_000_000 }: { maxSearchSteps?: number } = {},
): LevelLintResult {
  const level = loadLevel(input)
  if (!Number.isSafeInteger(maxSearchSteps) || maxSearchSteps < 1) {
    throw new LevelLintError('maxSearchSteps must be a positive safe integer')
  }
  const order = level.executionOrder
  const remaining = { ...level.availableGatePalette }
  const assigned = new Map<string, GateType>()
  const outputs = new Set(level.primaryOutputs)
  const rows = level.truthTableTarget.map((target) => ({
    target,
    values: new Map<string, SignalState>(),
  }))
  const candidates = order.map((id) => {
    const slot = level.slots[id]
    const gates = (slot.allowedGates ?? GATE_TYPES).filter((gate) =>
      (gate === 'NOT' ? 1 : 2) === slot.inputs.length && remaining[gate] > 0,
    )
    if (gates.length === 0) {
      throw new LevelLintError(`${level.id}: slots.${id}: no allowed gate with matching pin count is available in the palette`)
    }
    return gates
  })
  let steps = 0

  function search(index: number): boolean {
    if (index === order.length) return true
    const id = order[index]
    const slot = level.slots[id]
    for (const gate of candidates[index]) {
      if (remaining[gate] === 0) continue
      steps += 1
      if (steps > maxSearchSteps) {
        throw new LevelLintError(`${level.id}: solvability search exceeded ${maxSearchSteps} steps; simplify the level or raise maxSearchSteps (solvability is unproven)`)
      }
      remaining[gate] -= 1
      assigned.set(id, gate)
      const matches = rows.every(({ target, values }) => {
        const inputs = slot.inputs.map((source) => source.sourceType === 'PRIMARY_INPUT'
          ? target.inputs[source.sourceId]
          : values.get(source.sourceId)!)
        const value = evaluateGate(gate, inputs)
        values.set(id, value)
        return !outputs.has(slot.outputWireId) || value === target.expected[slot.outputWireId]
      })
      if (matches && search(index + 1)) return true
      remaining[gate] += 1
      assigned.delete(id)
    }
    return false
  }

  if (!search(0)) {
    throw new LevelLintError(`${level.id}: no complete solvable assignment satisfies all truth-table rows within the palette counts and slot restrictions`)
  }
  return { levelId: level.id, solution: Object.fromEntries(assigned) }
}
