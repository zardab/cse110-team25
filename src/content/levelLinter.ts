import type { GateType, PrimaryInputValues, SignalState } from '../types/circuit'
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
  readonly solution: Readonly<Record<string, GateType>>
  readonly primaryInputs: PrimaryInputValues
}

export interface LevelLintOptions {
  readonly primaryInputs?: PrimaryInputValues
  readonly maxSearchSteps?: number
}

/** Find a complete placement reaching targetOutputs for supplied or searched inputs. */
export function lintLevel(
  input: unknown,
  { primaryInputs, maxSearchSteps = 1_000_000 }: LevelLintOptions = {},
): LevelLintResult {
  const level = loadLevel(input)
  if (!Number.isSafeInteger(maxSearchSteps) || maxSearchSteps < 1) {
    throw new LevelLintError('maxSearchSteps must be a positive safe integer')
  }
  if (primaryInputs !== undefined && (primaryInputs === null || typeof primaryInputs !== 'object'
    || Array.isArray(primaryInputs) || Object.keys(primaryInputs).length !== level.primaryInputs.length
    || level.primaryInputs.some((id) => !Object.hasOwn(primaryInputs, id)
      || (primaryInputs[id] !== 0 && primaryInputs[id] !== 1)))) {
    throw new LevelLintError(`primaryInputs must contain exactly the declared input IDs with binary values: ${level.primaryInputs.join(', ')}`)
  }
  const order = level.executionOrder
  const remaining = { ...level.availableGatePalette }
  const assigned = new Map<string, GateType>()
  const inputs = new Map<string, 0 | 1>()
  const values = new Map<string, SignalState>()
  const outputs = new Set(level.primaryOutputs)
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
  function step(): void {
    steps += 1
    if (steps > maxSearchSteps) {
      throw new LevelLintError(`${level.id}: solvability search exceeded ${maxSearchSteps} steps; simplify the level or raise maxSearchSteps (solvability is unproven)`)
    }
  }

  function place(index: number): boolean {
    if (index === order.length) return true
    const id = order[index]
    const slot = level.slots[id]
    for (const gate of candidates[index]) {
      if (remaining[gate] === 0) continue
      step()
      remaining[gate] -= 1
      assigned.set(id, gate)
      const value = evaluateGate(gate, slot.inputs.map((source) => source.sourceType === 'PRIMARY_INPUT'
        ? inputs.get(source.sourceId)!
        : values.get(source.sourceId)!))
      values.set(id, value)
      const matches = !outputs.has(slot.outputWireId) || value === level.targetOutputs[slot.outputWireId]
      if (matches && place(index + 1)) return true
      remaining[gate] += 1
      assigned.delete(id)
    }
    return false
  }

  function chooseInputs(index: number): boolean {
    if (index === level.primaryInputs.length) {
      values.clear()
      return place(0)
    }
    const id = level.primaryInputs[index]
    for (const bit of [0, 1] as const) {
      step()
      inputs.set(id, bit)
      if (chooseInputs(index + 1)) return true
    }
    inputs.delete(id)
    return false
  }

  let solved: boolean
  if (primaryInputs !== undefined) {
    for (const id of level.primaryInputs) inputs.set(id, primaryInputs[id])
    solved = place(0)
  } else {
    solved = chooseInputs(0)
  }
  if (!solved) {
    throw new LevelLintError(`${level.id}: no complete solvable assignment reaches targetOutputs within the palette counts and slot restrictions${primaryInputs === undefined ? '' : ' for the supplied primary inputs'}`)
  }
  return { levelId: level.id, solution: Object.fromEntries(assigned), primaryInputs: Object.fromEntries(inputs) }
}
