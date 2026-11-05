// src/ui/LevelScreen.test.ts
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
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
      <div id="timer-display">15s</div>

      <div id="game-over-overlay" hidden>
        <h1 id="game-over-title"></h1>
        <p id="game-over-message"></p>
        <button id="restart-minigame-btn"></button>
      </div>
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
});

// AI Assistance Disclosure:
// The timed-minigame tests below were generated with assistance from ChatGPT (OpenAI).
// I reviewed the tests against my implementation and am responsible for understanding,
// verifying, and maintaining them.

describe('Timed minigame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render.mockClear();

    document.body.innerHTML = `
      <div id="konva-container"></div>
      <div id="progress-dots"></div>
      <div id="palette-grid"></div>
      <button id="reset-btn"></button>
      <div id="timer-display">15s</div>

      <div id="game-over-overlay" hidden>
        <h1 id="game-over-title"></h1>
        <p id="game-over-message"></p>
        <button id="restart-minigame-btn"></button>
      </div>
    `;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps the timer hidden in normal game mode', () => {
    new LevelScreen();

    const timer = document.getElementById('timer-display')!;

    expect(timer.hidden).toBe(true);
  });

  it('shows and counts down the timer in timed mode', () => {
    new LevelScreen({ timed: true });

    const timer = document.getElementById('timer-display')!;

    expect(timer.hidden).toBe(false);
    expect(timer.textContent).toBe('15s');

    vi.advanceTimersByTime(3000);

    expect(timer.textContent).toBe('12s');
  });

  it("shows Time's Up when the timer reaches zero", () => {
    new LevelScreen({ timed: true });

    vi.advanceTimersByTime(15000);

    expect(document.getElementById('game-over-overlay')!.hidden).toBe(false);
    expect(document.getElementById('game-over-title')!.textContent).toBe("Time's Up!");
  });

  it('stops the timer when the level is solved', () => {
    new LevelScreen({ timed: true });

    vi.advanceTimersByTime(2000);
    options.onPlaceGate('slot_1', 'OR');

    expect(document.getElementById('timer-display')!.textContent).toBe('13s');
    expect(document.getElementById('game-over-title')!.textContent).toBe('Level Complete!');

    vi.advanceTimersByTime(5000);

    expect(document.getElementById('timer-display')!.textContent).toBe('13s');
  });

  it('Play Again resets the timer', () => {
    new LevelScreen({ timed: true });

    vi.advanceTimersByTime(5000);
    options.onPlaceGate('slot_1', 'OR');

    document.getElementById('restart-minigame-btn')!.click();

    expect(document.getElementById('timer-display')!.textContent).toBe('15s');
    expect(document.getElementById('game-over-overlay')!.hidden).toBe(true);
    expect(lastRender().gate).toBe('NULL');
  });
});