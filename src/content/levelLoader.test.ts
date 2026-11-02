import { describe, expect, it } from 'vitest'
import { GATE_TYPES, LevelValidationError, loadLevel } from './levelLoader'
import { evaluateCircuit } from '../simulation/evaluateCircuit'

function fixture() {
  return {
    id: 'two-step', title: 'Power the light', difficulty: 'EASY',
    availableGatePalette: { NOT: 1, OR: 1 },
    primaryInputs: ['in_A', 'in_B'], primaryOutputs: ['out_Y'],
    // Deliberately authored out of execution order.
    slots: {
      finish: {
        id: 'finish', allowedGates: ['OR'], assignedGate: 'NULL',
        inputs: [
          { sourceType: 'SLOT_OUTPUT', sourceId: 'start' },
          { sourceType: 'PRIMARY_INPUT', sourceId: 'in_B' },
        ],
        outputWireId: 'out_Y',
      },
      start: {
        id: 'start', allowedGates: ['NOT'], assignedGate: 'NULL',
        inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'in_A' }],
        outputWireId: 'wire_not_a',
      },
    },
    targetOutputs: { out_Y: 1 },
    hints: [{ triggerSlotId: 'start', message: 'Try inverting the first input.' }],
  }
}

describe('loadLevel', () => {
  it('loads an object and compiles upstream slots before their consumers', () => {
    const level = loadLevel(fixture())
    expect(level.id).toBe('two-step')
    expect(level.executionOrder).toEqual(['start', 'finish'])
    expect(level.slots.finish.inputs.map((input) => input.sourceId)).toEqual(['start', 'in_B'])
  })

  it('loads JSON text and accepts HARD difficulty', () => {
    expect(loadLevel(JSON.stringify({ ...fixture(), difficulty: 'HARD' })).difficulty).toBe('HARD')
  })

  it('normalizes omitted palette counts to zero', () => {
    expect(loadLevel(fixture()).availableGatePalette).toEqual({
      AND: 0, OR: 1, NOT: 1, XOR: 0, NAND: 0, NOR: 0, XNOR: 0,
    })
    expect(Object.keys(loadLevel(fixture()).availableGatePalette)).toHaveLength(GATE_TYPES.length)
  })

  it('makes defensive copies instead of modifying or retaining authored mutable data', () => {
    const definition = fixture()
    const before = structuredClone(definition)
    const level = loadLevel(definition)
    expect(definition).toEqual(before)
    definition.slots.start.inputs[0].sourceId = 'changed'
    definition.targetOutputs.out_Y = 0
    definition.hints[0].message = 'changed'
    expect(level.slots.start.inputs[0].sourceId).toBe('in_A')
    expect(level.targetOutputs.out_Y).toBe(1)
    expect(level.hints[0].message).not.toBe('changed')
  })

  it('supports omitted slot restrictions and optional hint triggers', () => {
    const definition = fixture()
    const { allowedGates: _allowed, ...unrestricted } = definition.slots.start
    expect(_allowed).toEqual(['NOT'])
    const level = loadLevel({
      ...definition, slots: { ...definition.slots, start: unrestricted },
      hints: [{ message: 'Consider the target output.' }],
    })
    expect(level.slots.start.allowedGates).toBeUndefined()
    expect(level.hints).toEqual([{ message: 'Consider the target output.' }])
  })

  it('uses a stable lexical order for independent ready slots', () => {
    const start = fixture().slots.start
    const a = { ...start, id: 'a', outputWireId: 'wire_a' }
    const z = { ...start, id: 'z', outputWireId: 'wire_z' }
    const definition = { ...fixture(), primaryOutputs: ['wire_a'], hints: [],
      targetOutputs: { wire_a: 1 },
    }
    expect(loadLevel({ ...definition, slots: { z, a } }).executionOrder).toEqual(['a', 'z'])
    expect(loadLevel({ ...definition, slots: { a, z } }).executionOrder).toEqual(['a', 'z'])
  })

  it('handles both pins referencing the same upstream slot', () => {
    const definition = fixture()
    definition.slots.finish.inputs[1] = { sourceType: 'SLOT_OUTPUT', sourceId: 'start' }
    expect(loadLevel(definition).executionOrder).toEqual(['start', 'finish'])
  })

  it.each([
    ['invalid JSON', '{broken', 'JSON'],
    ['null root', null, 'level'],
    ['array root', [], 'level'],
    ['missing title', { ...fixture(), title: undefined }, 'title'],
    ['blank ID', { ...fixture(), id: '  ' }, 'id'],
    ['unsupported difficulty', { ...fixture(), difficulty: 'INTERMEDIATE' }, 'difficulty'],
    ['unknown palette gate', { ...fixture(), availableGatePalette: { MAGIC: 1 } }, 'MAGIC'],
    ['negative inventory', { ...fixture(), availableGatePalette: { OR: -1 } }, 'OR'],
    ['fractional inventory', { ...fixture(), availableGatePalette: { OR: 1.5 } }, 'OR'],
    ['string inventory', { ...fixture(), availableGatePalette: { OR: '1' } }, 'OR'],
    ['unsafe inventory', { ...fixture(), availableGatePalette: { OR: 1e20 } }, 'OR'],
    ['duplicate input IDs', { ...fixture(), primaryInputs: ['in_A', 'in_A'] }, 'unique'],
    ['duplicate output IDs', { ...fixture(), primaryOutputs: ['out_Y', 'out_Y'] }, 'unique'],
    ['unconnected output', { ...fixture(), primaryOutputs: ['unknown'] }, 'primaryOutputs'],
    ['no slots', { ...fixture(), slots: {} }, 'slots'],
    ['missing target outputs', { ...fixture(), targetOutputs: undefined }, 'targetOutputs'],
    ['array target outputs', { ...fixture(), targetOutputs: [] }, 'targetOutputs'],
    ['missing hints', { ...fixture(), hints: undefined }, 'hints'],
    ['non-binary target', { ...fixture(), targetOutputs: { out_Y: 2 } }, 'out_Y'],
    ['boolean target', { ...fixture(), targetOutputs: { out_Y: true } }, 'out_Y'],
    ['missing target key', { ...fixture(), targetOutputs: {} }, 'targetOutputs'],
    ['wrong target key', { ...fixture(), targetOutputs: { other: 1 } }, 'targetOutputs'],
    ['extra target key', { ...fixture(), targetOutputs: { out_Y: 1, other: 0 } }, 'targetOutputs'],
    ['unknown hint slot', { ...fixture(), hints: [{ triggerSlotId: 'missing', message: 'Hint' }] }, 'triggerSlotId'],
  ])('rejects %s with an actionable validation error', (_name, value, detail) => {
    expect(() => loadLevel(value)).toThrow(LevelValidationError)
    expect(() => loadLevel(value)).toThrow(detail)
  })

  it.each([
    ['unknown source', { ...fixture().slots.start,
      inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'missing' }],
    }, 'sourceId'],
    ['unknown slot', { ...fixture().slots.start,
      inputs: [{ sourceType: 'SLOT_OUTPUT', sourceId: 'missing' }],
    }, 'sourceId'],
    ['invalid source kind', { ...fixture().slots.start,
      inputs: [{ sourceType: 'WIRE', sourceId: 'in_A' }],
    }, 'sourceType'],
    ['mismatched slot ID', { ...fixture().slots.start, id: 'other' }, '.id'],
    ['wrong arity', { ...fixture().slots.start, allowedGates: ['AND'] }, 'pin'],
    ['empty restrictions', { ...fixture().slots.start, allowedGates: [] }, 'allowedGates'],
    ['duplicate restrictions', { ...fixture().slots.start, allowedGates: ['NOT', 'NOT'] }, 'allowedGates'],
    ['unknown gate', { ...fixture().slots.start, allowedGates: ['MAGIC'] }, 'allowedGates'],
    ['missing assignment', { ...fixture().slots.start, assignedGate: undefined }, 'assignedGate'],
    ['null assignment', { ...fixture().slots.start, assignedGate: null }, 'assignedGate'],
    ['unknown assignment', { ...fixture().slots.start, assignedGate: 'MAGIC' }, 'assignedGate'],
    ['assigned arity', { ...fixture().slots.start, assignedGate: 'AND' }, 'assignedGate'],
    ['disconnected input', { ...fixture().slots.start, inputs: [] }, 'inputs'],
    ['colliding output wire', { ...fixture().slots.start, outputWireId: 'out_Y' }, 'outputWireId'],
    ['input/wire collision', { ...fixture().slots.start, outputWireId: 'in_A' }, 'outputWireId'],
    ['self-cycle', { ...fixture().slots.start,
      inputs: [{ sourceType: 'SLOT_OUTPUT', sourceId: 'start' }],
    }, 'cycle'],
    ['two-slot cycle', { ...fixture().slots.start,
      inputs: [{ sourceType: 'SLOT_OUTPUT', sourceId: 'finish' }],
    }, 'cycle'],
  ])('rejects a slot with %s', (_name, start, detail) => {
    const definition = fixture()
    expect(() => loadLevel({ ...definition, slots: { ...definition.slots, start } })).toThrow(detail)
  })

  it('loads placements directly usable by the current Track A evaluator', () => {
    const definition = fixture()
    definition.slots.start.assignedGate = 'NOT'
    definition.slots.finish.assignedGate = 'OR'
    const level = loadLevel(definition)
    expect(evaluateCircuit(level, { in_A: 0, in_B: 0 })).toMatchObject({
      isComplete: true, isSolved: true, wireStates: { out_Y: 1 },
    })
    definition.slots.finish.assignedGate = 'NULL'
    expect(evaluateCircuit(loadLevel(definition), { in_A: 0, in_B: 0 }).wireStates.out_Y).toBe('FLOATING')
  })

  it('rejects a disallowed assigned gate and assignments exceeding inventory', () => {
    const definition = fixture()
    definition.slots.finish.assignedGate = 'AND'
    expect(() => loadLevel(definition)).toThrow('not allowed')
    definition.slots.finish.assignedGate = 'OR'
    definition.availableGatePalette.OR = 0
    expect(() => loadLevel(definition)).toThrow('exceed the available palette')
  })
})
