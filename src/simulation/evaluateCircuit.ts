import type {
    CircuitSlot,
    LevelConfig,
    PrimaryInputValues,
    SignalSource,
    SignalState,
    SimulationResult,
} from '../types/circuit';
import { evaluateGate } from './gates';

function resolveSource(
    source: SignalSource,
    slots: Record<string, CircuitSlot>,
    wireStates: Record<string, SignalState>,
): SignalState {
    if (source.sourceType === 'PRIMARY_INPUT') {
        if (!Object.hasOwn(wireStates, source.sourceId)) {
            throw new Error(`Unknown primary input: ${source.sourceId}`);
        }
        return wireStates[source.sourceId];
    }

    const sourceSlot = slots[source.sourceId];
    if (!sourceSlot) {
        throw new Error(`Unknown source slot: ${source.sourceId}`);
    }
    if (!Object.hasOwn(wireStates, sourceSlot.outputWireId)) {
        throw new Error(`Slot ${source.sourceId} has not been evaluated before its consumer`);
    }
    return wireStates[sourceSlot.outputWireId];
}

function evaluateWithInputs(
    level: LevelConfig,
    primaryInputs: PrimaryInputValues,
): Record<string, SignalState> {
    const wireStates: Record<string, SignalState> = { ...primaryInputs };

    for (const slotId of level.executionOrder) {
        const slot = level.slots[slotId];
        if (!slot) {
            throw new Error(`Execution order references unknown slot: ${slotId}`);
        }

        const inputStates = slot.inputs.map((source) => resolveSource(source, level.slots, wireStates));
        wireStates[slot.outputWireId] = slot.assignedGate === 'NULL'
            ? 'FLOATING'
            : evaluateGate(slot.assignedGate, inputStates);
    }

    return wireStates;
}

export function evaluateCircuit(
    level: LevelConfig,
    primaryInputs: PrimaryInputValues,
): SimulationResult {
    const isComplete = Object.values(level.slots).every((slot) => slot.assignedGate !== 'NULL');
    const wireStates = evaluateWithInputs(level, primaryInputs);
    const isSolved = isComplete && level.primaryOutputs.length > 0 && level.primaryOutputs.every(
        (outputId) => wireStates[outputId] === level.targetOutputs[outputId],
    );

    return {
        isComplete,
        isSolved,
        wireStates,
    };
}
