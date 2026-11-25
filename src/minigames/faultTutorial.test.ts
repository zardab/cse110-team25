import { describe, expect, it } from 'vitest'
import { faultTutorialLevel } from '../content/faultLevelCatalog'
import { runTest, setInputs, startGame, toggleMark } from './faultFinder'
import { advance, faultVisible, prompt } from './faultTutorial'

const fresh = () => startGame(faultTutorialLevel)

describe('fault tutorial', () => {
  it('uses a practice board whose fault shows on some inputs but hides on others', () => {
    expect(faultVisible(runTest(setInputs(fresh(), { A: 1, B: 0 })))).toBe(true)
    expect(faultVisible(runTest(setInputs(fresh(), { A: 1, B: 1 })))).toBe(false)
    // Untested inputs show nothing yet.
    expect(faultVisible(setInputs(fresh(), { A: 1, B: 0 }))).toBe(false)
  })

  it('moves through the steps as the player acts', () => {
    const tested = runTest(setInputs(fresh(), { A: 1, B: 0 }))
    expect(advance('goal', 'next', fresh())).toBe('switch')
    expect(advance('switch', 'toggle', fresh())).toBe('test')
    expect(advance('test', 'test', tested)).toBe('read')
    expect(advance('read', 'next', tested)).toBe('mark')
    expect(advance('mark', 'mark', toggleMark(tested, 'g_and'))).toBe('submit')
    expect(advance('submit', 'won', tested)).toBe('done')
  })

  it('follows a player who runs ahead, but never skips reading a test', () => {
    const tested = runTest(fresh())
    expect(advance('goal', 'test', tested)).toBe('read')
    // Marking the right gate before any test is a blind guess, so it doesn't count yet.
    expect(advance('switch', 'mark', toggleMark(fresh(), 'g_and'))).toBe('switch')
    // "Next" on a test that hides the fault stays put.
    const hidden = runTest(setInputs(fresh(), { A: 1, B: 1 }))
    expect(advance('read', 'next', hidden)).toBe('read')
    expect(prompt('read', hidden).button).toBeNull()
  })

  it('steps back from submit if the right mark is removed', () => {
    const marked = toggleMark(runTest(fresh()), 'g_and')
    expect(advance('submit', 'mark', toggleMark(marked, 'g_and'))).toBe('mark')
  })

  it('points each step at the part of the board it talks about', () => {
    expect(prompt('goal', fresh()).target).toBe('faults')
    expect(prompt('switch', fresh()).target).toBe('switches')
    expect(prompt('test', fresh()).target).toBe('run')
    expect(prompt('submit', fresh()).target).toBe('submit')
    expect(prompt('done', fresh())).toMatchObject({ target: null, button: 'Start Playing' })
  })
})
