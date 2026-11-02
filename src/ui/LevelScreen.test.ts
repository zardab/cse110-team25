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

const card = (gate: string) => document.querySelector<HTMLElement>(`.gate-card[data-gate="${gate}"]`)!;
const remaining = (gate: string) => card(gate).getAttribute('data-remaining');

describe('LevelScreen Logic', () => {
  beforeEach(() => {
    render.mockClear();
    // Set up required mock DOM nodes for LevelScreen constructor
    document.body.innerHTML = `
      <div id="konva-container"></div>
      <div id="progress-dots"></div>
      <div id="palette-grid"></div>
      <button id="reset-btn"></button>
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

  it('offers the level\'s gates with how many of each are left', () => {
    expect([...document.querySelectorAll('.gate-card')].map((c) => c.getAttribute('data-gate')))
      .toEqual(['OR', 'AND']);
    expect(remaining('OR')).toBe('1');
    expect(remaining('AND')).toBe('1');
    expect(card('OR').textContent).toContain('×1');
  });

  it('places a gate when its tray card is clicked and counts it as used', () => {
    card('OR').click();

    expect(lastRender()).toMatchObject({ gate: 'OR', wireStates: { out_Y: 1 } });
    expect(remaining('OR')).toBe('0');
    expect(remaining('AND')).toBe('1');
  });

  it('hands the dragged card\'s gate to the drop handler', () => {
    const setData = vi.fn();
    const event = new Event('dragstart');
    Object.defineProperty(event, 'dataTransfer', { value: { setData } });

    card('AND').dispatchEvent(event);

    expect(setData).toHaveBeenCalledWith('gateType', 'AND');
  });

  it('greys out a gate that has run out and does not place it again', () => {
    options.onPlaceGate('slot_1', 'OR');
    expect(card('OR').style.opacity).toBe('0.4');
    expect(card('OR').getAttribute('draggable')).toBe('false');
    expect(card('AND').getAttribute('draggable')).toBe('true');

    render.mockClear();
    card('OR').click();
    expect(render).not.toHaveBeenCalled();
  });

  it('returns the replaced gate to the tray', () => {
    card('OR').click();
    card('AND').click();

    expect(lastRender().gate).toBe('AND');
    expect(remaining('OR')).toBe('1');
    expect(remaining('AND')).toBe('0');
  });

  it('removing a gate returns it to the tray', () => {
    options.onPlaceGate('slot_1', 'OR');
    options.onRemoveGate('slot_1');

    expect(lastRender()).toMatchObject({ gate: 'NULL', wireStates: { out_Y: 'FLOATING' } });
    expect(remaining('OR')).toBe('1');
  });

  it('reset empties the board and restores the tray', () => {
    options.onPlaceGate('slot_1', 'OR');
    document.getElementById('reset-btn')!.click();

    expect(lastRender()).toMatchObject({ gate: 'NULL', wireStates: { out_Y: 'FLOATING' } });
    expect(remaining('OR')).toBe('1');
  });

  it('reset on an empty board does nothing', () => {
    render.mockClear();
    document.getElementById('reset-btn')!.click();
    expect(render).not.toHaveBeenCalled();
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
});
