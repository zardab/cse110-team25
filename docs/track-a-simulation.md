# Track A: Simulation

## Owns

- Pure gate functions for every `GateType`.
- Evaluation over `LevelConfig.executionOrder`.
- Wire-state propagation, completion status, and comparison with target outputs.

## Contract

Implement the evaluator signature and semantics in the [implementation contract](implementation-contract.md). Read placements from each slot's `assignedGate`; a `"NULL"` assignment produces a floating output. Gate functions must not mutate the level or input records. Preserve each slot's ordered input pins. `NOT` has one input; every other gate has two. If any gate input is `FLOATING`, its output is `FLOATING`.

The evaluator uses the supplied primary inputs to produce the live `wireStates`. It reports whether every slot has a gate assigned and whether every declared output currently matches its target. It must not sort the graph at runtime; the loader supplies the order.

## Tests Before Integration

- Test every input combination for each gate.
- Test floating propagation, missing placements, and primary-input wire states.
- Test a multi-slot circuit and verify evaluation follows `executionOrder`.
- Test that `isSolved` checks all declared outputs and requires a complete board.

Use static in-memory fixtures until Track C's loader is ready. Do not import the loader into simulation tests.
