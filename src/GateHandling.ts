import {GateType, CircuitSlot, SimulationResult, Difficulty, LevelDefinition} from "./types/circuit.ts";

export class ActionReducer {

    // takes in what gate to place and where to place it, updates the state of the circuit and returns the new state
    placeGate(inputGate: GateType, inputSlot: CircuitSlot, mode: Difficulty, sim: SimulationResult): SimulationResult {

        // look at input wires and their states

        // use input states to determine output state of the gate

        // update the state of the output wire in the simulation result


        // ===================================
        // NEED TO CHECK IF ANY OTHER SLOTS ARE AFFECTED BY THIS CHANGE, AND UPDATE THEIR OUTPUTS AS WELL
        // ===================================


        if(mode == 'EASY') {
            // check if circuit is complete after placing gate
        }

    }

}