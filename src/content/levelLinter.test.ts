import { describe, expect, it } from 'vitest'
import { LevelLintError, lintLevel } from './levelLinter'
import { LevelValidationError } from './levelLoader'

function fixture() {
  return {
    id: 'and-puzzle', title: 'Build AND', difficulty: 'EASY',
    availableGatePalette: { AND: 1, OR: 1, XOR: 1 },
    primaryInputs: ['a', 'b'], primaryOutputs: ['y'],
    slots: {
      output: {
        id: 'output', allowedGates: ['OR', 'XOR', 'AND'],
        inputs: [
          { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
          { sourceType: 'PRIMARY_INPUT', sourceId: 'b' },
        ],
        outputWireId: 'y',
      },
    },
    truthTableTarget: [
      { inputs: { a: 0, b: 0 }, expected: { y: 0 } },
      { inputs: { a: 0, b: 1 }, expected: { y: 0 } },
      { inputs: { a: 1, b: 0 }, expected: { y: 0 } },
      { inputs: { a: 1, b: 1 }, expected: { y: 1 } },
    ],
    hints: [],
  }
}

describe('lintLevel', () => {
  it('finds one assignment that satisfies all rows, from JSON text or an object', () => {
    const expected = { levelId: 'and-puzzle', solution: { output: 'AND' } }
    expect(lintLevel(fixture())).toEqual(expected)
    expect(lintLevel(JSON.stringify(fixture()))).toEqual(expected)
  })

  it('does not mutate the level, palette, or target rows', () => {
    const level = fixture()
    const before = structuredClone(level)
    lintLevel(level)
    expect(level).toEqual(before)
  })

  it('requires the same gate assignment across every row', () => {
    const level = fixture()
    level.availableGatePalette.AND = 0
    expect(() => lintLevel(level)).toThrow('no complete solvable assignment')
  })

  it('honors slot restrictions even when a solving gate exists in the palette', () => {
    const level = fixture()
    level.slots.output.allowedGates = ['OR']
    expect(() => lintLevel(level)).toThrow(LevelLintError)
  })

  it('allows unrestricted slots but filters gate arity', () => {
    const level = fixture()
    const { allowedGates, ...output } = level.slots.output
    expect(allowedGates).toContain('AND')
    expect(lintLevel({ ...level, availableGatePalette: { NOT: 2, AND: 1 },
      slots: { output },
    }).solution).toEqual({ output: 'AND' })
  })

  function twoStep() {
    const level = fixture()
    return { ...level, availableGatePalette: { AND: 1, OR: 1 }, slots: {
      // Authored in reverse dependency order to exercise the compiled DAG.
      finish: { id: 'finish', allowedGates: ['AND'], outputWireId: 'y', inputs: [
        { sourceType: 'SLOT_OUTPUT', sourceId: 'start' },
        { sourceType: 'SLOT_OUTPUT', sourceId: 'start' },
      ] },
      start: { ...level.slots.output, id: 'start', outputWireId: 'middle', allowedGates: ['AND', 'OR'] },
    }, truthTableTarget: level.truthTableTarget.map((row) => ({
      ...row, expected: { y: row.inputs.a === 1 || row.inputs.b === 1 ? 1 : 0 },
    })) }
  }

  it('backtracks and restores inventory when an earlier gate uses the final slot’s gate', () => {
    expect(lintLevel(twoStep()).solution).toEqual({ start: 'OR', finish: 'AND' })
  })

  it('rejects a level that needs more gates than the palette contains', () => {
    expect(() => lintLevel({ ...twoStep(), availableGatePalette: { AND: 1 } }))
      .toThrow('no complete solvable assignment')
  })

  it('requires enough inventory to fill slots outside an output dependency path', () => {
    const level = fixture()
    const extra = { ...level.slots.output, id: 'extra', outputWireId: 'unused' }
    expect(() => lintLevel({ ...level, availableGatePalette: { AND: 1 },
      slots: { ...level.slots, extra },
    })).toThrow('no complete solvable assignment')
  })

  it('checks every primary output', () => {
    const level = fixture()
    const extra = { id: 'invert', allowedGates: ['NOT'], outputWireId: 'z', inputs: [
      { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
    ] }
    const multiple = { ...level, primaryOutputs: ['y', 'z'],
      availableGatePalette: { AND: 1, NOT: 1 }, slots: { ...level.slots, invert: extra },
      truthTableTarget: level.truthTableTarget.map((row) => ({
        ...row, expected: { ...row.expected, z: row.inputs.a === 0 ? 1 : 0 },
      })),
    }
    expect(lintLevel(multiple).solution).toEqual({ invert: 'NOT', output: 'AND' })
    multiple.truthTableTarget[0].expected.z = 0
    expect(() => lintLevel(multiple)).toThrow('no complete solvable assignment')
  })

  it('reports a slot with no available matching gate', () => {
    expect(() => lintLevel({ ...fixture(), availableGatePalette: { NOT: 1 } }))
      .toThrow('slots.output: no allowed gate with matching pin count')
  })

  it.each([
    ['disconnected pin', [{ sourceType: 'PRIMARY_INPUT', sourceId: 'missing' }], 'sourceId'],
    ['self cycle', [
      { sourceType: 'SLOT_OUTPUT', sourceId: 'output' },
      { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
    ], 'cycle'],
    ['missing pin', [], 'inputs'],
  ])('reuses loader validation for %s', (_name, inputs, message) => {
    const level = fixture()
    const invalid = { ...level, slots: { output: { ...level.slots.output,
      allowedGates: undefined, inputs,
    } } }
    expect(() => lintLevel(invalid)).toThrow(LevelValidationError)
    expect(() => lintLevel(invalid)).toThrow(message)
  })

  it('rejects malformed JSON', () => {
    expect(() => lintLevel('{')).toThrow('invalid JSON syntax')
  })

  it('reports a search limit as unproven rather than unsolvable', () => {
    expect(() => lintLevel(twoStep(), { maxSearchSteps: 1 })).toThrow('solvability is unproven')
  })

  it.each([0, -1, 1.5, Infinity])('rejects an invalid search limit %s', (maxSearchSteps) => {
    expect(() => lintLevel(fixture(), { maxSearchSteps })).toThrow('positive safe integer')
  })
})
