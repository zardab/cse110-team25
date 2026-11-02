# Track B: Game State

## Owns

- Central game store, action dispatch, and subscriptions.
- Placement validation and palette inventory changes.
- Easy/Hard evaluation timing.
- Undo, redo, and reset behavior.

**Current scope:** `PLACE_GATE` and `REMOVE_GATE` only. Reset, undo, redo, history, and `CHECK_ANSWER` are deferred; the rules below for them describe the intended behavior when they are added.

## Contract

Use each slot's `assignedGate` field as board state, with `"NULL"` representing an empty slot. Keep updates immutable by replacing the affected slot and level values. Follow the actions and mode behavior in the [implementation contract](implementation-contract.md). Track B calls the evaluator (which uses the level's `inputValues`) through an injected function or narrow module boundary so store tests can use a mock until Track A is ready.

Placement is valid only if the slot exists, the gate is allowed when `allowedGates` is present, and inventory is available. Invalid actions must not decrement inventory or change state. Placement also requires the gate's arity to match the slot's pin count (`NOT` takes one input, every other gate two), even when `allowedGates` is omitted. Replacing a placed gate returns the old one to inventory; placing the gate a slot already holds is rejected. Removing a gate restores exactly one unit. Reset restores the starting palette and clears placements. Undo and redo restore placements and inventory together; a new board mutation after undo discards the redo branch.

## Tests Before Integration

- Inventory decrements on valid placement and is unchanged on invalid placement.
- Removing a placed gate restores inventory.
- Easy mode evaluates after board mutations. Hard mode does not evaluate on mutations (it evaluates only on `CHECK_ANSWER` once that action exists).
- Deferred: reset restores the initial board and inventory; undo and redo restore both placements and inventory, and a new action clears redo history.
- Subscribers are notified after state changes, not after rejected actions.
- Unknown slots, unknown gates, disallowed gates, wrong arity, and an empty inventory are rejected.

The store lives in `src/state/store.ts` (`createStore(level, evaluate)`) with tests in `src/state/store.test.ts`.

Do not implement gate logic or persistence in the store. Delegate simulation to Track A and browser storage to Track C.
