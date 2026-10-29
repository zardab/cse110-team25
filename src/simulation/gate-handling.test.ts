import { describe, it, expect } from 'vitest';
import type {
  CircuitSlot,
  GateType,
  SignalState,
  SimulationResult,
} from '../types/circuit';
import { placeGate, removeGate } from './gate-handling';

// setup

const makeSim = (wireStates: Record<string, SignalState>): SimulationResult => ({
  isComplete: false,
  isSolved: false,
  wireStates,
});

const binarySlot: CircuitSlot = {
  id: 'slot_bin',
  assignedGate: 'NULL',
  inputs: [
    { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
    { sourceType: 'PRIMARY_INPUT', sourceId: 'b' },
  ],
  outputWireId: 'y',
};

const unarySlot: CircuitSlot = {
  id: 'slot_un',
  assignedGate: 'NULL',
  inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'a' }],
  outputWireId: 'y',
};

type Row = readonly [0 | 1, 0 | 1, 0 | 1];

const binaryTruthTables: ReadonlyArray<{
  gate: Exclude<GateType, 'NOT'>;
  rows: ReadonlyArray<Row>;
}> = [
  { gate: 'AND',  rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]] },
  { gate: 'OR',   rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]] },
  { gate: 'XOR',  rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]] },
  { gate: 'NAND', rows: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] },
  { gate: 'NOR',  rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 0]] },
  { gate: 'XNOR', rows: [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1]] },
];

// checking placeGate binary gates

describe('placeGate with two-input gates', () => {
  describe.each(binaryTruthTables)('$gate', ({ gate, rows }) => {
    it('writes the correct output for every input combination', () => {
      for (const [a, b, expected] of rows) {
        const result = placeGate(gate, binarySlot, makeSim({ a, b }));
        expect(result.wireStates.y).toBe(expected);
      }
    });

    it('outputs FLOATING when either input is FLOATING', () => {
      const cases: Array<Record<string, SignalState>> = [
        { a: 'FLOATING', b: 0 },
        { a: 'FLOATING', b: 1 },
        { a: 0, b: 'FLOATING' },
        { a: 1, b: 'FLOATING' },
        { a: 'FLOATING', b: 'FLOATING' },
      ];
      for (const wires of cases) {
        const result = placeGate(gate, binarySlot, makeSim(wires));
        expect(result.wireStates.y).toBe('FLOATING');
      }
    });
  });

  it('does not change the input wires', () => {
    const result = placeGate('AND', binarySlot, makeSim({ a: 1, b: 0 }));
    expect(result.wireStates.a).toBe(1);
    expect(result.wireStates.b).toBe(0);
  });

  it('leaves unrelated wires untouched', () => {
    const result = placeGate('AND', binarySlot, makeSim({ a: 1, b: 1, other: 0 }));
    expect(result.wireStates.other).toBe(0);
  });

  it('overwrites a previous value on the output wire', () => {
    const result = placeGate('OR', binarySlot, makeSim({ a: 1, b: 0, y: 0 }));
    expect(result.wireStates.y).toBe(1);
  });

  it('replacing a gate recomputes the output with the new gate', () => {
    const afterAnd = placeGate('AND', binarySlot, makeSim({ a: 1, b: 0 }));
    expect(afterAnd.wireStates.y).toBe(0);

    const afterOr = placeGate('OR', binarySlot, afterAnd);
    expect(afterOr.wireStates.y).toBe(1);
  });

  it('returns a SimulationResult that still has the expected shape', () => {
    const result = placeGate('AND', binarySlot, makeSim({ a: 1, b: 1 }));
    expect(result).toHaveProperty('wireStates');
    expect(result).toHaveProperty('isComplete');
    expect(result).toHaveProperty('isSolved');
  });
});

// checking removeGate()

describe('removeGate on a two-input slot', () => {
  it('sets the output wire to FLOATING, not 0', () => {
    const result = removeGate(binarySlot, makeSim({ a: 1, b: 1, y: 1 }));
    expect(result.wireStates.y).toBe('FLOATING');
  });

  it('FLOATING is returned even when the previous output was 0', () => {
    const result = removeGate(binarySlot, makeSim({ a: 0, b: 0, y: 0 }));
    expect(result.wireStates.y).toBe('FLOATING');
  });

  it('leaves the input wires untouched', () => {
    const result = removeGate(binarySlot, makeSim({ a: 1, b: 0, y: 1 }));
    expect(result.wireStates.a).toBe(1);
    expect(result.wireStates.b).toBe(0);
  });

  it('place then remove leaves the output FLOATING', () => {
    const placed = placeGate('XOR', binarySlot, makeSim({ a: 1, b: 0 }));
    expect(placed.wireStates.y).toBe(1);

    const removed = removeGate(binarySlot, placed);
    expect(removed.wireStates.y).toBe('FLOATING');
  });
});
// checking placeGate with a NOT gate

describe('placeGate with a NOT gate', () => {
  it('inverts its single input', () => {
    expect(placeGate('NOT', unarySlot, makeSim({ a: 0 })).wireStates.y).toBe(1);
    expect(placeGate('NOT', unarySlot, makeSim({ a: 1 })).wireStates.y).toBe(0);
  });

  it('outputs FLOATING when its input is FLOATING', () => {
    expect(placeGate('NOT', unarySlot, makeSim({ a: 'FLOATING' })).wireStates.y).toBe('FLOATING');
  });

  it('removeGate sets the output FLOATING', () => {
    const placed = placeGate('NOT', unarySlot, makeSim({ a: 0 }));
    expect(removeGate(unarySlot, placed).wireStates.y).toBe('FLOATING');
  });
});

describe('placeGate immutability', () => {
  it('does not mutate the SimulationResult passed in', () => {
    const sim = makeSim({ a: 1, b: 1 });
    placeGate('AND', binarySlot, sim);
    expect(sim.wireStates).toEqual({ a: 1, b: 1 });
  });
});
