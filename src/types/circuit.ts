export type GateType = 'AND' | 'OR' | 'NOT' | 'XOR' | 'NAND' | 'NOR' | 'XNOR';

export type AssignedGate = GateType | 'NULL';

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
  readonly targetOutputs: Readonly<Record<string, 0 | 1>>;
  readonly slots: Record<string, CircuitSlot>;
  readonly hints: ReadonlyArray<{
    readonly triggerSlotId?: string;
    readonly message: string;
  }>;
}

export interface LevelConfig extends Omit<LevelDefinition, 'availableGatePalette'> {
  readonly availableGatePalette: Record<GateType, number>;
  readonly executionOrder: ReadonlyArray<string>;
}

export interface SimulationResult {
  readonly isComplete: boolean;
  readonly isSolved: boolean;
  readonly wireStates: Record<string, SignalState>;
}
