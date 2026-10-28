import type { CircuitSlot, GateType, LevelConfig, SignalSource } from '../types/circuit'

export const GATE_TYPES: readonly GateType[] = [
  'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR',
]

export class LevelValidationError extends Error {
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`)
    this.name = 'LevelValidationError'
  }
}

function fail(path: string, reason: string): never {
  throw new LevelValidationError(path, reason)
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'expected an object')
  }
  return value as Record<string, unknown>
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'expected an array')
  // Object callers can supply sparse arrays even though JSON cannot.
  return Array.from(value)
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'expected a nonempty string')
  }
  return value
}

function identifiers(value: unknown, path: string): string[] {
  const ids = list(value, path).map((id, index) => text(id, `${path}[${index}]`))
  if (new Set(ids).size !== ids.length) fail(path, 'IDs must be unique')
  return ids
}

export function isGateType(value: unknown): value is GateType {
  return typeof value === 'string' && GATE_TYPES.some((gate) => gate === value)
}

function palette(value: unknown): Record<GateType, number> {
  const authored = record(value, 'availableGatePalette')
  for (const [gate, count] of Object.entries(authored)) {
    if (!isGateType(gate)) fail(`availableGatePalette.${gate}`, 'unknown gate type')
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
      fail(`availableGatePalette.${gate}`, 'expected a nonnegative safe integer')
    }
  }
  return Object.fromEntries(GATE_TYPES.map((gate) => [gate, authored[gate] ?? 0])) as Record<GateType, number>
}

function source(value: unknown, path: string): SignalSource {
  const input = record(value, path)
  const sourceType = input.sourceType
  if (sourceType !== 'PRIMARY_INPUT' && sourceType !== 'SLOT_OUTPUT') {
    fail(`${path}.sourceType`, 'expected PRIMARY_INPUT or SLOT_OUTPUT')
  }
  return { sourceType, sourceId: text(input.sourceId, `${path}.sourceId`) }
}

function slots(value: unknown): Record<string, CircuitSlot> {
  const authored = record(value, 'slots')
  const parsed = Object.entries(authored).map(([key, value]) => {
    text(key, 'slots key')
    const path = `slots.${key}`
    const slot = record(value, path)
    const id = text(slot.id, `${path}.id`)
    if (id !== key) fail(`${path}.id`, 'must match the slot record key')
    const inputs = list(slot.inputs, `${path}.inputs`).map((input, index) =>
      source(input, `${path}.inputs[${index}]`),
    )
    if (inputs.length !== 1 && inputs.length !== 2) {
      fail(`${path}.inputs`, 'supported gates require one or two input pins')
    }
    let allowedGates: GateType[] | undefined
    if (slot.allowedGates !== undefined) {
      allowedGates = list(slot.allowedGates, `${path}.allowedGates`).map((gate, index) => {
        if (!isGateType(gate)) fail(`${path}.allowedGates[${index}]`, 'unknown gate type')
        const arity = gate === 'NOT' ? 1 : 2
        if (inputs.length !== arity) {
          fail(`${path}.inputs`, `${gate} requires ${arity} input pin(s)`)
        }
        return gate
      })
      if (allowedGates.length === 0 || new Set(allowedGates).size !== allowedGates.length) {
        fail(`${path}.allowedGates`, 'expected a nonempty list of distinct gates')
      }
    }
    const parsedSlot: CircuitSlot = {
      id,
      ...(allowedGates === undefined ? {} : { allowedGates }),
      inputs,
      outputWireId: text(slot.outputWireId, `${path}.outputWireId`),
    }
    return [key, parsedSlot] as const
  })
  if (parsed.length === 0) fail('slots', 'expected at least one circuit slot')
  return Object.fromEntries(parsed)
}

function validateWiring(
  circuitSlots: Record<string, CircuitSlot>,
  primaryInputs: string[],
  primaryOutputs: string[],
): void {
  const inputIds = new Set(primaryInputs)
  const wireIds = new Set<string>()
  for (const slot of Object.values(circuitSlots)) {
    const path = `slots.${slot.id}`
    if (wireIds.has(slot.outputWireId) || inputIds.has(slot.outputWireId)) {
      fail(`${path}.outputWireId`, 'wire IDs must be unique and distinct from primary input IDs')
    }
    wireIds.add(slot.outputWireId)
    for (const [index, input] of slot.inputs.entries()) {
      const exists = input.sourceType === 'PRIMARY_INPUT'
        ? inputIds.has(input.sourceId)
        : Object.hasOwn(circuitSlots, input.sourceId)
      if (!exists) {
        fail(`${path}.inputs[${index}].sourceId`, `unknown ${input.sourceType} reference ${input.sourceId}`)
      }
    }
  }
  for (const output of primaryOutputs) {
    if (!wireIds.has(output)) fail('primaryOutputs', `${output} is not produced by any slot`)
  }
}

/** Compile once at load time; choose the smallest ready slot ID for stable ordering. */
function executionOrder(circuitSlots: Record<string, CircuitSlot>): string[] {
  const dependencies = new Map<string, Set<string>>()
  const consumers = new Map<string, string[]>()
  for (const slot of Object.values(circuitSlots)) {
    // Two pins may legitimately refer to the same upstream slot.
    const parents = new Set(slot.inputs
      .filter((input) => input.sourceType === 'SLOT_OUTPUT')
      .map((input) => input.sourceId))
    dependencies.set(slot.id, parents)
    for (const parent of parents) {
      const children = consumers.get(parent) ?? []
      children.push(slot.id)
      consumers.set(parent, children)
    }
  }
  const ready = [...dependencies.keys()].filter((id) => dependencies.get(id)!.size === 0).sort()
  const order: string[] = []
  while (ready.length > 0) {
    const id = ready.shift()!
    order.push(id)
    for (const child of consumers.get(id) ?? []) {
      const parents = dependencies.get(child)!
      parents.delete(id)
      if (parents.size === 0) {
        ready.push(child)
        ready.sort()
      }
    }
  }
  if (order.length !== dependencies.size) {
    const blocked = [...dependencies.keys()].filter((id) => !order.includes(id)).sort()
    fail('slots', `cycle detected; blocked slots: ${blocked.join(', ')}`)
  }
  return order
}

function binaryValues(value: unknown, expectedIds: string[], path: string): Record<string, 0 | 1> {
  const values = record(value, path)
  if (Object.keys(values).length !== expectedIds.length
    || expectedIds.some((id) => !Object.hasOwn(values, id))) {
    fail(path, `expected exactly these keys: ${expectedIds.join(', ')}`)
  }
  return Object.fromEntries(expectedIds.map((id) => {
    const bit = values[id]
    if (bit !== 0 && bit !== 1) fail(`${path}.${id}`, 'expected binary value 0 or 1')
    return [id, bit]
  }))
}

/** Parse and compile untrusted level JSON without mutating the supplied object. */
export function loadLevel(input: unknown): LevelConfig {
  let parsed = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input) as unknown
    } catch {
      fail('level', 'invalid JSON syntax')
    }
  }
  const level = record(parsed, 'level')
  const id = text(level.id, 'id')
  const title = text(level.title, 'title')
  const difficulty = level.difficulty
  if (difficulty !== 'EASY' && difficulty !== 'HARD') {
    fail('difficulty', 'expected EASY or HARD')
  }
  const availableGatePalette = palette(level.availableGatePalette)
  const primaryInputs = identifiers(level.primaryInputs, 'primaryInputs')
  const primaryOutputs = identifiers(level.primaryOutputs, 'primaryOutputs')
  if (primaryInputs.length === 0) fail('primaryInputs', 'expected at least one input')
  if (primaryOutputs.length === 0) fail('primaryOutputs', 'expected at least one output')
  const circuitSlots = slots(level.slots)
  validateWiring(circuitSlots, primaryInputs, primaryOutputs)
  const order = executionOrder(circuitSlots)
  const truthTableTarget = list(level.truthTableTarget, 'truthTableTarget').map((value, index) => {
    const path = `truthTableTarget[${index}]`
    const row = record(value, path)
    return {
      inputs: binaryValues(row.inputs, primaryInputs, `${path}.inputs`),
      expected: binaryValues(row.expected, primaryOutputs, `${path}.expected`),
    }
  })
  if (truthTableTarget.length === 0) fail('truthTableTarget', 'expected at least one target row')
  const hints = list(level.hints, 'hints').map((value, index) => {
    const path = `hints[${index}]`
    const hint = record(value, path)
    const message = text(hint.message, `${path}.message`)
    if (hint.triggerSlotId === undefined) return { message }
    const triggerSlotId = text(hint.triggerSlotId, `${path}.triggerSlotId`)
    if (!Object.hasOwn(circuitSlots, triggerSlotId)) fail(`${path}.triggerSlotId`, 'unknown slot')
    return { triggerSlotId, message }
  })
  return {
    id, title, difficulty, availableGatePalette, primaryInputs, primaryOutputs,
    slots: circuitSlots, truthTableTarget, hints, executionOrder: order,
  }
}
