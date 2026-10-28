/**
 * AI Assistance Disclosure
 *
 * The initial structure and test cases in this file were generated with
 * assistance from ChatGPT (OpenAI). The tests were reviewed against the
 * project's implementation contract and truth-table requirements before use.
 *
 * The author is responsible for understanding, verifying, and maintaining
 * these tests.
 */

import { describe, expect, it } from 'vitest';

import type {
  GateType,
  SignalState,
} from '../types/circuit';

import { evaluateGate } from './gates';

interface BinaryGateCase {
  gate: Exclude<GateType, 'NOT'>;

  rows: ReadonlyArray<readonly [0 | 1, 0 | 1, 0 | 1]>;
}

const binaryGateCases: ReadonlyArray<BinaryGateCase> = [
  {
    gate: 'AND',
    rows: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
  },

  {
    gate: 'OR',
    rows: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
  },

  {
    gate: 'XOR',
    rows: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
  },

  {
    gate: 'NAND',
    rows: [
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
  },

  {
    gate: 'NOR',
    rows: [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 0],
    ],
  },

  {
    gate: 'XNOR',
    rows: [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
];

const floatingBinaryInputs: ReadonlyArray<
  ReadonlyArray<SignalState>
> = [
  ['FLOATING', 0],
  ['FLOATING', 1],
  [0, 'FLOATING'],
  [1, 'FLOATING'],
  ['FLOATING', 'FLOATING'],
];

describe('evaluateGate', () => {
  describe.each(binaryGateCases)(
    '$gate',
    ({ gate, rows }) => {
      it('matches its complete truth table', () => {
        for (const [left, right, expected] of rows) {
          expect(
            evaluateGate(gate, [left, right]),
          ).toBe(expected);
        }
      });

      it('propagates FLOATING inputs', () => {
        for (const inputs of floatingBinaryInputs) {
          expect(
            evaluateGate(gate, inputs),
          ).toBe('FLOATING');
        }
      });
    },
  );

  describe('NOT', () => {
    it('matches its complete truth table', () => {
      expect(evaluateGate('NOT', [0])).toBe(1);
      expect(evaluateGate('NOT', [1])).toBe(0);
    });

    it('propagates FLOATING', () => {
      expect(
        evaluateGate('NOT', ['FLOATING']),
      ).toBe('FLOATING');
    });
  });
});