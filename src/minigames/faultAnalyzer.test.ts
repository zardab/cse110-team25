import { describe, expect, it } from 'vitest'
import { faultLevels } from '../content/faultLevelCatalog'
import { loadFaultLevel } from '../content/faultLevelLoader'
import { FaultLevelError, allInputRows, analyzeFaultLevel } from './faultAnalyzer'

function chain(overrides: Record<string, unknown> = {}) {
  return loadFaultLevel({
    id: 'chain', title: 'Chain', briefing: 'Find it.',
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
    faults: { g_and: 0 }, testBudget: 3, probeBudget: 1, maxMistakes: 2,
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
  it('finds the probe that makes an output-ambiguous fault solvable', () => {
    const analysis = analyzeFaultLevel(chain())
    expect(analysis).toEqual({
      levelId: 'chain', minTests: 1, probes: ['g_xor'], minTestsWithoutProbes: null, rivals: 3,
    })
  })

  it('rejects the same level when no probe is allowed', () => {
    expect(() => analyzeFaultLevel(chain({ probeBudget: 0 }))).toThrow(FaultLevelError)
  })

  it('reports when outputs alone are enough', () => {
    // Stuck at 1 on the AND shows at Z on any row where the design gives 0.
    const analysis = analyzeFaultLevel(chain({ faults: { g_and: 1 } }))
    expect(analysis.minTestsWithoutProbes).toBe(1)
    expect(analysis.minTests).toBe(1)
  })

  it('rejects a test budget below what a perfect player needs', () => {
    // The healthy board and "g_xor stuck 1" agree on A≠B, so one row can't rule out both
    // rivals of a stuck-at-1 XOR... unless the budget allows the rows that do.
    const level = chain({ faults: { g_xor: 1 }, probeBudget: 0, testBudget: 1 })
    const needed = analyzeFaultLevel(chain({ faults: { g_xor: 1 }, probeBudget: 0, testBudget: 8 })).minTests
    if (needed > 1) expect(() => analyzeFaultLevel(level)).toThrow(FaultLevelError)
    else expect(analyzeFaultLevel(level).minTests).toBe(1)
  })

  it('rejects a fault that cannot be seen at all', () => {
    // XOR(A, A) is always 0, so "stuck at 0" changes nothing, even on a probe.
    const level = loadFaultLevel({
      id: 'silent', title: 'Silent', briefing: '.', primaryInputs: ['A'], primaryOutputs: ['Z'],
      slots: {
        g: {
          id: 'g', assignedGate: 'XOR', outputWireId: 'Z',
          inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'A' }, { sourceType: 'PRIMARY_INPUT', sourceId: 'A' }],
        },
      },
      faults: { g: 0 }, testBudget: 2, probeBudget: 1, maxMistakes: 1,
    })
    expect(() => analyzeFaultLevel(level)).toThrow(/single out/)
  })
})

describe('shipped levels', () => {
  it.each(faultLevels.map((level) => [level.id, level] as const))('%s is solvable within its budgets', (_, level) => {
    const analysis = analyzeFaultLevel(level)
    expect(analysis.minTests).toBeLessThanOrEqual(level.testBudget)
    expect(analysis.probes.length).toBeLessThanOrEqual(level.probeBudget)
  })

  it('have unique IDs and titles', () => {
    expect(new Set(faultLevels.map((level) => level.id)).size).toBe(faultLevels.length)
    expect(new Set(faultLevels.map((level) => level.title)).size).toBe(faultLevels.length)
  })

  it('make the probe mechanic matter on at least one level', () => {
    expect(faultLevels.some((level) => analyzeFaultLevel(level).minTestsWithoutProbes === null)).toBe(true)
  })
})
