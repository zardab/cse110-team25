import { exposedFaults } from './faultAnalyzer'
import { testMatching, type FaultGame } from './faultFinder'

/**
 * The How to Play walkthrough: the player solves a tiny practice board while a callout
 * explains one thing at a time. Each step waits for the player to do what it asks.
 */

export type TutorialStep = 'goal' | 'switch' | 'test' | 'read' | 'mark' | 'submit' | 'done'

/** What on the board the callout points at. */
export type TutorialTarget = 'faults' | 'switches' | 'run' | 'gates' | 'submit'

export interface TutorialPrompt {
  readonly text: string
  readonly target: TutorialTarget | null
  /** Label of the button that moves on, or null when the step waits for an action instead. */
  readonly button: string | null
}

export type TutorialEvent = 'next' | 'toggle' | 'test' | 'mark' | 'won'

const ORDER: readonly TutorialStep[] = ['goal', 'switch', 'test', 'read', 'mark', 'submit', 'done']

function before(step: TutorialStep, than: TutorialStep): boolean {
  return ORDER.indexOf(step) < ORDER.indexOf(than)
}

/** Whether the test for the switches as they are now shows a faulty gate misbehaving. */
export function faultVisible(game: FaultGame): boolean {
  if (testMatching(game, game.inputs) === null) return false
  return exposedFaults(game.level, game.inputs).length > 0
}

function allFaultsMarked(game: FaultGame): boolean {
  const faults = Object.keys(game.level.faults)
  return faults.every((slotId) => game.diagnosis.includes(slotId))
    && game.diagnosis.length === faults.length
}

/**
 * The step after `event`. Players may run ahead (for example press Run Test before
 * flipping a switch); the walkthrough follows them rather than blocking them.
 */
export function advance(step: TutorialStep, event: TutorialEvent, game: FaultGame): TutorialStep {
  switch (event) {
    case 'won':
      return 'done'
    case 'next':
      if (step === 'goal') return 'switch'
      if (step === 'read' && faultVisible(game)) return 'mark'
      return step
    case 'toggle':
      return step === 'goal' || step === 'switch' ? 'test' : step
    case 'test':
      return before(step, 'read') ? 'read' : step
    case 'mark':
      // Marking the right gate counts once a test has been read; before that it's a blind guess.
      if (allFaultsMarked(game)) return step === 'read' || step === 'mark' ? 'submit' : step
      return step === 'submit' ? 'mark' : step
  }
}

export function prompt(step: TutorialStep, game: FaultGame): TutorialPrompt {
  switch (step) {
    case 'goal':
      return { text: 'One gate in this circuit is faulty. Your job is to find it.', target: 'faults', button: 'Next' }
    case 'switch':
      return { text: 'Click a switch to change an input.', target: 'switches', button: null }
    case 'test':
      return { text: 'Press Run Test to see what the circuit really does.', target: 'run', button: null }
    case 'read':
      if (testMatching(game, game.inputs) === null) {
        return { text: 'Press Run Test to try these inputs.', target: 'run', button: null }
      }
      if (!faultVisible(game)) {
        return {
          text: 'Every gate looks right on these inputs. Flip the switches and run another test.',
          target: 'switches', button: null,
        }
      }
      return {
        text: 'Yellow wires are 1 and grey wires are 0. A faulty gate\'s output doesn\'t match its inputs. Can you spot it?',
        target: 'gates', button: 'Next',
      }
    case 'mark':
      if (game.diagnosis.some((slotId) => !Object.hasOwn(game.level.faults, slotId))) {
        return { text: 'That gate\'s output matches its inputs. Click it again to unmark it, then look again.', target: 'gates', button: null }
      }
      return { text: 'Click the faulty gate to mark it.', target: 'gates', button: null }
    case 'submit':
      return {
        text: 'Press Submit. You must mark every faulty gate at once, and you only get a few wrong guesses.',
        target: 'submit', button: null,
      }
    case 'done':
      return {
        text: 'Solved! In the real levels, a faulty gate either always outputs the same value or acts like a different gate, and some faults only show up for certain switch settings.',
        target: null, button: 'Start Playing',
      }
  }
}
