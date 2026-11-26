# Minigame: Name That Gate

**Architecture, Round Rules, and Test Plan**

"Name That Gate" is a standalone minigame. The player sees a circuit with two inputs, one output, and a single hidden gate, and has to work out which gate is in the box from how it answers tests. It reuses the Track A gate registry and touches nothing in the main puzzle game's store, levels or persistence.

## 1 How a Round Works

### 1.1 Why One Test Is Not Enough

A single input/output example almost never identifies a gate. With inputs A and B:

| A B | AND | OR | XOR | NAND | NOR | XNOR |
|-----|-----|----|-----|------|-----|------|
| 0 0 | 0   | 0  | 0   | 1    | 1   | 1    |
| 0 1 | 0   | 1  | 1   | 1    | 0   | 0    |
| 1 0 | 0   | 1  | 1   | 1    | 0   | 0    |
| 1 1 | 1   | 1  | 0   | 0    | 0   | 1    |

If the circuit shows `1, 1 → 1`, the gate could be AND, OR or XNOR. Every single test leaves exactly three candidates. A player who picks the "wrong" one of those three has not made a mistake; the circuit simply has not given enough information yet. The rules have to account for that.

### 1.2 Progressive Clues

Each round starts with one random test. Every guess has one of three outcomes:

1. **Correct:** the guess is the hidden gate. The gate is revealed and the streak goes up.
2. **Fits so far:** the guess is not the answer but gives the same output on every test shown. This costs nothing. The game adds a new test on which the guess and the answer disagree, so the player can see why their guess was wrong.
3. **Wrong:** the guess contradicts a test already on screen. The player loses one of 3 lives, and the circuit switches to the test the guess fails.

### 1.3 Why a Round Always Ends Within Three Tests

All six gates are symmetric, so `0,1` and `1,0` are the same test. That leaves only three distinct tests, keyed by how many inputs are on (`a + b` = 0, 1 or 2). Read as three-bit signatures over those tests, every gate is different:

```
AND 001   OR 011   XOR 010   NAND 110   NOR 100   XNOR 101
```

So whenever a guess fits every shown test but is not the answer, there is always an unshown test that separates the two, and a new clue always exists. After all three tests are shown, only the answer fits. The game never shows both `0,1` and `1,0`, because the second would add no information.

NOT is left out of the game. It is the only one-input gate, so the wiring alone would give it away.

### 1.4 Runs, Lives and the Timer

- Opening the minigame shows a How to Play screen (rules, a truth table of all six gates, and the best streak). The run and its clock start only when the player presses START. Play Again after a loss skips this screen.
- A run starts with 3 lives and a streak of 0.
- Each new circuit gets 15 seconds. The clock pauses once the circuit is solved and starts again at 15 when the player moves to the next circuit.
- The run ends when the last life is lost or the clock reaches 0. Either way, the hidden gate is revealed.
- The best streak is saved in `localStorage` under `cse110-team25:gate-guess-best`.

## 2 Data Contract

All rule code works on these immutable types (`src/minigames/gateGuess.ts`):

```ts
export type Bit = 0 | 1;

export const GUESS_GATES = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'] as const;
export type GuessGate = (typeof GUESS_GATES)[number];

/** One test of the hidden gate. */
export interface Clue {
  readonly a: Bit;
  readonly b: Bit;
  readonly out: Bit;
}

export interface GuessRound {
  readonly answer: GuessGate;
  readonly clues: readonly Clue[];       // oldest first
  readonly guessed: readonly GuessGate[];
  readonly mistakes: number;
  readonly solved: boolean;
}

export type GuessOutcome = 'correct' | 'fitsSoFar' | 'wrong';

export interface GuessSession {
  readonly round: GuessRound;
  readonly lives: number;
  readonly streak: number;
  readonly status: 'playing' | 'won' | 'lost';
}

/** Returns a number in [0, 1), like Math.random. Injected so tests can seed it. */
export type Rng = () => number;
```

Every function returns a new value instead of changing its input:

| Function | What it does |
|---|---|
| `startRound(rng, avoid?)` | A new round with one clue. `avoid` stops the same gate coming up twice in a row. |
| `guess(round, gate, rng)` | Applies one guess and returns `{ outcome, round }`. Throws if the round is already solved. |
| `startSession(rng)` | A new run: 3 lives, streak 0. |
| `submitGuess(session, gate, rng)` | `guess` plus lives, streak and status. |
| `nextRound(session, rng)` | Moves on after a solved round, keeping lives and streak. |
| `timeOut(session)` | Ends the run when the clock runs out. |
| `fits(gate, clues)` / `firstContradiction(gate, clues)` | Whether a gate matches every clue, and the first one it fails. |

Outputs come from `evaluateGate` in `src/simulation/gates.ts`, so the minigame's answers always match the main game.

## 3 Components

The minigame follows the same controller/view split as the other Konva screens.

| File | Role |
|---|---|
| `src/minigames/gateGuess.ts` | Round and run rules. No UI, no timers, no storage. |
| `src/minigames/gateGuessRecord.ts` | Loads and saves the best streak. Missing, corrupt or unreadable storage reads as 0. |
| `src/minigames/GateGuessController.ts` | Holds the current run, turns clicks into guesses, runs the 15-second clock, writes messages, saves the best streak. |
| `src/minigames/GateGuessView.ts` | Draws the screen from a `GateGuessViewModel`. It holds no game state and only reports clicks. |

**View layout.** Everything is laid out on a 960 × 600 board, then scaled to fit the screen with a 16 px margin:

- **Header:** a Back button, the title, lives, streak and best, and the timer with a bar that turns red at 5 seconds.
- **Circuit card:** inputs A and B, the hidden "?" box (or the revealed gate), and the output bulb for the selected test.
- **Tests panel:** every test found so far. Clicking one shows it on the circuit.
- **Bottom:** a message line, six gate buttons (a guessed gate is struck through and disabled), and a Next circuit or Play again button.

Timer ticks update only the timer nodes through `setTimeLeft`, so the board isn't rebuilt every second under the player's pointer.

**Screen wiring.** The screen is registered as `{ type: "gateGuess" }` in `src/screenTypes.ts` and created in `SceneController`. `stop()` clears the timer whenever another screen is shown. Back returns to the level selector. There is currently no button that opens the screen; an entry point (for example the sidebar's Mini-Games button) has to call `switchToScreen({ type: "gateGuess" })`.

## 4 Testing

### 4.1 Isolation

- The rules take an injected `rng`, so tests use a seeded generator and get the same gates and clues every run.
- The record functions take a `StorageLike`, so tests use an in-memory store, including one that throws.
- The controller takes `{ rng, storage }` and is tested with Vitest fake timers, so timer tests never actually wait.

### 4.2 Required Tests

`src/minigames/gateGuess.test.ts` (rules and record):

- Each gate's outputs match the truth table.
- For every hidden gate, every starting test and every order of fitting guesses, the gate is identified within 3 tests, no test repeats, and each new clue rules out the guess that earned it.
- A correct guess solves the round, a fitting guess adds a clue without a mistake, and a contradicting guess adds a mistake without a clue.
- Lives run out and end the run, the streak carries into the next round, and a time-out ends the run.
- The best streak round-trips through storage and falls back to 0 for bad data.

`src/minigames/GateGuessController.test.ts` (the real screen, driven by clicks):

- Correct, fitting and wrong guesses produce the right reveal, messages, lives and buttons.
- Losing the last life ends the run, and Play again starts a fresh one.
- Clicking a test shows it on the circuit, and Back returns to the level selector.
- The timer counts down from 15, ends the run at 0, keeps running through guesses, pauses after a correct guess, restarts at 15 on the next circuit, and stops when the screen is left.

Run only these tests with:

```bash
npx vitest run src/minigames
```

They also run in CI as part of `npm test` on every push and pull request (`.github/workflows/ci.yml`).
