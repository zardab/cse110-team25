import { describe, expect, it } from 'vitest'
import { loadFaultLevel } from './faultLevelLoader'
import { LevelValidationError } from './levelLoader'

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pair', title: 'Pair',
    primaryInputs: ['A', 'B'], primaryOutputs: ['Z'],
    slots: {
      g: {
        id: 'g', assignedGate: 'AND', outputWireId: 'Z',
        inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'B' }],
      },
    },
    faults: { g: 1 }, testBudget: 2, maxMistakes: 2,
    ...overrides,
  }
}

describe('loadFaultLevel', () => {
  it('compiles a valid level from an object or JSON text', () => {
    const level = loadFaultLevel(fixture())
    expect(level.executionOrder).toEqual(['g'])
    expect(level.faults).toEqual({ g: 1 })
    expect(loadFaultLevel(JSON.stringify(fixture()))).toEqual(level)
  })

  it('accepts a gate acting like another gate', () => {
    expect(loadFaultLevel(fixture({ faults: { g: 'OR' } })).faults).toEqual({ g: 'OR' })
  })

  it.each([
    ['faults on an unknown slot', { faults: { nope: 1 } }, /faults\.nope/],
    ['a stuck-at value other than 0 or 1', { faults: { g: 2 } }, /stuck-at/],
    ['an unknown gate type', { faults: { g: 'MAYBE' } }, /gate type/],
    ['acting like its own gate', { faults: { g: 'AND' } }, /not a fault/],
    ['a substitute gate with the wrong number of inputs', { faults: { g: 'NOT' } }, /does not fit/],
    ['no faults at all', { faults: {} }, /at least one faulty gate/],
    ['a zero test budget', { testBudget: 0 }, /testBudget/],
    ['a missing title', { title: '' }, /title/],
    ['too many inputs', { primaryInputs: ['A', 'B', 'C', 'D', 'E', 'F'] }, /at most 5/],
  ])('rejects %s', (_, overrides, message) => {
    expect(() => loadFaultLevel(fixture(overrides))).toThrow(LevelValidationError)
    expect(() => loadFaultLevel(fixture(overrides))).toThrow(message)
  })

  it('rejects an empty slot, since the design under test must be complete', () => {
    const slots = { g: { ...fixture().slots.g, assignedGate: 'NULL' } }
    expect(() => loadFaultLevel(fixture({ slots }))).toThrow(/complete circuits/)
  })

  it('still runs the shared wiring checks', () => {
    expect(() => loadFaultLevel(fixture({ primaryOutputs: ['Q'] }))).toThrow(/not produced by any slot/)
  })
})
