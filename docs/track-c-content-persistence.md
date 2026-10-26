# Track C: Content and Persistence

## Owns

- Parsing and validating authored level JSON as `LevelDefinition`.
- Producing normalized `LevelConfig` values, including `executionOrder`.
- Build-time level linting.
- Versioned browser persistence through a storage adapter.

## Level Loading

Treat JSON as untrusted input. Validate required fields, two-mode difficulty, gate names and counts, unique IDs, source references, pin arity, output-wire references, and truth-table input/output keys. Preserve input order. Normalize omitted palette counts to zero. Return actionable validation errors; do not silently repair invalid wiring or cycles.

Compile the fixed slot dependency graph once during loading. Reject cycles and references to unknown slots or primary inputs. Use a stable topological ordering so fixtures and diagnostics remain reproducible. The evaluator must not recompute this order.

## Linting and Solvability

The offline linter checks every level file for schema errors, cycles, disconnected or invalid pins, and at least one solvable assignment from the allowed palette. Reuse loader validation and the simulation contract where practical. Keep fixtures small enough for exhaustive solvability checks; report which level and constraint failed.

## Persistence

Persist only user progress and saved placements, with a schema version. Do not persist compiled levels, execution order, or derived wire states. Handle absent storage, invalid JSON, and unsupported versions without preventing play; validate restored placements against the loaded level before applying them.

## Tests Before Integration

- Load the documented sample after changing its difficulty to `HARD`.
- Reject malformed levels, unknown sources, invalid arity, and cycles.
- Assert deterministic execution order for a known DAG.
- Verify missing palette keys normalize to zero.
- Round-trip progress and placements; test malformed, absent, and older-version storage.
- Run the linter against valid and intentionally invalid fixtures.

Track A can use in-memory compiled-level fixtures, and Track B can use a storage mock. Neither track needs to wait for browser persistence.