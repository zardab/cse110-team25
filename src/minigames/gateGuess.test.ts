import { describe, expect, it } from 'vitest';
import {
  GUESS_GATES,
  MAX_LIVES,
  firstContradiction,
  fits,
  guess,
  nextRound,
  outputOf,
  startRound,
  startSession,
  submitGuess,
  timeOut,
  type Bit,
  type GuessGate,
  type GuessRound,
  type Rng,
} from './gateGuess';
import { GATE_GUESS_BEST_KEY, loadBestStreak, saveBestStreak } from './gateGuessRecord';
import type { StorageLike } from '../persistence/storageAdapter';

/** Small seeded generator so every run picks the same gates and tests. */
function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_INPUTS: readonly (readonly [Bit, Bit])[] = [[0, 0], [0, 1], [1, 0], [1, 1]];

function roundWith(answer: GuessGate, a: Bit, b: Bit): GuessRound {
  return { answer, clues: [{ a, b, out: outputOf(answer, a, b) }], guessed: [], mistakes: 0, solved: false };
}

/** Every way a player could keep guessing gates that fit, until only the answer is left. */
function* fittingPaths(round: GuessRound, rng: Rng): Generator<GuessRound> {
  const candidates = GUESS_GATES.filter((gate) => gate !== round.answer && fits(gate, round.clues));
  if (candidates.length === 0) {
    yield round;
    return;
  }
  for (const gate of candidates) {
    const next = guess(round, gate, rng);
    expect(next.outcome).toBe('fitsSoFar');
    // The new clue must rule out the gate the player just guessed.
    expect(fits(gate, next.round.clues)).toBe(false);
    yield* fittingPaths(next.round, rng);
  }
}

describe('outputOf', () => {
  it('matches the truth table for each gate', () => {
    const columns: Record<GuessGate, Bit[]> = {
      AND: [0, 0, 0, 1], OR: [0, 1, 1, 1], XOR: [0, 1, 1, 0],
      NAND: [1, 1, 1, 0], NOR: [1, 0, 0, 0], XNOR: [1, 0, 0, 1],
    };
    for (const gate of GUESS_GATES) {
      expect(ALL_INPUTS.map(([a, b]) => outputOf(gate, a, b))).toEqual(columns[gate]);
    }
  });
});

describe('guess', () => {
  it('solves the round when the guess is the answer', () => {
    const { outcome, round } = guess(roundWith('XOR', 1, 1), 'XOR', seeded(1));
    expect(outcome).toBe('correct');
    expect(round.solved).toBe(true);
    expect(round.mistakes).toBe(0);
  });

  it('adds a clue instead of a mistake when the guess fits every clue so far', () => {
    // 1, 1 → 1 fits AND, OR and XNOR.
    const { outcome, round } = guess(roundWith('AND', 1, 1), 'OR', seeded(2));
    expect(outcome).toBe('fitsSoFar');
    expect(round.mistakes).toBe(0);
    expect(round.clues).toHaveLength(2);
    expect(fits('OR', round.clues)).toBe(false);
    expect(fits('AND', round.clues)).toBe(true);
  });

  it('counts a mistake and adds no clue when the guess contradicts a clue', () => {
    // 1, 1 → 1 rules out XOR, which gives 0.
    const start = roundWith('AND', 1, 1);
    const { outcome, round } = guess(start, 'XOR', seeded(3));
    expect(outcome).toBe('wrong');
    expect(round.mistakes).toBe(1);
    expect(round.clues).toEqual(start.clues);
    expect(firstContradiction('XOR', round.clues)).toEqual(start.clues[0]);
  });

  it('records each guessed gate once', () => {
    let round = roundWith('AND', 1, 1);
    round = guess(round, 'XOR', seeded(4)).round;
    round = guess(round, 'XOR', seeded(4)).round;
    expect(round.guessed).toEqual(['XOR']);
    expect(round.mistakes).toBe(2);
  });

  it('refuses guesses after the round is solved', () => {
    const solved = guess(roundWith('OR', 0, 0), 'OR', seeded(5)).round;
    expect(() => guess(solved, 'AND', seeded(5))).toThrow('already solved');
  });

  it('pins down every gate within three clues, whatever the player guesses', () => {
    let paths = 0;
    for (const answer of GUESS_GATES) {
      for (const [a, b] of ALL_INPUTS) {
        for (const end of fittingPaths(roundWith(answer, a, b), seeded(6))) {
          paths += 1;
          expect(end.clues.length).toBeLessThanOrEqual(3);
          expect(GUESS_GATES.filter((gate) => fits(gate, end.clues))).toEqual([answer]);
          // 0,1 and 1,0 are the same test for these gates, so no test repeats.
          const tests = end.clues.map((clue) => clue.a + clue.b);
          expect(new Set(tests).size).toBe(tests.length);
        }
      }
    }
    expect(paths).toBeGreaterThan(24);
  });
});

describe('startRound', () => {
  it('shows one clue that matches the hidden gate', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const round = startRound(seeded(seed));
      expect(GUESS_GATES).toContain(round.answer);
      expect(round.clues).toHaveLength(1);
      expect(fits(round.answer, round.clues)).toBe(true);
    }
  });

  it('never repeats the gate it is told to avoid', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      expect(startRound(seeded(seed), 'NAND').answer).not.toBe('NAND');
    }
  });

  it('handles a generator that returns values just below 1', () => {
    const round = startRound(() => 0.9999999);
    expect(round.answer).toBe('XNOR');
    expect(round.clues[0]).toMatchObject({ a: 1, b: 1 });
  });
});

describe('session', () => {
  const rng = seeded(7);

  function wrongGate(session: ReturnType<typeof startSession>): GuessGate {
    return GUESS_GATES.find((gate) => !fits(gate, session.round.clues))!;
  }

  it('starts with full lives and no streak', () => {
    expect(startSession(rng)).toMatchObject({ lives: MAX_LIVES, streak: 0, status: 'playing' });
  });

  it('adds to the streak on a correct guess and keeps lives into the next round', () => {
    let session = startSession(rng);
    session = submitGuess(session, wrongGate(session), rng).session;
    session = submitGuess(session, session.round.answer, rng).session;
    expect(session).toMatchObject({ status: 'won', streak: 1, lives: MAX_LIVES - 1 });

    const previous = session.round.answer;
    session = nextRound(session, rng);
    expect(session).toMatchObject({ status: 'playing', streak: 1, lives: MAX_LIVES - 1 });
    expect(session.round.answer).not.toBe(previous);
    expect(session.round.clues).toHaveLength(1);
  });

  it('does not cost a life for a guess that fits so far', () => {
    let session = startSession(rng);
    const fitting = GUESS_GATES.find((gate) => gate !== session.round.answer && fits(gate, session.round.clues))!;
    const result = submitGuess(session, fitting, rng);
    session = result.session;
    expect(result.outcome).toBe('fitsSoFar');
    expect(session.lives).toBe(MAX_LIVES);
  });

  it('ends the run when the last life is lost', () => {
    let session = startSession(rng);
    for (let i = 0; i < MAX_LIVES; i += 1) session = submitGuess(session, wrongGate(session), rng).session;
    expect(session).toMatchObject({ status: 'lost', lives: 0 });
    expect(() => submitGuess(session, session.round.answer, rng)).toThrow('lost');
    expect(() => nextRound(session, rng)).toThrow('not solved');
  });

  it('ends the run when time runs out, keeping the streak', () => {
    let session = startSession(rng);
    session = submitGuess(session, session.round.answer, rng).session;
    session = nextRound(session, rng);
    session = timeOut(session);
    expect(session).toMatchObject({ status: 'lost', streak: 1, lives: MAX_LIVES });
    expect(() => timeOut(session)).toThrow('lost');
  });
});

describe('best streak record', () => {
  function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
    const data = { ...initial };
    return {
      data,
      getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
      setItem: (key, value) => { data[key] = value; },
      removeItem: (key) => { delete data[key]; },
    };
  }

  it('reads back what it saved', () => {
    const storage = memory();
    expect(saveBestStreak(storage, 7)).toBe(true);
    expect(storage.data[GATE_GUESS_BEST_KEY]).toBe('7');
    expect(loadBestStreak(storage)).toBe(7);
  });

  it('treats missing, corrupt or unreadable values as 0', () => {
    expect(loadBestStreak(null)).toBe(0);
    expect(loadBestStreak(memory())).toBe(0);
    expect(loadBestStreak(memory({ [GATE_GUESS_BEST_KEY]: 'lots' }))).toBe(0);
    expect(loadBestStreak(memory({ [GATE_GUESS_BEST_KEY]: '-3' }))).toBe(0);
    const broken: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => {},
    };
    expect(loadBestStreak(broken)).toBe(0);
    expect(saveBestStreak(broken, 3)).toBe(false);
    expect(saveBestStreak(null, 3)).toBe(false);
  });
});
