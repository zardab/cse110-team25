import { GateType, CircuitSlot, SimulationResult, Difficulty, SignalState, SignalSource } from "../types/circuit.ts";
import { evaluateGate } from "./gates.ts";

    // takes in what gate to place and where to place it, updates the state of the circuit and returns the new state
export function placeGate(inputGateType: GateType, inputSlot: CircuitSlot, mode: Difficulty, sim: SimulationResult): SimulationResult {

    // getting slot's input wires =================================================
    let source1: SignalSource = inputSlot.inputs[0];

    // setting source2 to an empty wire if only one input wire for NOT gate
    let source2: SignalSource = { sourceType: 'PRIMARY_INPUT', sourceId: "" };
    // if gate is not a NOT gate, set source2 to second wire
    if(inputGateType != 'NOT') {
        source2 = inputSlot.inputs[1];
    }

    // getting current state of input wires ========================================
    let input1: SignalState = sim.wireStates[source1.sourceId]

    let input2: SignalState = 0
    if(inputGateType != 'NOT') {
        input2 = sim.wireStates[source2.sourceId]
    }

    // use input states to determine output state of the gate
    const inputs = [input1, input2]
    let outputSignal: SignalState = evaluateGate(inputGateType, inputs);
        
    // update the state of the output wire in the simulation result
    // 1 is just a placeholder for state
    sim.wireStates[inputSlot.outputWireId] = outputSignal;

        // ===================================
        // NEED TO CHECK IF ANY OTHER SLOTS ARE AFFECTED BY THIS CHANGE, AND UPDATE THEIR OUTPUTS AS WELL
        // ===================================

    // loop through all circuit slots


    // actually put this somewhere else
    /*if(mode == 'EASY') {
        // check if circuit is complete after updates
    }*/

    return sim;

}

export function removeGate(inputSlot: CircuitSlot, mode: Difficulty, sim: SimulationResult): SimulationResult {
    return placeGate('NULL', inputSlot, mode, sim);
}