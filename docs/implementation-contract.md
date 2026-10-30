# Implementation Contract

This document defines the boundaries shared by Tracks A, B, and C. The TypeScript interfaces in `src/types/circuit.ts` are the machine-readable source of truth. Do not create parallel definitions of these types in track modules.

## Level Data

- Difficulty has exactly two values: `EASY` and `HARD`. The example level's `INTERMEDIATE` value must be changed to `HARD`.
- `LevelDefinition` represents authored JSON. Its gate palette may omit gates; an omitted count means zero. Every slot uses the same `CircuitSlot` shape and must specify `assignedGate`; use `"NULL"` for an empty slot.
- `LevelConfig` represents a validated, compiled level. The loader expands the palette to include every playable `GateType`, using zero for missing counts, and supplies `executionOrder`.
- `CircuitSlot.assignedGate` is either a playable `GateType` or the sentinel `"NULL"`. The sentinel is not a playable gate and must not appear in `allowedGates` or the gate palette. Input order is significant and must be preserved. Track B changes placements by replacing slot values; it never changes connections.
- `primaryInputs` lists the input IDs. `primaryOutputs` lists output wire IDs, and `targetOutputs` maps every output ID to its desired binary value. Primary input values supplied to evaluation must match the declared input IDs.
- Any source that cannot be resolved is an error in the level definition, not a runtime floating value.

## Evaluation Boundary

Track A exposes:

```ts
evaluateCircuit(
  level: LevelConfig,
  primaryInputs: PrimaryInputValues,
): SimulationResult
```

The result's `wireStates` describe the supplied primary input values. `isComplete` is true only when every slot has an assigned gate other than `"NULL"`. `isSolved` is true only when the board is complete and every declared primary output matches its value in `targetOutputs` for the supplied primary inputs. A `"NULL"` slot and its downstream outputs are `FLOATING`; a gate with any floating input produces a floating output.

## Game State Boundary

Track B owns the store and exposes `getState`, `dispatch`, and `subscribe`. Actions are:

| Action         | Payload          | Behavior                                                                    |
| -------------- | ---------------- | --------------------------------------------------------------------------- |
| `PLACE_GATE`   | `slotId`, `gate` | Replace that slot's `assignedGate`; decrement its inventory.                |
| `REMOVE_GATE`  | `slotId`         | Set the slot's `assignedGate` to `"NULL"` and return its gate to inventory. |
| `RESET_BOARD`  | none             | Clear all placements and restore the level's starting inventory.            |
| `CHECK_ANSWER` | none             | Evaluate now; meaningful in Hard mode.                                      |
| `UNDO`         | none             | Restore the previous board and inventory snapshot when available.           |
| `REDO`         | none             | Reapply the next board and inventory snapshot when available.               |

Invalid placements leave state unchanged. Easy mode evaluates after every successful placement, removal, reset, undo, and redo. Hard mode does not evaluate those mutations; it evaluates only on `CHECK_ANSWER`. A board mutation in Hard mode clears stale result feedback. Checking an incomplete board is allowed and reports `isComplete: false`.

## Persistence Boundary

Track C owns a versioned storage format and adapter. Persist level progress and saved placements keyed by slot ID, not compiled execution order or transient wire states. Track B restores saved placements into each slot's `assignedGate`. Storage must tolerate missing, malformed, and older-version data by returning safe defaults rather than breaking level play. The adapter must not depend on Track B's store implementation.

`src/persistence/storageAdapter.ts` exposes `StorageAdapter` with `getProgress`,
`loadLevel`, `saveLevel`, `removeLevel`, and `clear`. Browser storage is the default;
tests and other callers may inject `StorageLike` or `null`. Track B passes its
current `AssignedGates` to the adapter and applies restored placements through
its own state logic. The adapter does not mutate the store or evaluate the board.

The storage key is `cse110-team25:progress`. Version 1 stores this shape:

```ts
type SavedProgressV1 = {
  version: 1
  levels: Record<string, {
    completed: boolean
    stars: number // integer from 0 through 3
    placements: AssignedGates
  }>
}
```

`saveLevel(level, progress)` validates the placement map, preserves earned
completion and the highest star count, and replaces the saved board. It returns
`false` for invalid input or unavailable storage. `loadLevel(level)` checks slot
IDs, gate types, pin arity, slot restrictions, and palette counts against the
current level. If any placement is invalid, it returns an empty board while
preserving valid completion/stars. Absent or unsupported data returns
`{ completed: false, stars: 0, placements: {} }`. Reads never rewrite saved data.
No migration from an older version is defined yet. `getProgress()` returns only
completion/star summaries; board restoration always requires a loaded level.
`removeLevel` resets one level, and `clear` removes only the adapter's own key.

## Integration Rules

- Track A may use in-memory `LevelConfig` fixtures and does not wait for Track C.
- Track B may use the documented `SimulationResult` mock and does not wait for Track A.
- Track C can implement and test the loader and adapter against these interfaces independently.
- Changes to shared types, evaluator signatures, action payloads, or persisted data shape require updating this document and the affected track guide in the same pull request.
- Each track owns its implementation and tests. Do not edit another track's module to make local tests pass; raise a contract change instead.
