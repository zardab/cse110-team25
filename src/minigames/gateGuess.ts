import { evaluateGate } from '../simulation/gates';
import type { GateType } from '../types/circuit';

/**
 * "Name That Gate": one hidden gate, two inputs, one output. The player sees how the
 * gate answered a test and names the gate.
 *
 * A single test never identifies a gate on its own (1, 1 → 1 fits AND, OR and XNOR),
 * so a guess that fits every test shown so far is not a mistake: it earns a new test
 * that tells the guess apart from the answer. Only a guess that contradicts a test the
 * player can already see costs a life.
 */

export type Bit = 0 | 1;

/** NOT is left out: it is the only one-input gate, so its wiring would give it away. */
export const GUESS_GATES = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'] as const satisfies readonly GateType[];
export type GuessGate = (typeof GUESS_GATES)[number];

/** One test of the hidden gate: inputs A and B and the output it produced. */
export interface Clue {
  readonly a: Bit;
  readonly b: Bit;
  readonly out: Bit;
}

export interface GuessRound {
  readonly answer: GuessGate;
  /** Tests shown so far, oldest first. */
  readonly clues: readonly Clue[];
  /** Gates the player has guessed this round, in order. */
  readonly guessed: readonly GuessGate[];
  readonly mistakes: number;
  readonly solved: boolean;
}

export type GuessOutcome = 'correct' | 'fitsSoFar' | 'wrong';

/** Returns a number in [0, 1), like Math.random. Injected so tests can seed it. */
export type Rng = () => number;

const INPUTS: readonly (readonly [Bit, Bit])[] = [[0, 0], [0, 1], [1, 0], [1, 1]];

export function outputOf(gate: GuessGate, a: Bit, b: Bit): Bit {
  return evaluateGate(gate, [a, b]) as Bit;
}

/** Whether `gate` gives the same output as the hidden gate on every clue. */
export function fits(gate: GuessGate, clues: readonly Clue[]): boolean {
  return clues.every((clue) => outputOf(gate, clue.a, clue.b) === clue.out);
}

/** The first clue `gate` disagrees with, or undefined if it fits them all. */
export function firstContradiction(gate: GuessGate, clues: readonly Clue[]): Clue | undefined {
  return clues.find((clue) => outputOf(gate, clue.a, clue.b) !== clue.out);
}

// Every gate in the game treats A and B the same way, so 0,1 and 1,0 are the same test.
// Comparing tests by how many inputs are on keeps the game from showing both.
function testOf(a: Bit, b: Bit): number {
  return a + b;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function clueFor(answer: GuessGate, [a, b]: readonly [Bit, Bit]): Clue {
  return { a, b, out: outputOf(answer, a, b) };
}

/** A new round with one clue. `avoid` keeps the same gate from coming up twice in a row. */
export function startRound(rng: Rng, avoid?: GuessGate): GuessRound {
  const answer = pick(GUESS_GATES.filter((gate) => gate !== avoid), rng);
  return { answer, clues: [clueFor(answer, pick(INPUTS, rng))], guessed: [], mistakes: 0, solved: false };
}

export function guess(
  round: GuessRound,
  gate: GuessGate,
  rng: Rng,
): { readonly outcome: GuessOutcome; readonly round: GuessRound } {
  if (round.solved) throw new Error('This round is already solved');
  const guessed = round.guessed.includes(gate) ? round.guessed : [...round.guessed, gate];

  if (gate === round.answer) {
    return { outcome: 'correct', round: { ...round, guessed, solved: true } };
  }
  if (!fits(gate, round.clues)) {
    return { outcome: 'wrong', round: { ...round, guessed, mistakes: round.mistakes + 1 } };
  }

  // The guess and the answer agree on every test shown. Every gate gives a different
  // output on at least one of the three tests, so an unshown test separates them.
  const shown = new Set(round.clues.map((clue) => testOf(clue.a, clue.b)));
  const separating = INPUTS.filter(([a, b]) =>
    !shown.has(testOf(a, b)) && outputOf(gate, a, b) !== outputOf(round.answer, a, b));
  return {
    outcome: 'fitsSoFar',
    round: { ...round, guessed, clues: [...round.clues, clueFor(round.answer, pick(separating, rng))] },
  };
}

// --- A run of rounds ---------------------------------------------------------------

export const MAX_LIVES = 3;
/** Seconds to solve each circuit; the clock starts over with every new circuit. */
export const ROUND_SECONDS = 15;

export type SessionStatus = 'playing' | 'won' | 'lost';

export interface GuessSession {
  readonly round: GuessRound;
  readonly lives: number;
  /** Rounds solved in this run. */
  readonly streak: number;
  /** 'won' is the current round solved; 'lost' is the run over. */
  readonly status: SessionStatus;
}

export function startSession(rng: Rng): GuessSession {
  return { round: startRound(rng), lives: MAX_LIVES, streak: 0, status: 'playing' };
}

export function submitGuess(
  session: GuessSession,
  gate: GuessGate,
  rng: Rng,
): { readonly outcome: GuessOutcome; readonly session: GuessSession } {
  if (session.status !== 'playing') throw new Error(`Cannot guess while the round is ${session.status}`);
  const { outcome, round } = guess(session.round, gate, rng);
  if (outcome === 'correct') {
    return { outcome, session: { ...session, round, streak: session.streak + 1, status: 'won' } };
  }
  if (outcome === 'wrong') {
    const lives = session.lives - 1;
    return { outcome, session: { ...session, round, lives, status: lives === 0 ? 'lost' : 'playing' } };
  }
  return { outcome, session: { ...session, round } };
}

/** The clock ran out before the round was solved: the run ends. */
export function timeOut(session: GuessSession): GuessSession {
  if (session.status !== 'playing') throw new Error(`Cannot time out while the round is ${session.status}`);
  return { ...session, status: 'lost' };
}

/** Moves on after a solved round, keeping lives and streak. */
export function nextRound(session: GuessSession, rng: Rng): GuessSession {
  if (session.status !== 'won') throw new Error('The current round is not solved yet');
  return { ...session, round: startRound(rng, session.round.answer), status: 'playing' };
}
