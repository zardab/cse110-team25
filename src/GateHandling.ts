import {GateType, CircuitSlot, SimulationResult, Difficulty, SignalState, LevelDefinition, SignalSource} from "./types/circuit.ts";

export class GateHandling {

    // takes in what gate to place and where to place it, updates the state of the circuit and returns the new state
    placeGate(inputGateType: GateType | null, inputSlot: CircuitSlot, mode: Difficulty, sim: SimulationResult): SimulationResult {

        // getting slot's input wires
        let source1: SignalSource = inputSlot.inputs[0];
        let source2: SignalSource = inputSlot.inputs[1];

        // getting current state of input wires
        let input1: SignalState = sim.wireStates[source1.sourceId]
        let input2: SignalState = sim.wireStates[source2.sourceId]

        // use input states to determine output state of the gate
        // need gate logic to proceed

        // update the state of the output wire in the simulation result
        // 1 is just a placeholder for state
        sim.wireStates[inputSlot.outputWireId] = 1;

        // ===================================
        // NEED TO CHECK IF ANY OTHER SLOTS ARE AFFECTED BY THIS CHANGE, AND UPDATE THEIR OUTPUTS AS WELL
        // ===================================


        // actually put this somewhere else
        /*if(mode == 'EASY') {
            // check if circuit is complete after updates
        }*/

        return sim;

    }

    removeGate(inputSlot: CircuitSlot, mode: Difficulty, sim: SimulationResult): SimulationResult {
        return this.placeGate(null, inputSlot, mode, sim);
    }

}