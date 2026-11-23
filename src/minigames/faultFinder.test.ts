import { describe, expect, it } from 'vitest'
import { loadFaultLevel } from '../content/faultLevelLoader'
import { simulateCircuit } from '../simulation/evaluateCircuit'
import {
  attachProbe, candidateFaults, countSuspects, cycleMark, explainsTests, runTest, setInputs,
  startGame, submitDiagnosis, testMatching, toggleInput,
} from './faultFinder'

/** XOR(A, B) feeding AND(·, C) → Z, with the AND stuck at 0. */
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

describe('simulateCircuit with faults', () => {
  it('forces a stuck slot output regardless of its inputs', () => {
    const level = chain()
    const inputs = { A: 1, B: 0, C: 1 } as const
    expect(simulateCircuit(level, inputs)).toMatchObject({ w_xor: 1, Z: 1 })
    expect(simulateCircuit(level, inputs, { g_and: 0 })).toMatchObject({ w_xor: 1, Z: 0 })
    expect(simulateCircuit(level, inputs, { g_xor: 0 })).toMatchObject({ w_xor: 0, Z: 0 })
    expect(simulateCircuit(level, { A: 0, B: 0, C: 0 }, { g_xor: 1, g_and: 1 })).toMatchObject({ w_xor: 1, Z: 1 })
  })
})

describe('inputs and probes', () => {
  it('starts with every switch off and nothing attached', () => {
    const game = startGame(chain())
    expect(game.inputs).toEqual({ A: 0, B: 0, C: 0 })
    expect(game.tests).toEqual([])
    expect(game.probes).toEqual([])
    expect(game.status).toBe('playing')
  })

  it('toggles known inputs and ignores unknown ones', () => {
    const game = toggleInput(startGame(chain()), 'B')
    expect(game.inputs).toEqual({ A: 0, B: 1, C: 0 })
    expect(toggleInput(game, 'B').inputs.B).toBe(0)
    expect(toggleInput(game, 'nope')).toBe(game)
  })

  it('attaches probes only within the budget and never twice to the same wire', () => {
    const once = attachProbe(startGame(chain()), 'g_xor')
    expect(once.probes).toEqual(['g_xor'])
    expect(attachProbe(once, 'g_xor')).toBe(once)
    expect(attachProbe(once, 'g_and')).toBe(once)
    expect(attachProbe(once, 'missing')).toBe(once)
  })
})

describe('runTest', () => {
  it('logs the inputs, what the design would give, what the board gave, and probe readings', () => {
    let game = startGame(chain())
    game = setInputs(game, { A: 1, B: 0, C: 1 })
    game = attachProbe(game, 'g_xor')
    game = runTest(game)
    expect(game.tests).toEqual([{
      inputs: { A: 1, B: 0, C: 1 }, expected: { Z: 1 }, actual: { Z: 0 }, readings: { g_xor: 1 },
    }])
  })

  it('reads only the probes attached at the time of the test', () => {
    let game = runTest(startGame(chain()))
    game = attachProbe(game, 'g_xor')
    game = runTest(game)
    expect(game.tests[0].readings).toEqual({})
    expect(game.tests[1].readings).toEqual({ g_xor: 0 })
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
  it('cycles a gate through healthy, stuck at 0, stuck at 1', () => {
    let game = cycleMark(startGame(chain()), 'g_and')
    expect(game.diagnosis).toEqual({ g_and: 0 })
    game = cycleMark(game, 'g_and')
    expect(game.diagnosis).toEqual({ g_and: 1 })
    game = cycleMark(game, 'g_and')
    expect(game.diagnosis).toEqual({})
  })

  it('asks for the right number of marks without charging a mistake', () => {
    const game = startGame(chain())
    const { outcome, game: after } = submitDiagnosis(game)
    expect(outcome).toEqual({ kind: 'wrongCount', expected: 1 })
    expect(after.mistakes).toBe(0)
  })

  it('wins on the exact fault set', () => {
    const game = cycleMark(startGame(chain()), 'g_and')
    const { outcome, game: after } = submitDiagnosis(game)
    expect(outcome).toEqual({ kind: 'correct' })
    expect(after.status).toBe('won')
  })

  it('points at the test a wrong diagnosis contradicts', () => {
    // A=1, B=0, C=1 reads Z=0 on the real board; "g_and stuck at 1" would read Z=1.
    let game = runTest(setInputs(startGame(chain()), { A: 1, B: 0, C: 1 }))
    game = cycleMark(cycleMark(game, 'g_and'), 'g_and')
    const { outcome, game: after } = submitDiagnosis(game)
    expect(outcome).toEqual({ kind: 'contradicts', testIndex: 0 })
    expect(after.mistakes).toBe(1)
    expect(after.status).toBe('playing')
  })

  it('tells a consistent but wrong diagnosis apart from a contradicted one', () => {
    // With no probe, "g_xor stuck at 0" also gives Z=0 everywhere.
    let game = runTest(setInputs(startGame(chain()), { A: 1, B: 0, C: 1 }))
    game = cycleMark(game, 'g_xor')
    expect(submitDiagnosis(game).outcome).toEqual({ kind: 'fitsSoFar' })
  })

  it('loses after the allowed mistakes and then ignores further play', () => {
    let game = cycleMark(startGame(chain({ maxMistakes: 1 })), 'g_xor')
    game = submitDiagnosis(game).game
    expect(game.status).toBe('lost')
    expect(toggleInput(game, 'A')).toBe(game)
    expect(runTest(game)).toBe(game)
    expect(submitDiagnosis(game).game).toBe(game)
  })
})

describe('suspects', () => {
  it('enumerates every single and double stuck-at fault', () => {
    const level = chain()
    expect(candidateFaults(level, 1)).toHaveLength(4)
    expect(candidateFaults(level, 2)).toHaveLength(4)
    expect(candidateFaults(level, 2)).toContainEqual({ g_xor: 1, g_and: 0 })
  })

  it('narrows the suspects as tests and probes add information', () => {
    let game = startGame(chain())
    expect(countSuspects(game)).toBe(4)
    game = runTest(setInputs(game, { A: 1, B: 0, C: 1 }))
    // Z=0 where the design says 1: g_xor stuck 0 and g_and stuck 0 both explain it.
    expect(countSuspects(game)).toBe(2)
    game = runTest(attachProbe(game, 'g_xor'))
    // The probe reads w_xor=1, which rules out g_xor stuck 0.
    expect(countSuspects(game)).toBe(1)
    expect(explainsTests(game.level, { g_and: 0 }, game.tests)).toBe(true)
    expect(explainsTests(game.level, { g_xor: 0 }, game.tests)).toBe(false)
  })
})
