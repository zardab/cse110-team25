import { describe, expect, it } from 'vitest'
import type { PrimaryInputValues } from '../types/circuit'
import { evaluateCircuit } from '../simulation/evaluateCircuit'
import { LevelLintError, lintLevel } from './levelLinter'
import { LevelValidationError, loadLevel } from './levelLoader'

function fixture() {
  return {
    id: 'and-puzzle', title: 'Build AND', difficulty: 'EASY',
    availableGatePalette: { AND: 1, NAND: 1, OR: 1 },
    primaryInputs: ['a', 'b'], primaryOutputs: ['y'], targetOutputs: { y: 1 },
    inputValues: { a: 1, b: 1 },
    slots: {
      output: {
        id: 'output', allowedGates: ['AND'], assignedGate: 'NULL',
        inputs: [
          { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
          { sourceType: 'PRIMARY_INPUT', sourceId: 'b' },
        ], outputWireId: 'y',
      },
    }, hints: [],
  }
}

function twoStep() {
  const level = fixture()
  return { ...level, availableGatePalette: { AND: 1, OR: 1 }, slots: {
    finish: { id: 'finish', assignedGate: 'NULL', allowedGates: ['AND'], outputWireId: 'y', inputs: [
      { sourceType: 'SLOT_OUTPUT', sourceId: 'start' },
      { sourceType: 'SLOT_OUTPUT', sourceId: 'start' },
    ] },
    start: { ...level.slots.output, id: 'start', outputWireId: 'middle', allowedGates: ['AND', 'OR'] },
  } }
}

describe('lintLevel', () => {
  it('returns a placement and input values accepted by the current evaluator', () => {
    const authored = fixture()
    const result = lintLevel(authored)
    expect(result).toEqual({ levelId: 'and-puzzle', solution: { output: 'AND' }, primaryInputs: { a: 1, b: 1 } })
    expect(lintLevel(JSON.stringify(authored))).toEqual(result)
    const compiled = loadLevel(authored)
    const slots = Object.fromEntries(Object.entries(compiled.slots).map(([id, slot]) =>
      [id, { ...slot, assignedGate: result.solution[id] }],
    ))
    expect(evaluateCircuit({ ...compiled, slots }).isSolved).toBe(true)
  })

  it('rejects a puzzle unsolvable for its authored inputs even if other inputs would work', () => {
    const authored = { ...fixture(), inputValues: { a: 0, b: 0 } }
    expect(() => lintLevel(authored)).toThrow('for the level inputValues')
    expect(lintLevel(authored, { primaryInputs: { a: 1, b: 1 } }).solution).toEqual({ output: 'AND' })
  })

  it('checks supplied inputs without substituting different values', () => {
    expect(() => lintLevel(fixture(), { primaryInputs: { a: 0, b: 0 } })).toThrow('for the supplied primary inputs')
    expect(lintLevel(fixture(), { primaryInputs: { a: 1, b: 1 } }).solution).toEqual({ output: 'AND' })
  })

  it('does not mutate level data or caller-supplied inputs', () => {
    const level = fixture()
    const inputs = { a: 1, b: 1 } as const
    const before = structuredClone(level)
    lintLevel(level, { primaryInputs: inputs })
    expect(level).toEqual(before)
    expect(inputs).toEqual({ a: 1, b: 1 })
  })

  it('honors slot restrictions even when another palette gate could solve the target', () => {
    const level = fixture()
    level.slots.output.allowedGates = ['NAND']
    expect(() => lintLevel(level, { primaryInputs: { a: 1, b: 1 } })).toThrow(LevelLintError)
  })

  it('supports unrestricted slots while filtering gate arity', () => {
    const level = fixture()
    const { allowedGates, ...output } = level.slots.output
    expect(allowedGates).toContain('AND')
    expect(lintLevel({ ...level, availableGatePalette: { NOT: 2, AND: 1 }, slots: { output } }).solution)
      .toEqual({ output: 'AND' })
  })

  it('backtracks and restores gate inventory across branches', () => {
    expect(lintLevel(twoStep(), { primaryInputs: { a: 1, b: 0 } }).solution)
      .toEqual({ start: 'OR', finish: 'AND' })
  })

  it('rejects insufficient inventory, including slots outside output dependency paths', () => {
    expect(() => lintLevel({ ...twoStep(), availableGatePalette: { AND: 1 } }))
      .toThrow('no complete solvable assignment')
    const level = fixture()
    const extra = { ...level.slots.output, id: 'extra', outputWireId: 'unused' }
    expect(() => lintLevel({ ...level, availableGatePalette: { AND: 1 }, slots: { ...level.slots, extra } }))
      .toThrow('no complete solvable assignment')
  })

  it('requires all outputs to match for one shared input assignment', () => {
    const level = fixture()
    const invert = { id: 'invert', assignedGate: 'NULL', allowedGates: ['NOT'], outputWireId: 'z', inputs: [
      { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
    ] }
    const multiple = { ...level, primaryOutputs: ['y', 'z'], targetOutputs: { y: 1, z: 0 },
      availableGatePalette: { AND: 1, NOT: 1 }, slots: { ...level.slots, invert },
    }
    expect(lintLevel(multiple).solution).toEqual({ invert: 'NOT', output: 'AND' })
    multiple.targetOutputs.z = 1
    expect(() => lintLevel(multiple)).toThrow('no complete solvable assignment')
  })

  it('reports a slot with no available matching gate', () => {
    expect(() => lintLevel({ ...fixture(), availableGatePalette: { NOT: 1 } }))
      .toThrow('slots.output: no allowed gate with matching pin count')
  })

  it.each([
    ['disconnected pin', [{ sourceType: 'PRIMARY_INPUT', sourceId: 'missing' }], 'sourceId'],
    ['self cycle', [{ sourceType: 'SLOT_OUTPUT', sourceId: 'output' }], 'cycle'],
    ['missing pin', [], 'inputs'],
  ])('reuses loader validation for %s', (_name, inputs, message) => {
    const level = fixture()
    const invalid = { ...level, slots: { output: { ...level.slots.output, allowedGates: undefined, inputs } } }
    expect(() => lintLevel(invalid)).toThrow(LevelValidationError)
    expect(() => lintLevel(invalid)).toThrow(message)
  })

  it('rejects malformed JSON', () => {
    expect(() => lintLevel('{')).toThrow('invalid JSON syntax')
  })

  it('bounds placement searches without claiming an unproven level is impossible', () => {
    expect(() => lintLevel(twoStep(), { maxSearchSteps: 1, primaryInputs: { a: 1, b: 0 } }))
      .toThrow('solvability is unproven')
    expect(() => lintLevel(twoStep(), { maxSearchSteps: 1 })).toThrow('solvability is unproven')
  })

  it.each([0, -1, 1.5, Infinity])('rejects invalid search limit %s', (maxSearchSteps) => {
    expect(() => lintLevel(fixture(), { maxSearchSteps })).toThrow('positive safe integer')
  })

  it.each([null, [], {}, { a: 0 }, { a: true, b: 0 }, { a: 0, b: 0, extra: 1 }])('rejects invalid supplied primary inputs %j', (inputs) => {
      expect(() => lintLevel(fixture(), { primaryInputs: inputs as unknown as PrimaryInputValues }))
        .toThrow('exactly the declared input IDs with binary values')
  })
})
