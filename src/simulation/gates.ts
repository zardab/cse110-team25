import type { GateType, SignalState } from '../types/circuit';

export function evaluateGate(gate: GateType, inputs: ReadonlyArray<SignalState>): SignalState {
    const expectedInputCount = gate === 'NOT' ? 1 : 2;
    if (inputs.length !== expectedInputCount) {
        throw new Error(`${gate} expects ${expectedInputCount} input(s), received ${inputs.length}`);
    }

    if (inputs.includes('FLOATING')) {
        return 'FLOATING';
    }

    const bits = inputs.map((input) => input === 1);
    const [first, second] = bits;

    switch (gate) {
        case 'AND':
            return first && second ? 1 : 0;
        case 'OR':
            return first || second ? 1 : 0;
        case 'NOT':
            return first ? 0 : 1;
        case 'XOR':
            return first !== second ? 1 : 0;
        case 'NAND':
            return first && second ? 0 : 1;
        case 'NOR':
            return first || second ? 0 : 1;
        case 'XNOR':
            return first === second ? 1 : 0;
    }
}
