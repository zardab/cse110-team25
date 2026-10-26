# Implementation Contract

This document defines the boundaries shared by Tracks A, B, and C. The TypeScript interfaces in `src/types/circuit.ts` are the machine-readable source of truth. Do not create parallel definitions of these types in track modules.

## Level Data

- Difficulty has exactly two values: `EASY` and `HARD`. The example level's `INTERMEDIATE` value must be changed to `HARD`.
- `LevelDefinition` represents authored JSON. Its gate palette may omit gates; an omitted count means zero.
- `LevelConfig` represents a validated, compiled level. The loader expands the palette to include every `GateType`, using zero for missing counts, and supplies `executionOrder`.
- A `CircuitSlot` contains fixed wiring only. Input order is significant and must be preserved. Gate placements live separately in `AssignedGates`; a missing key or `null` means the slot is empty.
- Primary input values are binary. Any source that cannot be resolved is an error in the level definition, not a runtime floating value.

## Evaluation Boundary

Track A exposes:

```ts
evaluateCircuit(
  level: LevelConfig,
  assignedGates: AssignedGates,
  primaryInputs: PrimaryInputValues,
): SimulationResult
```

The result's `wireStates` describe the supplied primary input values. `isComplete` is true only when every slot has an assigned gate. `isSolved` is true only when the board is complete and matches every row of `truthTableTarget`, not just the supplied live input values. For an incomplete board, unassigned slots and their downstream outputs are `FLOATING`; a gate with any floating input produces a floating output.

`firstDivergentSlotId` is `null` when the board is solved or incomplete. Otherwise, use the first failing truth-table row and report the earliest slot in `executionOrder` that lies in the dependency path to a mismatched primary output. This is a deterministic hint location, not a claim that the reported slot alone caused the mismatch.

## Game State Boundary

Track B owns the store and exposes `getState`, `dispatch`, and `subscribe`. Actions are:

| Action | Payload | Behavior |
| --- | --- | --- |
| `PLACE_GATE` | `slotId`, `gate` | Place an allowed, available gate; decrement its inventory. |
| `REMOVE_GATE` | `slotId` | Empty the slot and return its gate to inventory. |
| `RESET_BOARD` | none | Clear all placements and restore the level's starting inventory. |
| `CHECK_ANSWER` | none | Evaluate now; meaningful in Hard mode. |
| `UNDO` | none | Restore the previous board and inventory snapshot when available. |
| `REDO` | none | Reapply the next board and inventory snapshot when available. |

Invalid placements leave state unchanged. Easy mode evaluates after every successful placement, removal, reset, undo, and redo. Hard mode does not evaluate those mutations; it evaluates only on `CHECK_ANSWER`. A board mutation in Hard mode clears stale result feedback. Checking an incomplete board is allowed and reports `isComplete: false`.

## Persistence Boundary

Track C owns a versioned storage format and adapter. Persist level progress and saved placements, not compiled execution order or transient wire states. Storage must tolerate missing, malformed, and older-version data by returning safe defaults rather than breaking level play. The adapter must not depend on Track B's store implementation.

## Integration Rules

- Track A may use in-memory `LevelConfig` fixtures and does not wait for Track C.
- Track B may use the documented `SimulationResult` mock and does not wait for Track A.
- Track C can implement and test the loader and adapter against these interfaces independently.
- Changes to shared types, evaluator signatures, action payloads, or persisted data shape require updating this document and the affected track guide in the same pull request.
- Each track owns its implementation and tests. Do not edit another track's module to make local tests pass; raise a contract change instead.