import { describe, expect, it } from 'vitest'
import { faultLevels, faultTutorialLevel } from '../content/faultLevelCatalog'
import { loadFaultLevel } from '../content/faultLevelLoader'
import { FaultLevelError, allInputRows, analyzeFaultLevel, exposedFaults } from './faultAnalyzer'

function chain(overrides: Record<string, unknown> = {}) {
  return loadFaultLevel({
    id: 'chain', title: 'Chain',
    primaryInputs: ['A', 'B', 'C'], primaryOutputs: ['Z'],
    slots: {
      g_xor: {
        id: 'g_xor', assignedGate: 'XOR', outputWireId: 'w_xor',
        inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'B' }],
      },
      g_and: {
        id: 'g_and', assignedGate: 'AND', outputWireId: 'Z',
        inputs: [{ sourceType: 'SLOT_OUTPUT', sourceId: 'g_xor' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'C' }],
      },
    },
    faults: { g_and: 0 }, testBudget: 3, maxMistakes: 2,
    ...overrides,
  })
}

describe('allInputRows', () => {
  it('counts through every assignment in order', () => {
    expect(allInputRows(chain()).map((row) => `${row.A}${row.B}${row.C}`))
      .toEqual(['000', '001', '010', '011', '100', '101', '110', '111'])
  })
})

describe('analyzeFaultLevel', () => {
  it('needs one test that excites the stuck gate, since every wire is visible', () => {
    // A≠B with C=1 makes the AND's inputs both 1, so "stuck at 0" shows on its output wire.
    expect(analyzeFaultLevel(chain())).toEqual({ levelId: 'chain', minTests: 1 })
    expect(exposedFaults(chain(), { A: 1, B: 0, C: 1 })).toEqual(['g_and'])
    // With C=0 the AND should give 0 anyway, so being stuck at 0 is invisible.
    expect(exposedFaults(chain(), { A: 1, B: 0, C: 0 })).toEqual([])
  })

  it('rejects a test budget below what a perfect player needs', () => {
    // AND stuck at 0 only shows when A=B=1; OR stuck at 1 only shows when A=B=0. Two tests minimum.
    const twoFaults = (testBudget: number) => loadFaultLevel({
      id: 'apart', title: 'Apart', primaryInputs: ['A', 'B'], primaryOutputs: ['X', 'Y', 'Z'],
      slots: {
        g_and: {
          id: 'g_and', assignedGate: 'AND', outputWireId: 'Y',
          inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'B' }],
        },
        g_or: {
          id: 'g_or', assignedGate: 'OR', outputWireId: 'Z',
          inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'B' }],
        },
        // A healthy bystander gate.
        g_xor: {
          id: 'g_xor', assignedGate: 'XOR', outputWireId: 'X',
          inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'B' }],
        },
      },
      faults: { g_and: 0, g_or: 1 }, testBudget, maxMistakes: 1,
    })
    expect(() => analyzeFaultLevel(twoFaults(1))).toThrow(FaultLevelError)
    expect(analyzeFaultLevel(twoFaults(2)).minTests).toBe(2)
  })

  it('rejects a fault that cannot be seen at all', () => {
    // XOR(A, A) is always 0, so "stuck at 0" changes nothing, even with every wire visible.
    const level = loadFaultLevel({
      id: 'silent', title: 'Silent', primaryInputs: ['A'], primaryOutputs: ['Z'],
      slots: {
        g: {
          id: 'g', assignedGate: 'XOR', outputWireId: 'Z',
          inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'A' }],
        },
      },
      faults: { g: 0 }, testBudget: 2, maxMistakes: 1,
    })
    expect(() => analyzeFaultLevel(level)).toThrow(/never shows/)
  })
})

describe('shipped levels', () => {
  it.each([...faultLevels, faultTutorialLevel].map((level) => [level.id, level] as const))('%s is solvable within its budgets', (_, level) => {
    const analysis = analyzeFaultLevel(level)
    expect(analysis.minTests).toBeLessThanOrEqual(level.testBudget)
  })

  it('have unique IDs and titles', () => {
    expect(new Set(faultLevels.map((level) => level.id)).size).toBe(faultLevels.length)
    expect(new Set(faultLevels.map((level) => level.title)).size).toBe(faultLevels.length)
  })
})
