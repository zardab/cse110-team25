// src/ui/LevelScreen.test.ts
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { LevelScreen } from './LevelScreen';

// jsdom has no canvas, so replace the Konva board with a recorder.
const render = vi.fn();
let options: { onPlaceGate: (slotId: string, gate: string) => void; onRemoveGate: (slotId: string) => void };
vi.mock('./components/GameBoardView', () => ({
  GameBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
  },
}));

function lastRender() {
  const [level, wireStates] = render.mock.calls.at(-1)!;
  return { gate: level.slots.slot_1.assignedGate, wireStates };
}

describe('LevelScreen Logic', () => {
  beforeEach(() => {
    render.mockClear();
    // Set up required mock DOM nodes for LevelScreen constructor
    document.body.innerHTML = `
      <div id="konva-container"></div>
      <div id="progress-dots"></div>
      <div id="palette-grid"></div>
      <button id="reset-btn"></button>
      <button id="undo-btn"></button>
    `;
    new LevelScreen();
  });

  it('starts with an empty slot and a floating output', () => {
    expect(lastRender()).toMatchObject({ gate: 'NULL', wireStates: { out_Y: 'FLOATING' } });
  });

  it('evaluates with the real evaluator when a gate is placed', () => {
    options.onPlaceGate('slot_1', 'OR');
    expect(lastRender()).toMatchObject({ gate: 'OR', wireStates: { out_Y: 1 } });
    options.onPlaceGate('slot_1', 'AND');
    expect(lastRender()).toMatchObject({ gate: 'AND', wireStates: { out_Y: 0 } });
  });

  it('removing a gate and resetting both empty the slot', () => {
    options.onPlaceGate('slot_1', 'OR');
    options.onRemoveGate('slot_1');
    expect(lastRender().gate).toBe('NULL');

    options.onPlaceGate('slot_1', 'OR');
    document.getElementById('reset-btn')!.click();
    expect(lastRender()).toMatchObject({ gate: 'NULL', wireStates: { out_Y: 'FLOATING' } });
  });

  it('ignores gates the slot does not allow and unknown slots', () => {
    options.onPlaceGate('slot_1', 'OR');
    render.mockClear();

    options.onPlaceGate('slot_1', 'NOT');
    options.onPlaceGate('slot_1', 'not-a-gate');
    options.onPlaceGate('missing', 'OR');
    options.onPlaceGate('__proto__', 'OR');
    options.onRemoveGate('missing');

    expect(render).not.toHaveBeenCalled();
    options.onPlaceGate('slot_1', 'AND');
    expect(lastRender().gate).toBe('AND');
  });

  it('offers only gates that fit the two-pin slot', () => {
    const cards = [...document.querySelectorAll('.gate-card')].map((c) => c.getAttribute('data-gate'));
    expect(cards).toEqual(['OR', 'AND']);
  });

  it('undoes the latest move and is only enabled when there is one', () => {
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);

    options.onPlaceGate('slot_1', 'OR');
    options.onPlaceGate('slot_1', 'AND');
    expect(undoBtn.disabled).toBe(false);

    undoBtn.click();
    expect(lastRender()).toMatchObject({ gate: 'OR', wireStates: { out_Y: 1 } });
    const counts = [...document.querySelectorAll('.gate-count')].map((count) => count.textContent);
    expect(counts).toEqual(['×0', '×1']);

    undoBtn.click();
    expect(lastRender()).toMatchObject({ gate: 'NULL', wireStates: { out_Y: 'FLOATING' } });
    expect(undoBtn.disabled).toBe(true);
  });

  it('starts a reset level with nothing to undo', () => {
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement;
    options.onPlaceGate('slot_1', 'OR');

    document.getElementById('reset-btn')!.click();
    expect(undoBtn.disabled).toBe(true);
  });
});
