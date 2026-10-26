# Track B: Game State

## Owns

- Central game store, action dispatch, and subscriptions.
- Placement validation and palette inventory changes.
- Easy/Hard evaluation timing.
- Undo, redo, and reset behavior.

## Contract

Use `LevelConfig` as immutable level data and `AssignedGates` as mutable board state represented immutably. Follow the actions and mode behavior in the [implementation contract](implementation-contract.md). Track B calls the evaluator through an injected function or narrow module boundary so store tests can use a mock until Track A is ready.

Placement is valid only if the slot exists, the gate is allowed when `allowedGates` is present, and inventory is available. Invalid actions must not decrement inventory or add history. Removing a gate restores exactly one unit. Reset restores the starting palette and clears placements. Undo and redo restore placements and inventory together; a new board mutation after undo discards the redo branch.

## Tests Before Integration

- Inventory decrements on valid placement and is unchanged on invalid placement.
- Removing a placed gate restores inventory.
- Reset restores the initial board and inventory.
- Undo and redo restore both placements and inventory; a new action clears redo history.
- Easy mode evaluates after board mutations; Hard mode evaluates only on `CHECK_ANSWER`.
- Subscribers are notified after state changes, not after rejected actions.

Do not implement gate logic or persistence in the store. Delegate simulation to Track A and browser storage to Track C.