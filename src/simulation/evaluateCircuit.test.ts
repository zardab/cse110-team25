import { describe, expect, it } from 'vitest';
import type { CircuitSlot, LevelConfig } from '../types/circuit';
import { evaluateCircuit } from './evaluateCircuit';

const xorLevel: LevelConfig = {
    id: 'xor',
    title: 'XOR',
    difficulty: 'EASY',
    availableGatePalette: { AND: 2, OR: 1, NOT: 2, XOR: 0, NAND: 0, NOR: 0, XNOR: 0 },
    primaryInputs: ['in_A', 'in_B'],
    primaryOutputs: ['out_Y', 'wire_not_a'],
    targetOutputs: { out_Y: 1, wire_not_a: 1 },
    slots: {
        not_a: {
            id: 'not_a',
            allowedGates: ['NOT'],
            assignedGate: 'NOT',
            inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'in_A' }],
            outputWireId: 'wire_not_a',
        },
        not_b: {
            id: 'not_b',
            allowedGates: ['NOT'],
            assignedGate: 'NOT',
            inputs: [{ sourceType: 'PRIMARY_INPUT', sourceId: 'in_B' }],
            outputWireId: 'wire_not_b',
        },
        and_a_not_b: {
            id: 'and_a_not_b',
            allowedGates: ['AND'],
            assignedGate: 'AND',
            inputs: [
                { sourceType: 'PRIMARY_INPUT', sourceId: 'in_A' },
                { sourceType: 'SLOT_OUTPUT', sourceId: 'not_b' },
            ],
            outputWireId: 'wire_a_not_b',
        },
        and_not_a_b: {
            id: 'and_not_a_b',
            allowedGates: ['AND'],
            assignedGate: 'AND',
            inputs: [
                { sourceType: 'SLOT_OUTPUT', sourceId: 'not_a' },
                { sourceType: 'PRIMARY_INPUT', sourceId: 'in_B' },
            ],
            outputWireId: 'wire_not_a_b',
        },
        or_terms: {
            id: 'or_terms',
            allowedGates: ['OR'],
            assignedGate: 'OR',
            inputs: [
                { sourceType: 'SLOT_OUTPUT', sourceId: 'and_a_not_b' },
                { sourceType: 'SLOT_OUTPUT', sourceId: 'and_not_a_b' },
            ],
            outputWireId: 'out_Y',
        },
    },
    executionOrder: ['not_a', 'not_b', 'and_a_not_b', 'and_not_a_b', 'or_terms'],
    hints: [],
};

describe('evaluateCircuit', () => {
    it('evaluates the graph for the supplied primary inputs', () => {
        const result = evaluateCircuit(xorLevel, { in_A: 0, in_B: 1 });

        expect(result.isComplete).toBe(true);
        expect(result.isSolved).toBe(true);
        expect(result.wireStates).toMatchObject({ in_A: 0, in_B: 1, out_Y: 1 });
    });

    it('requires every declared output to match its target', () => {
        const level = {
            ...xorLevel,
            targetOutputs: { ...xorLevel.targetOutputs, wire_not_a: 0 as const },
        };
        const result = evaluateCircuit(level, { in_A: 0, in_B: 1 });

        expect(result.isComplete).toBe(true);
        expect(result.isSolved).toBe(false);
        expect(result.wireStates.out_Y).toBe(1);
    });

    it('does not consider a level with no target outputs solved', () => {
        const level = { ...xorLevel, primaryOutputs: [], targetOutputs: {} };
        const result = evaluateCircuit(level, { in_A: 0, in_B: 1 });

        expect(result.isComplete).toBe(true);
        expect(result.isSolved).toBe(false);
    });

    it('marks empty slots and downstream wires as floating', () => {
        const slots: Record<string, CircuitSlot> = {
            ...xorLevel.slots,
            not_a: { ...xorLevel.slots.not_a, assignedGate: 'NULL' },
        };
        const result = evaluateCircuit({ ...xorLevel, slots }, { in_A: 1, in_B: 0 });

        expect(result.isComplete).toBe(false);
        expect(result.isSolved).toBe(false);
        expect(result.wireStates.wire_not_a).toBe('FLOATING');
        expect(result.wireStates.wire_not_a_b).toBe('FLOATING');
    });

    it('evaluates slots in the precompiled order rather than record insertion order', () => {
        const slots = Object.fromEntries(Object.entries(xorLevel.slots).reverse());
        const result = evaluateCircuit({ ...xorLevel, slots }, { in_A: 1, in_B: 0 });

        expect(result.wireStates.out_Y).toBe(1);
    });
});

// A two-slot mock level built directly in code: out = NOT(a NAND b).
// executionOrder is written by hand because the loader does not exist yet.
const chainLevel: LevelConfig = {
    id: 'mock_chain',
    title: 'Mock Chain',
    difficulty: 'EASY',
    availableGatePalette: { AND: 0, OR: 0, NOT: 1, XOR: 0, NAND: 1, NOR: 0, XNOR: 0 },
    primaryInputs: ['a', 'b'],
    primaryOutputs: ['y'],
    targetOutputs: { y: 1 },
    slots: {
        s_nand: {
            id: 's_nand',
            allowedGates: ['NAND'],
            assignedGate: 'NAND',
            inputs: [
                { sourceType: 'PRIMARY_INPUT', sourceId: 'a' },
                { sourceType: 'PRIMARY_INPUT', sourceId: 'b' },
            ],
            outputWireId: 'w_nand',
        },
        s_not: {
            id: 's_not',
            allowedGates: ['NOT'],
            assignedGate: 'NOT',
            inputs: [{ sourceType: 'SLOT_OUTPUT', sourceId: 's_nand' }],
            outputWireId: 'y',
        },
    },
    executionOrder: ['s_nand', 's_not'],
    hints: [],
};

describe('evaluateCircuit on a mock level', () => {
    it('carries each slot output through to the next slot', () => {
        const result = evaluateCircuit(chainLevel, { a: 1, b: 1 });

        expect(result.wireStates).toEqual({ a: 1, b: 1, w_nand: 0, y: 1 });
        expect(result.isComplete).toBe(true);
        expect(result.isSolved).toBe(true);
    });

    it('reports unsolved when the final output differs from its target', () => {
        const result = evaluateCircuit(chainLevel, { a: 1, b: 0 });

        expect(result.wireStates).toEqual({ a: 1, b: 0, w_nand: 1, y: 0 });
        expect(result.isSolved).toBe(false);
    });

    it('floats the downstream output when an upstream slot is empty', () => {
        const slots = {
            ...chainLevel.slots,
            s_nand: { ...chainLevel.slots.s_nand, assignedGate: 'NULL' as const },
        };
        const result = evaluateCircuit({ ...chainLevel, slots }, { a: 1, b: 1 });

        expect(result.wireStates.w_nand).toBe('FLOATING');
        expect(result.wireStates.y).toBe('FLOATING');
        expect(result.isComplete).toBe(false);
        expect(result.isSolved).toBe(false);
    });
});
