import { describe, expect, it } from 'vitest'
import { loadFaultLevel } from '../content/faultLevelLoader'
import { simulateCircuit } from '../simulation/evaluateCircuit'
import {
  runTest, setInputs, startGame, submitDiagnosis, testMatching, toggleInput, toggleMark,
} from './faultFinder'

/** XOR(A, B) feeding AND(·, C) → Z, with the AND stuck at 0. */
function chainSpec() {
  return {
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
  }
}

function chain(overrides: Record<string, unknown> = {}) {
  return loadFaultLevel({ ...chainSpec(), ...overrides })
}

describe('simulateCircuit with faults', () => {
  it('forces a stuck slot output regardless of its inputs', () => {
    const level = chain()
    const inputs = { A: 1, B: 0, C: 1 } as const
    expect(simulateCircuit(level, inputs)).toMatchObject({ w_xor: 1, Z: 1 })
    expect(simulateCircuit(level, inputs, { g_and: 0 })).toMatchObject({ w_xor: 1, Z: 0 })
    expect(simulateCircuit(level, inputs, { g_xor: 0 })).toMatchObject({ w_xor: 0, Z: 0 })
    expect(simulateCircuit(level, { A: 0, B: 0, C: 0 }, { g_xor: 1, g_and: 1 })).toMatchObject({ w_xor: 1, Z: 1 })
  })

  it('evaluates a slot acting like another gate as that gate', () => {
    const level = chain()
    // The AND acting like OR: XOR(1, 0)=1 and C=0 gives 1 instead of 0.
    expect(simulateCircuit(level, { A: 1, B: 0, C: 0 }, { g_and: 'OR' })).toMatchObject({ w_xor: 1, Z: 1 })
    // Both inputs 1: AND and OR agree, so the fault hides.
    expect(simulateCircuit(level, { A: 1, B: 0, C: 1 }, { g_and: 'OR' })).toMatchObject({ w_xor: 1, Z: 1 })
  })
})

describe('inputs and tests', () => {
  it('starts with every switch off and nothing attached', () => {
    const game = startGame(chain())
    expect(game.inputs).toEqual({ A: 0, B: 0, C: 0 })
    expect(game.tests).toEqual([])
    expect(game.status).toBe('playing')
  })

  it('toggles known inputs and ignores unknown ones', () => {
    const game = toggleInput(startGame(chain()), 'B')
    expect(game.inputs).toEqual({ A: 0, B: 1, C: 0 })
    expect(toggleInput(game, 'B').inputs.B).toBe(0)
    expect(toggleInput(game, 'nope')).toBe(game)
  })

})

describe('runTest', () => {
  it('logs the inputs and every wire of the faulty board', () => {
    let game = startGame(chain())
    game = setInputs(game, { A: 1, B: 0, C: 1 })
    game = runTest(game)
    // The XOR outputs 1 as designed; the stuck AND outputs 0 even though both its inputs are 1.
    expect(game.tests).toEqual([{ inputs: { A: 1, B: 0, C: 1 }, wires: { A: 1, B: 0, C: 1, w_xor: 1, Z: 0 } }])
  })

  it('refuses to run past the budget', () => {
    let game = startGame(chain({ testBudget: 1 }))
    game = runTest(game)
    expect(runTest(game)).toBe(game)
  })

  it('finds the latest test matching a set of inputs', () => {
    let game = runTest(startGame(chain()))
    game = runTest(toggleInput(game, 'A'))
    expect(testMatching(game, { A: 0, B: 0, C: 0 })).toBe(0)
    expect(testMatching(game, { A: 1, B: 0, C: 0 })).toBe(1)
    expect(testMatching(game, { A: 1, B: 1, C: 0 })).toBeNull()
  })
})

describe('marks and diagnosis', () => {
  it('toggles a gate between marked faulty and unmarked', () => {
    let game = toggleMark(startGame(chain()), 'g_and')
    expect(game.diagnosis).toEqual(['g_and'])
    game = toggleMark(game, 'g_and')
    expect(game.diagnosis).toEqual([])
    expect(toggleMark(game, 'missing')).toBe(game)
  })

  it('asks for the right number of marks without charging a mistake', () => {
    const game = startGame(chain())
    const { outcome, game: after } = submitDiagnosis(game)
    expect(outcome).toEqual({ kind: 'wrongCount', expected: 1 })
    expect(after.mistakes).toBe(0)
  })

  it('wins by picking the faulty gate, with no stuck value needed', () => {
    const game = toggleMark(startGame(chain()), 'g_and')
    const { outcome, game: after } = submitDiagnosis(game)
    expect(outcome).toEqual({ kind: 'correct' })
    expect(after.status).toBe('won')
  })

  it('charges a mistake for a wrong diagnosis without saying what was wrong', () => {
    const game = toggleMark(runTest(setInputs(startGame(chain()), { A: 1, B: 0, C: 1 })), 'g_xor')
    const { outcome, game: after } = submitDiagnosis(game)
    expect(outcome).toEqual({ kind: 'wrong' })
    expect(after.mistakes).toBe(1)
    expect(after.status).toBe('playing')
  })

  it('treats a multi-fault diagnosis as all or nothing', () => {
    const level = loadFaultLevel({ ...chainSpec(), faults: { g_xor: 1, g_and: 0 } })
    const halfRight = { ...startGame(level), diagnosis: ['g_xor'] }
    expect(submitDiagnosis(halfRight).outcome).toEqual({ kind: 'wrongCount', expected: 2 })
    expect(submitDiagnosis(toggleMark(toggleMark(startGame(level), 'g_xor'), 'g_and')).outcome).toEqual({ kind: 'correct' })
  })

  it('loses after the allowed mistakes and then ignores further play', () => {
    let game = toggleMark(startGame(chain({ maxMistakes: 1 })), 'g_xor')
    game = submitDiagnosis(game).game
    expect(game.status).toBe('lost')
    expect(toggleInput(game, 'A')).toBe(game)
    expect(runTest(game)).toBe(game)
    expect(submitDiagnosis(game).game).toBe(game)
  })
})
