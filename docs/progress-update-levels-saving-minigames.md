# Logic Gate Puzzle Game: Levels, Saving, Minigames and Frontend Flow

**Progress Update & Systems Specification**

Fall 2026

This page covers the work since the original architecture plan. It uses the same structure as that plan: how each part works and why, the data it relies on, and how it is tested.

## 0 Status at a Glance

| Area | Change | Where it lives | Status |
|---|---|---|---|
| Frontend | Cutscene flow | `src/Cutscenes/Cutscene1/` | The intro cutscene (menu → cutscene → level selector) is on `main`. Cutscenes **between** levels are not in the repository yet; §1.1 gives the plan for them. |
| Frontend | In-game sidebar | `src/ui/components/SideMenu.ts`, `index.html` | On `main`. Opens, closes and flips the difficulty switch. Its Tutorial, Restart and Mini-Games buttons do nothing yet. |
| Backend | Levels 1–10: wiring and empty slots | `src/content/levels/` | Levels 1–5 are on `main`. Levels 6–10 are on branch `feat/levels-06-10`. |
| Backend | Levels connected to the loader | `src/content/levelCatalog.ts` | On `main`. The level selector lists levels 1–5. |
| Backend | Minigame logic | `src/ui/LevelScreen.ts` (timed mode), `src/minigames/` (Name That Gate) | The timed mode is on `main`. Name That Gate is on branch `feat/gate-guess-minigame`. |
| Backend | Saving progress across refreshes | `src/persistence/storageAdapter.ts`, `src/ui/LevelScreen.ts` | On `main`. |

## 1 Frontend

### 1.1 Cutscenes

The game opens with a scripted cutscene between the main menu and the level selector:

```
Main menu ──START──▶ Cutscene 1 ──(17 s)──▶ Level selector ──▶ Level
```

**How a cutscene is built.** A cutscene is an ordinary screen: a controller and a view registered with `SceneController`. The controller holds the script as data and schedules each step with a timer:

```ts
type Line = { atMs: number; text: string; bounce?: boolean };

private lines: Line[] = [
  { atMs: 500,   text: "It's dark in here..." },
  { atMs: 3500,  text: "There we go!", bounce: true },
  { atMs: 5000,  text: "Finally, time to doomscroll!", bounce: true },
  { atMs: 12500, text: "Was that the breaker box?", bounce: true },
  { atMs: 15000, text: "Time to fix some circuits.", bounce: true },
];
```

- **The controller decides when; the view decides how.** `Cutscene1Controller` schedules the black screen lifting (2 s), each subtitle (shown for 1 s), the lights dimming (9 s), the character flipping (11 s and 12 s), and the end (17 s). `Cutscene1View` only knows how to do each of those things: `hideBlackScreen`, `showSubtitle`, `bounceImage`, `darken`, `flipImage`.
- **Every timer can be cancelled.** Each one is recorded, and `stop()` clears them all. `SceneController` calls `stop()` whenever another screen is shown, so a cutscene that is left early never fires a step on top of the next screen.
- **The ending is passed in.** The controller is given an `onFinish` callback. Cutscene 1 is told to switch to the level selector, so the same class could end anywhere.

**Plan for cutscenes between levels.** Transitions between levels can reuse this pattern without changes to the timing code. Each transition is a new script plus an `onFinish` that opens the next level. Two pieces still need to be built:

1. A way to go from a finished level back into the Konva scene. Levels currently run in the HTML game UI (`#app`), and `main.ts` only goes from the scene to a level, not back.
2. A "level solved" signal from `LevelScreen` (the store already reports `result.isSolved`) that triggers the transition.

### 1.2 In-Game Sidebar

The three-line icon in the top-left corner of the gameplay screen (`#menu-btn`) opens a sidebar drawer.

| Part | Behavior |
|---|---|
| Open | The menu icon calls `SideMenu.open()`. |
| Close | The ✕ button or a click on the dimmed backdrop calls `SideMenu.close()`. Leaving the level also closes it. |
| Difficulty switch | Flips between EASY and HARD (`data-mode` on `#difficulty-toggle`). It does not yet change the level's difficulty. |
| Tutorial, Restart, Mini-Games | Laid out and styled; not yet connected. |
| Footer | Shows a placeholder "Level 5 / 12" that is still hard-coded. |

**Design notes.**

- `SideMenu` takes an `AbortSignal` from `LevelScreen`. Every listener it adds is removed when the level is destroyed, so opening several levels in a row never stacks up duplicate click handlers.
- It throws immediately if `#game-sidebar` or `#difficulty-toggle` is missing from the page, so a broken page fails loudly instead of quietly losing the menu.
- The sidebar is plain HTML and CSS, not Konva. It sits on top of the board and stays independent of the circuit renderer.

**Next steps.** Connect Restart to the existing reset handler, connect Mini-Games to the minigame screens (§3), and make the difficulty switch reload the level in Easy or Hard mode.

## 2 Backend: Levels

### 2.1 How a Level Describes Its Wiring

Levels use the Inbound Netlist Model from the original plan: each slot lists where its inputs come from, in pin order. The wiring is fixed; the player only chooses which gate goes in each empty slot.

```json
"slot_nand": {
  "id": "slot_nand",
  "allowedGates": ["NAND"],
  "inputs": [
    { "sourceType": "SLOT_OUTPUT", "sourceId": "slot_and_left" },
    { "sourceType": "SLOT_OUTPUT", "sourceId": "slot_or_right" }
  ],
  "outputWireId": "out_Z",
  "assignedGate": "NULL"
}
```
*Listing 1: One slot from `level_03_nand.json`.*

- **Empty slots** have `"assignedGate": "NULL"`. These are the spaces the player fills.
- **Pre-placed gates** have a gate in `assignedGate`. They are part of the puzzle and are already taken out of the palette when the level starts.
- **Each level has one fixed set of inputs** (`inputValues`) and the outputs it must produce (`targetOutputs`). This replaces the full `truthTableTarget` from the original plan.

```json
"inputValues":   { "in_A": 1, "in_B": 1, "in_C": 0, "in_D": 1, "in_E": 1 },
"targetOutputs": { "out_Z": 0, "out_W": 0, "out_Y": 0 }
```

### 2.2 Levels 1–10

| # | File | Title | Mode | Slots (empty) | Inputs → Outputs |
|---|---|---|---|---|---|
| 1 | `level_01_foundations` | Logic Gate Foundations | Easy | 3 (2) | 3 → 1 |
| 2 | `level_02_xor` | Spot the Difference | Easy | 4 (2) | 4 → 2 |
| 3 | `level_03_nand` | The Inverted Combination | Hard | 5 (3) | 5 → 3 |
| 4 | `level_04_nor` | A Quiet Signal | Hard | 6 (3) | 6 → 4 |
| 5 | `level_05_xnor` | The Complete Circuit | Hard | 9 (5) | 8 → 5 |
| 6 | `level_06_choices` | Pick the Right Tool | Easy | 3 (3) | 4 → 3 |
| 7 | `level_07_tied` | Tied Together | Easy | 4 (3) | 3 → 3 |
| 8 | `level_08_mirror` | Mirror Match | Hard | 6 (4) | 5 → 3 |
| 9 | `level_09_shared` | Shared Resources | Hard | 6 (6) | 6 → 5 |
| 10 | `level_10_finale` | The Grand Finale | Hard | 8 (4) | 8 → 4 |

**Difficulty curve.**

- **Levels 1–5** introduce one gate type each. Every empty slot accepts exactly one gate, so the puzzle is working out the logic rather than choosing gates.
- **Level 6 onward**, slots can accept more than one gate (`"allowedGates": ["AND", "XOR", "XNOR"]`), so the player has to choose.
- **Level 7** ties both pins of a gate to the same wire. A NAND or NOR with tied inputs behaves like NOT, which teaches that equivalence.
- **Later levels** give palettes where every gate must be used, so spending a gate in the wrong place leaves another slot unsolvable.

Levels 6–10 each have exactly one solution for their fixed inputs, and the linter (§2.4) proves every level has at least one. `docs/level-diagrams.md` has a wiring diagram for every level.

### 2.3 Connecting Levels to the Loader

The frontend never reads level JSON directly. `src/content/levelCatalog.ts` imports the level files and runs each one through the loader once, when the app starts:

```ts
export const mainLevels: readonly LevelConfig[] =
  [foundations, xor, nand, nor, xnor].map(loadLevel);
```
*Listing 2: The level catalog on `main`.*

The level selector draws one button per entry in `mainLevels`, and `SceneController.openLevel(id)` passes the chosen `LevelConfig` to `LevelScreen`. Adding a level means adding its JSON file and one entry in the catalog.

**What `loadLevel` guarantees.** It treats level files as untrusted and returns a typed, compiled `LevelConfig`, or throws a `LevelValidationError` naming the exact field at fault. It checks that:

- every gate name is real, every palette count is a whole number of 0 or more, and gates missing from the palette count as 0
- each slot has 1 or 2 input pins, matching its allowed and assigned gates (NOT takes 1, the rest take 2)
- `allowedGates` is non-empty with no repeats, and any pre-placed gate is allowed and within the palette
- every input points at a real primary input or slot, wire IDs are unique, and every primary output is produced by some slot
- there are no cycles; the loader computes `executionOrder` once with Kahn's algorithm, as the original plan specified
- `inputValues` and `targetOutputs` have exactly one 0 or 1 per declared input and output, and every hint's `triggerSlotId` points at a real slot

**Levels 6–10 and the selector.** Ten buttons overflow the level selector's menu image, so the catalog on `feat/levels-06-10` still lists only levels 1–5. Levels 6–10 are complete and checked by the linter, and they need a paged or scrolling selector before they can be listed.

### 2.4 Build-Time Level Linter

`npm run lint:levels` (`scripts/lint-levels.mjs`) runs every level file through `loadLevel` and then a solver (`src/content/levelLinter.ts`). The solver searches gate placements in execution order, respecting palette counts and `allowedGates`. It stops as soon as one placement produces every target output, and fails the level if none does. It has a step limit, so a level that is too large fails with a clear message instead of hanging CI.

## 3 Backend: Minigames

### 3.1 Timed Mode

`LevelScreen` can run any level against the clock:

```ts
new LevelScreen({ level, storage, timed: true, durationSeconds: 15 });
```

- The timer starts at `durationSeconds` (15 by default) and counts down once per second in `#timer-display`.
- Solving the level stops the clock and shows "Level Complete!" with the time left. Reaching 0 shows "Time's Up!".
- Once the game is over, placing, removing and undoing are all blocked, and the undo button is disabled.
- Play Again and Reset reload the level and restart the clock.
- Normal levels are untimed. `timed` defaults to `false`, and the timer display is hidden.

### 3.2 Name That Gate

A standalone minigame. The player sees a circuit with two inputs, one output and a hidden gate, and has to name the gate from how it answers tests.

- **Progressive clues.** A single test never identifies a gate (`1, 1 → 1` fits AND, OR and XNOR). A guess that fits every test shown so far is not penalized; instead the game adds a test that rules it out. Only a guess that contradicts a visible test costs a life.
- **Always solvable within three tests.** The six gates are symmetric, so there are only three distinct tests (0, 1 or 2 inputs on), and each gate answers them differently.
- **Runs.** 3 lives, a streak counter, a best streak saved in the browser, and 15 seconds per circuit. The clock starts over for each new circuit.
- **Shares the engine.** Outputs come from `evaluateGate`, the same gate registry the main game uses.

The full specification is in `docs/minigame-name-that-gate.md`. The screen is registered as `{ type: "gateGuess" }` but has no entry point yet. The sidebar's Mini-Games button (§1.2) is the planned way in.

## 4 Backend: Saving Progress Across Refreshes

### 4.1 What Is Saved and When

`LevelScreen` subscribes to the game store. After every accepted action (place, remove, undo, reset), it saves the board for that level. When a level opens, it restores the saved board before the first render. A refresh therefore puts every gate back where the player left it.

```json
{
  "version": 2,
  "levels": {
    "level_03_nand": {
      "completed": false,
      "stars": 0,
      "placements": {
        "slot_and_left": "AND", "slot_or_right": "OR",
        "slot_nand": "NAND", "slot_not": "NULL", "slot_output": "NULL"
      }
    }
  }
}
```
*Listing 3: What is stored in `localStorage` under `cse110-team25:progress`.*

| Field | Meaning |
|---|---|
| `placements` | The latest board: the gate in every slot, including pre-placed ones, or `"NULL"` for empty. Overwritten on every save. |
| `completed` | Whether the level has ever been solved. Once true, it stays true. |
| `stars` | The best star rating, 0–3. It is kept at the highest value ever saved. Star scoring is not implemented yet, so this is always 0 for now. |

The best streak for Name That Gate is stored separately under `cse110-team25:gate-guess-best`, so minigame data can never corrupt level progress.

### 4.2 Defensive Loading

Saved data comes from the browser and can be stale, edited by hand, or written by an older version of the game. The `StorageAdapter` never trusts it:

1. **Versioned.** Data with an unknown version is ignored. Version 1 saves, which stored empty slots as `null`, are upgraded on read to the current `"NULL"` value.
2. **Checked per level.** An entry with a malformed `completed` or `stars` value is dropped without affecting the other levels.
3. **Checked against the current level.** Saved placements are restored only if every slot still exists, every gate fits that slot's pins and `allowedGates`, and the total stays within the palette. If a level file changes after a save, the board starts fresh rather than in an impossible state.
4. **Checked once more on restore.** `LevelScreen` runs the restored board through `loadLevel`, so a save that fits on its own but conflicts with the level's pre-placed gates also falls back to a fresh board.
5. **Safe to fail.** If storage is missing, blocked (for example in a private window) or full, reads return empty progress and writes return `false`. The game keeps working; it just doesn't remember.
6. **Isolated.** The adapter only touches its own key. `clear()` removes that key and nothing else.

## 5 Testing and CI

### 5.1 Isolation

- **Store tests:** the game store takes an injected `evaluate` function, so they run without the simulator.
- **Storage tests:** `StorageAdapter` takes any `StorageLike`, so they use an in-memory object, including ones that throw on read or write.
- **Screen tests:** `LevelScreen` tests replace the Konva board with a recorder, since jsdom has no real canvas. The Name That Gate tests inject a seeded random generator and use Vitest fake timers, so they never wait in real time.

### 5.2 Test Coverage

| Area | Test file | What it checks |
|---|---|---|
| Level loader | `src/content/levelLoader.test.ts` | Every validation rule in §2.3 rejects bad input with the right field path, and valid files compile with the right `executionOrder`. |
| Level linter | `src/content/levelLinter.test.ts`, `scripts/lint-levels.test.mjs` | Solvable levels pass with a working placement. Unsolvable, over-large and malformed levels fail with clear messages. |
| Saving | `src/persistence/storageAdapter.test.ts` | Saves read back exactly. Completion and best stars are never lost. Version 1 saves are upgraded. Corrupt, mismatched or over-palette data is rejected. Storage that throws is handled. |
| Level screen | `src/ui/LevelScreen.test.ts` | Boards are restored when a level is reopened and saved after each action, including undo. Saves that no longer fit fall back to the authored board. Play continues when storage rejects writes. The sidebar closes on leaving a level. The timer stays hidden in normal mode, counts down in timed mode, stops on a win, shows Time's Up at 0, and restarts on Play Again. |
| Name That Gate | `src/minigames/*.test.ts` | Every hidden gate is identified within three tests for every order of guesses. Lives, streak and timer work, and the screen responds correctly to clicks. |

### 5.3 CI

`.github/workflows/ci.yml` runs on every push to any branch and on every pull request into `main`, on Node 22 and Node 24:

```
npm ci  →  npm run lint  →  npm run lint:levels  →  npm test  →  npm run build
```

A pull request that breaks a level's solvability, a test, lint or the build fails CI before it can be merged.
