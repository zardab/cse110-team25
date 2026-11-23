
export type GateType = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR' | 'XNOR';

export type AssignedGate = GateType | 'NULL';

// Used by the Level 1 UI for its current gate selections
export type AssignedGates = Record<string, GateType | null>;

export type Difficulty = 'EASY' | 'HARD';

export type SignalState = 0 | 1 | 'FLOATING';

export type PrimaryInputValues = Readonly<Record<string, 0 | 1>>;

export interface SignalSource {
  readonly sourceType: 'PRIMARY_INPUT' | 'SLOT_OUTPUT';
  readonly sourceId: string;
}

export interface CircuitSlot {
  readonly id: string;
  readonly allowedGates?: ReadonlyArray<GateType>;
  readonly assignedGate: AssignedGate;
  readonly inputs: ReadonlyArray<SignalSource>;
  readonly outputWireId: string;
}

export interface LevelDefinition {
  readonly id: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly availableGatePalette: Partial<Record<GateType, number>>;
  readonly primaryInputs: ReadonlyArray<string>;
  readonly primaryOutputs: ReadonlyArray<string>;
  readonly inputValues: PrimaryInputValues;
  readonly targetOutputs: Readonly<Record<string, 0 | 1>>;
  readonly slots: Record<string, CircuitSlot>;
  readonly hints: ReadonlyArray<{
    readonly triggerSlotId?: string;
    readonly message: string;
  }>;
}

/** A wired circuit whose slots have been ordered so each is evaluated after its sources. */
export interface CompiledCircuit {
  readonly primaryInputs: ReadonlyArray<string>;
  readonly primaryOutputs: ReadonlyArray<string>;
  readonly slots: Record<string, CircuitSlot>;
  readonly executionOrder: ReadonlyArray<string>;
}

export interface LevelConfig extends Omit<LevelDefinition, 'availableGatePalette'>, CompiledCircuit {
  readonly availableGatePalette: Record<GateType, number>;
}

export type StuckAt = 0 | 1;

/** Stuck-at faults keyed by slot ID: the slot's output is forced to the value no matter its inputs. */
export type FaultMap = Readonly<Record<string, StuckAt>>;

export interface SimulationResult {
  readonly isComplete: boolean;
  readonly isSolved: boolean;
  readonly wireStates: Record<string, SignalState>;
}
