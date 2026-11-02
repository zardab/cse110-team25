import { describe, expect, it, vi } from 'vitest';
import type { GateType, LevelConfig, SimulationResult } from '../types/circuit';
import { createStore } from './store';
import type { GameAction } from './store';

const slot = (
  id: string,
  inputs: string[],
  outputWireId: string,
  allowedGates?: GateType[],
) => ({
  id,
  ...(allowedGates ? { allowedGates } : {}),
  assignedGate: 'NULL' as const,
  inputs: inputs.map((sourceId) => ({ sourceType: 'PRIMARY_INPUT' as const, sourceId })),
  outputWireId,
});

// s_not only takes NOT, s_and takes AND or OR, and s_free and s_unary have no restriction at all
// (two pins and one pin respectively), so only the arity check can reject a wrong gate there.
const level: LevelConfig = {
  id: 'store_fixture',
  title: 'Store fixture',
  difficulty: 'EASY',
  availableGatePalette: { AND: 1, OR: 1, NOT: 2, XOR: 1, NAND: 0, NOR: 0, XNOR: 0 },
  primaryInputs: ['a', 'b'],
  primaryOutputs: ['y'],
  inputValues: { a: 1, b: 1 },
  targetOutputs: { y: 1 },
  slots: {
    s_not: slot('s_not', ['a'], 'w_not', ['NOT']),
    s_and: slot('s_and', ['a', 'b'], 'y', ['AND', 'OR']),
    s_free: slot('s_free', ['a', 'b'], 'w_free'),
    s_unary: slot('s_unary', ['a'], 'w_unary'),
  },
  hints: [],
  executionOrder: ['s_not', 's_and', 's_free', 's_unary'],
};
const hardLevel: LevelConfig = { ...level, difficulty: 'HARD' };

const mockResult: SimulationResult = { isComplete: true, isSolved: false, wireStates: { y: 0 } };
const mockEvaluate = () => vi.fn<(level: LevelConfig) => SimulationResult>(() => mockResult);

const place = (slotId: string, gate: GateType): GameAction => ({ type: 'PLACE_GATE', slotId, gate });
const remove = (slotId: string): GameAction => ({ type: 'REMOVE_GATE', slotId });
const gateIn = (store: ReturnType<typeof createStore>, slotId: string) =>
  store.getState().level.slots[slotId].assignedGate;

describe('createStore', () => {
  describe('initial state', () => {
    it('starts with the level palette as inventory', () => {
      const state = createStore(level, mockEvaluate()).getState();

      expect(state.inventory).toEqual(level.availableGatePalette);
    });

    it('evaluates once up front in Easy mode so wires can render', () => {
      const evaluate = mockEvaluate();
      const store = createStore(level, evaluate);

      expect(evaluate).toHaveBeenCalledTimes(1);
      expect(store.getState().result).toBe(mockResult);
    });

    it('does not evaluate up front in Hard mode', () => {
      const evaluate = mockEvaluate();
      const store = createStore(hardLevel, evaluate);

      expect(evaluate).not.toHaveBeenCalled();
      expect(store.getState().result).toBeNull();
    });

    it('subtracts gates that are already on the board from the inventory', () => {
      const preplaced = {
        ...level,
        slots: { ...level.slots, s_not: { ...level.slots.s_not, assignedGate: 'NOT' as const } },
      };

      expect(createStore(preplaced, mockEvaluate()).getState().inventory.NOT).toBe(1);
    });

    it('rejects a level that places more gates than its palette holds', () => {
      const overfull = {
        ...level,
        slots: {
          ...level.slots,
          s_and: { ...level.slots.s_and, assignedGate: 'AND' as const },
          s_free: { ...level.slots.s_free, assignedGate: 'AND' as const },
        },
      };

      expect(() => createStore(overfull, mockEvaluate())).toThrow('AND');
    });
  });

  describe('PLACE_GATE', () => {
    it('assigns the gate, decrements inventory and leaves the original level untouched', () => {
      const store = createStore(level, mockEvaluate());

      expect(store.dispatch(place('s_and', 'AND'))).toBe(true);

      expect(gateIn(store, 's_and')).toBe('AND');
      expect(store.getState().inventory).toMatchObject({ AND: 0, OR: 1 });
      expect(level.slots.s_and.assignedGate).toBe('NULL');
      expect(level.availableGatePalette.AND).toBe(1);
    });

    it('never changes a slot\'s wiring', () => {
      const store = createStore(level, mockEvaluate());
      store.dispatch(place('s_and', 'AND'));

      const placed = store.getState().level.slots.s_and;
      expect(placed.inputs).toEqual(level.slots.s_and.inputs);
      expect(placed.outputWireId).toBe('y');
      expect(store.getState().level.executionOrder).toBe(level.executionOrder);
    });

    it('returns the old gate to the inventory when replacing it', () => {
      const store = createStore(level, mockEvaluate());
      store.dispatch(place('s_and', 'OR'));
      store.dispatch(place('s_and', 'AND'));

      expect(gateIn(store, 's_and')).toBe('AND');
      expect(store.getState().inventory).toMatchObject({ OR: 1, AND: 0 });
    });

    it.each<[string, GameAction]>([
      ['an unknown slot', place('missing', 'AND')],
      ['an inherited property as a slot ID', place('__proto__', 'AND')],
      ['an unknown gate', place('s_free', 'MAGIC' as GateType)],
      ['an inherited property as a gate', place('s_free', 'toString' as GateType)],
      // Two pins and XOR in stock, so only the allow-list can reject this.
      ['a gate the slot does not allow', place('s_and', 'XOR')],
      ['a unary gate on a two-pin slot with no restriction', place('s_free', 'NOT')],
      ['a binary gate on a one-pin slot with no restriction', place('s_unary', 'XOR')],
      ['a gate with none left in the inventory', place('s_free', 'NAND')],
    ])('rejects %s without changing anything', (_name, action) => {
      const evaluate = mockEvaluate();
      const store = createStore(level, evaluate);
      const listener = vi.fn();
      store.subscribe(listener);
      const before = store.getState();
      evaluate.mockClear();

      expect(store.dispatch(action)).toBe(false);

      expect(store.getState()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    });

    it('rejects a gate once its inventory runs out', () => {
      const store = createStore(level, mockEvaluate());
      store.dispatch(place('s_and', 'AND'));
      const before = store.getState();

      expect(store.dispatch(place('s_free', 'AND'))).toBe(false);
      expect(store.getState()).toBe(before);
    });

    it('rejects placing the gate that is already in the slot', () => {
      // NOT has a second unit in stock, so only the same-gate check can reject this.
      const evaluate = mockEvaluate();
      const store = createStore(level, evaluate);
      store.dispatch(place('s_not', 'NOT'));
      const listener = vi.fn();
      store.subscribe(listener);
      const before = store.getState();
      evaluate.mockClear();

      expect(store.dispatch(place('s_not', 'NOT'))).toBe(false);

      expect(store.getState()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
      expect(evaluate).not.toHaveBeenCalled();
    });
  });

  describe('REMOVE_GATE', () => {
    it('empties the slot and returns exactly one gate', () => {
      const store = createStore(level, mockEvaluate());
      store.dispatch(place('s_and', 'AND'));

      expect(store.dispatch(remove('s_and'))).toBe(true);

      expect(gateIn(store, 's_and')).toBe('NULL');
      expect(store.getState().inventory).toEqual(level.availableGatePalette);
    });

    it('rejects an empty or unknown slot', () => {
      const store = createStore(level, mockEvaluate());
      const before = store.getState();

      expect(store.dispatch(remove('s_and'))).toBe(false);
      expect(store.dispatch(remove('missing'))).toBe(false);
      expect(store.getState()).toBe(before);
    });
  });

  describe('evaluation modes', () => {
    it('Easy mode evaluates after every successful board change', () => {
      const evaluate = mockEvaluate();
      const store = createStore(level, evaluate);
      evaluate.mockClear();

      const steps: GameAction[] = [place('s_and', 'AND'), remove('s_and'), place('s_and', 'OR')];
      steps.forEach((action, index) => {
        store.dispatch(action);
        expect(evaluate).toHaveBeenCalledTimes(index + 1);
      });
      expect(evaluate).toHaveBeenLastCalledWith(store.getState().level);
      expect(store.getState().result).toBe(mockResult);
    });

    it('Hard mode never evaluates on board changes and has no result to show', () => {
      const evaluate = mockEvaluate();
      const store = createStore(hardLevel, evaluate);

      store.dispatch(place('s_and', 'AND'));
      store.dispatch(remove('s_and'));
      store.dispatch(place('s_and', 'OR'));

      expect(evaluate).not.toHaveBeenCalled();
      expect(store.getState().result).toBeNull();
    });
  });

  describe('when the evaluator throws', () => {
    it('leaves the store unchanged and still usable', () => {
      const evaluate = mockEvaluate();
      const store = createStore(level, evaluate);
      const listener = vi.fn();
      store.subscribe(listener);
      const before = store.getState();
      evaluate.mockImplementationOnce(() => {
        throw new Error('bad level');
      });

      expect(() => store.dispatch(place('s_and', 'AND'))).toThrow('bad level');

      expect(store.getState()).toBe(before);
      expect(listener).not.toHaveBeenCalled();

      // The failed placement left no trace: the same gate is still available and places cleanly.
      expect(store.dispatch(place('s_and', 'AND'))).toBe(true);
      expect(gateIn(store, 's_and')).toBe('AND');
      expect(store.getState().inventory.AND).toBe(0);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('notifies with the new state after each accepted action', () => {
      const store = createStore(level, mockEvaluate());
      const listener = vi.fn();
      store.subscribe(listener);

      store.dispatch(place('s_and', 'AND'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(store.getState());
    });

    it('stops notifying after unsubscribe, and unsubscribing twice is harmless', () => {
      const store = createStore(level, mockEvaluate());
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      unsubscribe();
      store.dispatch(place('s_and', 'AND'));

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not call a listener added during a notification until the next one', () => {
      const store = createStore(level, mockEvaluate());
      const late = vi.fn();
      store.subscribe(() => {
        store.subscribe(late);
      });

      store.dispatch(place('s_and', 'AND'));
      expect(late).not.toHaveBeenCalled();

      store.dispatch(remove('s_and'));
      expect(late).toHaveBeenCalledTimes(1);
    });

    it('still notifies every listener and accepts the action when one throws', () => {
      const store = createStore(level, mockEvaluate());
      const error = new Error('listener bug');
      const report = vi.spyOn(console, 'error').mockImplementation(() => {});
      const first = vi.fn();
      const last = vi.fn();
      store.subscribe(first);
      store.subscribe(() => {
        throw error;
      });
      store.subscribe(last);

      expect(store.dispatch(place('s_and', 'AND'))).toBe(true);

      expect(gateIn(store, 's_and')).toBe('AND');
      expect(first).toHaveBeenCalledWith(store.getState());
      expect(last).toHaveBeenCalledWith(store.getState());
      expect(report).toHaveBeenCalledWith(expect.any(String), error);
      report.mockRestore();
    });

    it('lets a listener unsubscribe itself while being notified', () => {
      const store = createStore(level, mockEvaluate());
      const other = vi.fn();
      const unsubscribe = store.subscribe(() => unsubscribe());
      store.subscribe(other);

      store.dispatch(place('s_and', 'AND'));

      expect(other).toHaveBeenCalledTimes(1);
    });
  });

  describe('with the real evaluator', () => {
    it('solves the level once every slot holds the right gate', () => {
      const store = createStore(level);
      expect(store.getState().result).toMatchObject({ isComplete: false, isSolved: false });

      store.dispatch(place('s_not', 'NOT'));
      store.dispatch(place('s_free', 'XOR'));
      store.dispatch(place('s_unary', 'NOT'));
      expect(store.getState().result?.isSolved).toBe(false);

      store.dispatch(place('s_and', 'OR'));
      expect(store.getState().result).toMatchObject({ isComplete: true, isSolved: true });

      store.dispatch(place('s_and', 'AND'));
      expect(store.getState().result?.wireStates.y).toBe(1);

      store.dispatch(remove('s_free'));
      expect(store.getState().result).toMatchObject({ isComplete: false, isSolved: false });
      expect(store.getState().result?.wireStates.w_free).toBe('FLOATING');
    });
  });
});
