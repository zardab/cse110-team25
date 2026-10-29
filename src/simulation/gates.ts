import type { GateType, SignalState } from '../types/circuit';

type BinarySignal = 0 | 1;

type GateEvaluator = (
  inputs: ReadonlyArray<SignalState>,
) => SignalState;

function binaryGate(
  operation: (
    left: BinarySignal,
    right: BinarySignal,
  ) => BinarySignal,
): GateEvaluator {
  return ([left, right]) => {
    if (left === 'FLOATING' || right === 'FLOATING') {
      return 'FLOATING';
    }

    return operation(left, right);
  };
}

function unaryGate(
  operation: (input: BinarySignal) => BinarySignal,
): GateEvaluator {
  return ([input]) => {
    if (input === 'FLOATING') {
      return 'FLOATING';
    }

    return operation(input);
  };
}

const gateRegistry: Record<GateType, GateEvaluator> = {
  AND: binaryGate((left, right) =>
    left === 1 && right === 1 ? 1 : 0
  ),

  OR: binaryGate((left, right) =>
    left === 1 || right === 1 ? 1 : 0
  ),

  NOT: unaryGate((input) =>
    input === 0 ? 1 : 0
  ),

  XOR: binaryGate((left, right) =>
    left !== right ? 1 : 0
  ),

  NAND: binaryGate((left, right) =>
    left === 1 && right === 1 ? 0 : 1
  ),

  NOR: binaryGate((left, right) =>
    left === 0 && right === 0 ? 1 : 0
  ),

  XNOR: binaryGate((left, right) =>
    left === right ? 1 : 0
  ),
};

export function evaluateGate(
  gate: GateType,
  inputs: ReadonlyArray<SignalState>,
): SignalState {
  const expectedInputCount = gate === 'NOT' ? 1 : 2;
  if (inputs.length !== expectedInputCount) {
    throw new Error(`${gate} expects ${expectedInputCount} input(s), received ${inputs.length}`);
  }

  return gateRegistry[gate](inputs);
}