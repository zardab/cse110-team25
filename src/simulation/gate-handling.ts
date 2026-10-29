import type { AssignedGate, CircuitSlot, SignalState, SimulationResult } from "../types/circuit";
import { evaluateGate } from "./gates";

// takes in what gate to place and where to place it, returns the new circuit state
export function placeGate(inputGate: AssignedGate, inputSlot: CircuitSlot, sim: SimulationResult): SimulationResult {
    // read each input wire's state
    const inputs: SignalState[] = [];
    for (const source of inputSlot.inputs) {
        const value = sim.wireStates[source.sourceId];
        // ?? used to safeguard against empty/undefined wire states
        inputs.push(value ?? 'FLOATING');
    }

    // initializing outputSignal as empty
    let outputSignal: SignalState = 'FLOATING';

    // if a gate has been placed, update outputSignal based on input gate
    if(inputGate != 'NULL') {
        outputSignal = evaluateGate(inputGate, inputs);
    }

    // returning updated simulation
    return { ...sim, wireStates: { ...sim.wireStates, [inputSlot.outputWireId]: outputSignal } };
}

// to remove gate, uses placeGate to replace circuitslot with an empty 'NULL' gate
export function removeGate(inputSlot: CircuitSlot, sim: SimulationResult): SimulationResult {
    return placeGate('NULL', inputSlot, sim);
}