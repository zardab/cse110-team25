// src/ui/LevelScreen.test.ts
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { LevelScreen } from './LevelScreen';
import { mainLevels } from '../content/levelCatalog';
import { loadLevel } from '../content/levelLoader';
import { StorageAdapter } from '../persistence/storageAdapter';
import indexHtml from '../../index.html?raw';

// jsdom has no canvas, so replace the Konva board with a recorder.
const render = vi.fn();
let options: { onPlaceGate: (slotId: string, gate: string) => void; onRemoveGate: (slotId: string) => void };
vi.mock('./components/GameBoardView', () => ({
  GameBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
    destroy() {}
  },
}));
vi.mock('./components/boards/Level01FoundationsBoardView', () => ({
  Level01FoundationsBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
    destroy() {}
  },
}));
vi.mock('./components/boards/Level02XorBoardView', () => ({
  Level02XorBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
    destroy() {}
  },
}));
vi.mock('./components/boards/Level03NandBoardView', () => ({
  Level03NandBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
    destroy() {}
  },
}));
vi.mock('./components/boards/Level04NorBoardView', () => ({
  Level04NorBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
    destroy() {}
  },
}));
vi.mock('./components/boards/Level05XnorBoardView', () => ({
  Level05XnorBoardView: class {
    constructor(opts: typeof options) {
      options = opts;
    }
    render = render;
    destroy() {}
  },
}));

function lastRender() {
  const [level, wireStates] = render.mock.calls.at(-1)!;
  return { gate: level.slots.slot_1.assignedGate, wireStates };
}

describe('Main game level integration', () => {
  const [foundations, xor, nand] = mainLevels;
  let screen: LevelScreen;
  let storage: StorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageAdapter();
    document.body.innerHTML = `
      <div id="konva-container"></div>
      <div id="palette-grid"></div>
      <h1 id="level-title"></h1>
      <button id="reset-btn"></button>
      <button id="undo-btn"></button>
      <button id="menu-btn"></button>
      <div id="gate-info-overlay" hidden>
        <div id="gate-info-modal">
          <h2 class="gate-info-title"></h2>
          <p class="gate-info-subtitle"></p>
          <p class="gate-info-description"></p>
          <p class="gate-info-fun-fact"></p>
          <img class="gate-info-graphic" />
          <div class="gate-info-input-labels"></div>
          <div class="gate-info-truth"></div>
          <button id="gate-info-dismiss"></button>
        </div>
      </div>
      <div id="game-sidebar" hidden>
        <button id="sidebar-close-btn"></button>
        <button id="sidebar-restart-btn"></button>
      </div>
    `;
  });

  afterEach(() => screen.destroy());

  it('closes the sidebar on leaving a level and binds each control once on reopening', () => {
    const menu = document.getElementById('menu-btn')!;
    const sidebar = document.getElementById('game-sidebar')!;
    screen = new LevelScreen({ level: foundations, storage });
    menu.click();
    expect(sidebar.hidden).toBe(false);
    screen.destroy();
    expect(sidebar.hidden).toBe(true);

    screen = new LevelScreen({ level: xor, storage });
    menu.click();
    expect(sidebar.hidden).toBe(false);
    document.getElementById('sidebar-close-btn')!.click();
    expect(sidebar.hidden).toBe(true);
  });

  it('restores a board by level ID after leaving the level and reopening it', () => {
    screen = new LevelScreen({ level: foundations, storage });
    options.onPlaceGate('slot_and', 'AND');
    screen.destroy();

    screen = new LevelScreen({ level: xor, storage });
    expect(document.getElementById('level-title')!.textContent).toBe('Level 2 / 5');
    expect(render.mock.lastCall![0].slots.slot_xor.assignedGate).toBe('NULL');
    screen.destroy();

    screen = new LevelScreen({ level: foundations, storage: new StorageAdapter() });
    expect(render.mock.lastCall![0].slots.slot_and.assignedGate).toBe('AND');
    expect(document.querySelector('[data-gate="AND"] .gate-count')?.textContent).toBe('×0');
  });

  it('replays a completed level from its starting board while preserving completion', () => {
    const otherLevel = { completed: true, stars: 2, placements: { slot_xor: 'XOR' } } as const;
    expect(storage.saveLevel(xor, otherLevel)).toBe(true);
    screen = new LevelScreen({ level: foundations, storage });
    options.onPlaceGate('slot_and', 'AND');
    options.onPlaceGate('slot_or', 'OR');
    expect(storage.getProgress()[foundations.id].completed).toBe(true);
    screen.destroy();

    screen = new LevelScreen({ level: foundations, storage: new StorageAdapter() });
    expect(render.mock.lastCall![0].slots).toMatchObject({
      slot_and: { assignedGate: 'AND' },
      slot_or: { assignedGate: 'OR' },
    });

    document.getElementById('reset-btn')!.click();
    expect(render.mock.lastCall![0].id).toBe(foundations.id);
    expect(storage.loadLevel(foundations)).toMatchObject({
      completed: true,
      placements: { slot_not: 'NOT', slot_and: 'NULL', slot_or: 'NULL' },
    });

    options.onPlaceGate('slot_and', 'AND');
    options.onPlaceGate('slot_or', 'OR');
    expect(render.mock.lastCall![1].out_Y).toBe(1);
    expect(storage.loadLevel(foundations)).toMatchObject({
      completed: true,
      placements: { slot_and: 'AND', slot_or: 'OR' },
    });
    expect(storage.loadLevel(xor)).toEqual(otherLevel);
  });

  it('sidebar Restart resets the board and closes the sidebar', () => {
    screen = new LevelScreen({ level: foundations, storage });
    options.onPlaceGate('slot_and', 'AND');
    document.getElementById('menu-btn')!.click();
    document.getElementById('sidebar-restart-btn')!.click();

    expect(render.mock.lastCall![0].slots.slot_and.assignedGate).toBe('NULL');
    expect(storage.loadLevel(foundations)?.placements.slot_and).toBe('NULL');
    expect(document.getElementById('game-sidebar')!.hidden).toBe(true);
  });

  it('persists the board after undo and restores its gate inventory', () => {
    screen = new LevelScreen({ level: foundations, storage });
    options.onPlaceGate('slot_and', 'AND');
    options.onPlaceGate('slot_or', 'OR');
    document.getElementById('undo-btn')!.click();
    screen.destroy();

    screen = new LevelScreen({ level: foundations, storage });
    expect(render.mock.lastCall![0].slots).toMatchObject({
      slot_and: { assignedGate: 'AND' },
      slot_or: { assignedGate: 'NULL' },
    });
    expect(document.querySelector('[data-gate="OR"] .gate-count')?.textContent).toBe('×1');
    expect(storage.loadLevel(foundations).completed).toBe(true);
  });

  it('opens the authored board when a partial save would exceed the current inventory', () => {
    const level = loadLevel({
      ...foundations,
      slots: {
        ...foundations.slots,
        slot_not: { ...foundations.slots.slot_not, assignedGate: 'NULL' },
        slot_and: { ...foundations.slots.slot_and, assignedGate: 'AND' },
        slot_or: { ...foundations.slots.slot_or, allowedGates: ['AND', 'OR'] },
      },
    });
    const saved = { completed: true, stars: 2, placements: { slot_or: 'AND' } } as const;
    expect(storage.saveLevel(level, saved)).toBe(true);

    screen = new LevelScreen({ level, storage });
    expect(render.mock.lastCall![0].slots).toEqual(level.slots);
    options.onPlaceGate('slot_or', 'OR');
    expect(storage.loadLevel(level)).toMatchObject({
      completed: true,
      stars: 2,
      placements: { slot_and: 'AND', slot_or: 'OR' },
    });
  });

  it('still evaluates accepted moves when browser storage rejects writes', () => {
    storage = new StorageAdapter({
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); },
      removeItem: () => {},
    });
    screen = new LevelScreen({ level: foundations, storage });

    options.onPlaceGate('slot_and', 'AND');
    options.onPlaceGate('slot_or', 'OR');
    expect(render.mock.lastCall![1].out_Y).toBe(1);
  });

  it('restores placements with live wire feedback on formerly HARD levels', () => {
    screen = new LevelScreen({ level: nand, storage });
    options.onPlaceGate('slot_nand', 'NAND');
    expect(storage.getProgress()[nand.id].completed).toBe(false);
    expect(render.mock.lastCall![1].out_Z).toBe(0);
    screen.destroy();

    screen = new LevelScreen({ level: nand, storage: new StorageAdapter() });
    const [level, wireStates] = render.mock.lastCall!;
    expect(level.slots.slot_nand.assignedGate).toBe('NAND');
    expect(wireStates.out_Z).toBe(0);
  });
});

describe('LevelScreen Logic', () => {
  beforeEach(() => {
    render.mockClear();
    // Set up required mock DOM nodes for LevelScreen constructor
    document.body.innerHTML = `
      <div id="konva-container"></div>
      <div id="progress-dots"></div>
      <div id="palette-grid"></div>
      <button id="reset-btn"></button>
      <button id="menu-btn"></button>
      <div id="timer-display">15s</div>

      <div id="game-over-overlay" hidden>
        <h1 id="game-over-title"></h1>
        <p id="game-over-message"></p>
        <button id="restart-minigame-btn"></button>
      </div>

      <div id="gate-info-overlay" hidden>
        <div id="gate-info-modal">
          <h2 class="gate-info-title"></h2>
          <p class="gate-info-subtitle"></p>
          <p class="gate-info-description"></p>
          <p class="gate-info-fun-fact"></p>
          <img class="gate-info-graphic" />
          <div class="gate-info-input-labels"></div>
          <div class="gate-info-truth"></div>
          <button id="gate-info-dismiss"></button>
        </div>
      </div>
      <div id="game-sidebar" hidden>
        <div id="sidebar-backdrop"></div>
        <button id="sidebar-close-btn"></button>
      </div>
      
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
      <button id="menu-btn"></button>
      <div id="timer-display">15s</div>

      <div id="game-over-overlay" hidden>
        <h1 id="game-over-title"></h1>
        <p id="game-over-message"></p>
        <button id="restart-minigame-btn"></button>
      </div>

      <div id="gate-info-overlay" hidden>
        <div id="gate-info-modal">
          <h2 class="gate-info-title"></h2>
          <p class="gate-info-subtitle"></p>
          <p class="gate-info-description"></p>
          <p class="gate-info-fun-fact"></p>
          <img class="gate-info-graphic" />
          <div class="gate-info-input-labels"></div>
          <div class="gate-info-truth"></div>
          <button id="gate-info-dismiss"></button>
        </div>
      </div>
      <div id="game-sidebar" hidden>
        <div id="sidebar-backdrop"></div>
        <button id="sidebar-close-btn"></button>
      </div>
      
      <button id="undo-btn"></button>
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

describe('Main Menu button markup', () => {
  it('is in the game sidebar of index.html in place of Mini-Games', () => {
    const page = new DOMParser().parseFromString(indexHtml, 'text/html');
    const button = page.querySelector('#game-sidebar #main-menu-btn');
    expect(button?.textContent?.trim()).toBe('Main Menu');
    expect(page.querySelector('#game-sidebar')?.textContent).not.toContain('Mini-Games');
  });
});

describe('Main Menu button', () => {
  const [foundations, xor] = mainLevels;
  let screen: LevelScreen;
  let storage: StorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageAdapter();
    document.body.innerHTML = `
      <div id="konva-container"></div>
      <div id="palette-grid"></div>
      <button id="reset-btn"></button>
      <button id="undo-btn"></button>
      <button id="menu-btn"></button>
      <div id="gate-info-overlay" hidden>
        <div id="gate-info-modal">
          <h2 class="gate-info-title"></h2>
          <p class="gate-info-subtitle"></p>
          <p class="gate-info-description"></p>
          <p class="gate-info-fun-fact"></p>
          <img class="gate-info-graphic" />
          <div class="gate-info-input-labels"></div>
          <div class="gate-info-truth"></div>
          <button id="gate-info-dismiss"></button>
        </div>
      </div>
      <div id="game-sidebar" hidden>
        <button id="sidebar-close-btn"></button>
        <button id="main-menu-btn"></button>
      </div>
    `;
  });

  afterEach(() => screen.destroy());

  it('calls onMainMenu once per click', () => {
    const onMainMenu = vi.fn();
    screen = new LevelScreen({ level: foundations, storage, onMainMenu });
    document.getElementById('menu-btn')!.click();
    document.getElementById('main-menu-btn')!.click();
    expect(onMainMenu).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no onMainMenu callback is given', () => {
    screen = new LevelScreen({ level: foundations, storage });
    expect(() => document.getElementById('main-menu-btn')!.click()).not.toThrow();
  });

  it('stops calling the old callback once the level is destroyed', () => {
    const first = vi.fn();
    const second = vi.fn();
    screen = new LevelScreen({ level: foundations, storage, onMainMenu: first });
    screen.destroy();

    screen = new LevelScreen({ level: xor, storage, onMainMenu: second });
    document.getElementById('main-menu-btn')!.click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps board progress when the player leaves for the main menu', () => {
    screen = new LevelScreen({
      level: foundations,
      storage,
      onMainMenu: () => screen.destroy(),
    });
    options.onPlaceGate('slot_and', 'AND');
    document.getElementById('main-menu-btn')!.click();

    screen = new LevelScreen({ level: foundations, storage: new StorageAdapter() });
    expect(render.mock.lastCall![0].slots.slot_and.assignedGate).toBe('AND');
  });
});
