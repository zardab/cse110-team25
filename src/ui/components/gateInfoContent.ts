import type { GateType } from '../../types/circuit';

export interface GateInfoContent {
  name: GateType;
  /** Optional nickname like “NOT-AND” */
  subtitle?: string;
  description: string;
  funFact?: string;
  inputs: ReadonlyArray<'A' | 'B'>;
  /** Rows of […inputs, out] as 0/1 */
  truthTable: ReadonlyArray<ReadonlyArray<0 | 1>>;
}

export const GATE_INFO: Record<GateType, GateInfoContent> = {
  AND: {
    name: 'AND',
    description:
      'Outputs true (1) only when all of its inputs are true (1). If any input is false (0), the output is false (0).',
    inputs: ['A', 'B'],
    truthTable: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  OR: {
    name: 'OR',
    description:
      'Outputs true (1) when at least one of its inputs is true (1). It only outputs false (0) when every input is false (0).',
    inputs: ['A', 'B'],
    truthTable: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
  },
  NOT: {
    name: 'NOT',
    description:
      'Flips a single input: true (1) becomes false (0), and false (0) becomes true (1). Also called an inverter.',
    inputs: ['A'],
    truthTable: [
      [0, 1],
      [1, 0],
    ],
  },
  XOR: {
    name: 'XOR',
    description:
      'Outputs true (1) when its inputs are different. If both inputs are the same, it outputs false (0).',
    funFact:
      'XOR is how computers check parity and add bits — it’s the “sum” half of a one-bit adder.',
    inputs: ['A', 'B'],
    truthTable: [
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
  },
  NAND: {
    name: 'NAND',
    subtitle: 'NOT-AND',
    description:
      'Outputs false (0) only when all of its inputs are true (1). In every other case, it outputs true (1). It’s the opposite of an AND gate.',
    funFact:
      'NAND is a universal gate: any other logic gate can be built using only NAND gates, which is why it’s a building block of real computer chips.',
    inputs: ['A', 'B'],
    truthTable: [
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
  },
  NOR: {
    name: 'NOR',
    subtitle: 'NOT-OR',
    description:
      'Outputs true (1) only when all of its inputs are false (0). In every other case, it outputs false (0). It’s the opposite of an OR gate.',
    funFact:
      'Like NAND, NOR is a universal gate — you can build any other logic function using only NOR gates.',
    inputs: ['A', 'B'],
    truthTable: [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 0],
    ],
  },
  XNOR: {
    name: 'XNOR',
    subtitle: 'NOT-XOR',
    description:
      'Outputs true (1) when its inputs are the same. If the inputs differ, it outputs false (0). It’s the opposite of an XOR gate.',
    inputs: ['A', 'B'],
    truthTable: [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
};
