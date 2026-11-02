import { evaluateCircuit } from '../simulation/evaluateCircuit';
import type {
  AssignedGate,
  GateType,
  LevelConfig,
  SimulationResult,
} from '../types/circuit';

export type GameAction =
  | { readonly type: 'PLACE_GATE'; readonly slotId: string; readonly gate: GateType }
  | { readonly type: 'REMOVE_GATE'; readonly slotId: string };

export type Inventory = Readonly<Record<GateType, number>>;

export interface GameState {
  /** The level with the current placements stored in each slot's `assignedGate`. */
  readonly level: LevelConfig;
  /** Gates still available to place. */
  readonly inventory: Inventory;
  /** Latest evaluation, or null when none is current (Hard mode, until a check action exists). */
  readonly result: SimulationResult | null;
}

export type Evaluate = (level: LevelConfig) => SimulationResult;
export type Listener = (state: GameState) => void;

export interface GameStore {
  getState(): GameState;
  /** Applies an action. Returns false, leaving everything untouched, if it was rejected. */
  dispatch(action: GameAction): boolean;
  /** Calls the listener after every accepted action. Returns a function that unsubscribes. */
  subscribe(listener: Listener): () => void;
}

function withAssignedGate(level: LevelConfig, slotId: string, gate: AssignedGate): LevelConfig {
  return {
    ...level,
    slots: { ...level.slots, [slotId]: { ...level.slots[slotId], assignedGate: gate } },
  };
}

function placedGates(level: LevelConfig): GateType[] {
  return Object.values(level.slots).flatMap((slot) =>
    slot.assignedGate === 'NULL' ? [] : [slot.assignedGate],
  );
}

function adjust(inventory: Inventory, gate: GateType, delta: number): Inventory {
  return { ...inventory, [gate]: inventory[gate] + delta };
}

export function createStore(
  startingLevel: LevelConfig,
  evaluate: Evaluate = evaluateCircuit,
): GameStore {
  const isEasy = startingLevel.difficulty === 'EASY';

  // Gates already on the board when the level arrives are not available to place again.
  let inventory: Inventory = startingLevel.availableGatePalette;
  for (const gate of placedGates(startingLevel)) {
    inventory = adjust(inventory, gate, -1);
    if (inventory[gate] < 0) throw new Error(`Level places more ${gate} gates than its palette allows`);
  }

  let level = startingLevel;
  let result: SimulationResult | null = isEasy ? evaluate(level) : null;
  const listeners = new Set<Listener>();

  let state = buildState();

  function buildState(): GameState {
    return { level, inventory, result };
  }

  // The action is already committed here, so a failing listener must not turn it into an
  // exception or starve the listeners after it: report the error and keep notifying.
  function publish(): true {
    state = buildState();
    for (const listener of [...listeners]) {
      try {
        listener(state);
      } catch (error) {
        console.error('Game store listener failed:', error);
      }
    }
    return true;
  }

  // Easy mode evaluates after every board change; Hard mode drops the stale result instead.
  // Evaluate first and commit level, inventory and result together, so an evaluator
  // that throws leaves the store exactly as it was.
  function mutate(nextLevel: LevelConfig, nextInventory: Inventory): true {
    const nextResult = isEasy ? evaluate(nextLevel) : null;
    level = nextLevel;
    inventory = nextInventory;
    result = nextResult;
    return publish();
  }

  function placeGate(slotId: string, gate: GateType): boolean {
    if (!Object.hasOwn(level.slots, slotId)) return false;
    // The palette lists every playable gate, so its keys are the valid gate names.
    if (typeof gate !== 'string' || !Object.hasOwn(inventory, gate)) return false;
    const slot = level.slots[slotId];
    if (slot.inputs.length !== (gate === 'NOT' ? 1 : 2)) return false;
    if (slot.allowedGates && !slot.allowedGates.includes(gate)) return false;
    if (slot.assignedGate === gate || inventory[gate] <= 0) return false;

    // Replacing a gate returns the old one to the inventory.
    let next = adjust(inventory, gate, -1);
    if (slot.assignedGate !== 'NULL') next = adjust(next, slot.assignedGate, 1);
    return mutate(withAssignedGate(level, slotId, gate), next);
  }

  function removeGate(slotId: string): boolean {
    if (!Object.hasOwn(level.slots, slotId)) return false;
    const { assignedGate } = level.slots[slotId];
    if (assignedGate === 'NULL') return false;
    return mutate(withAssignedGate(level, slotId, 'NULL'), adjust(inventory, assignedGate, 1));
  }

  return {
    getState: () => state,
    dispatch(action) {
      switch (action.type) {
        case 'PLACE_GATE':
          return placeGate(action.slotId, action.gate);
        case 'REMOVE_GATE':
          return removeGate(action.slotId);
        default:
          return false;
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
