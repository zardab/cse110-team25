# Track A: Simulation

## Owns

- Pure gate functions for every `GateType`.
- Evaluation over `LevelConfig.executionOrder`.
- Wire-state propagation and truth-table comparison.
- Deterministic `firstDivergentSlotId` diagnostics.

## Contract

Implement the evaluator signature and semantics in the [implementation contract](implementation-contract.md). Gate functions must not mutate the level, placements, or input records. Preserve each slot's ordered input pins. `NOT` has one input; every other gate has two. If any gate input is `FLOATING`, its output is `FLOATING`.

The evaluator uses the supplied primary inputs to produce the live `wireStates`, and independently checks every target truth-table row to determine `isSolved`. It must not sort or traverse the graph at runtime; the loader supplies the order.

## Tests Before Integration

- Unit-test each gate's complete truth table.
- Test floating propagation, missing placements, and primary-input wire states.
- Test a multi-slot circuit and verify evaluation follows `executionOrder`.
- Test solved and unsolved boards against all target rows, including a case where the supplied live inputs pass but another target row fails.
- Test stable divergence selection when multiple outputs or slots contribute to a mismatch.

Use static in-memory fixtures until Track C's loader is ready. Do not import the loader into simulation tests.