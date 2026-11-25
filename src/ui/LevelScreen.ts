import { GameBoardView } from './components/GameBoardView';
import { FixedLayoutBoardView, type BoardViewOptions } from './components/boards/FixedLayoutBoardView';
import { Level01FoundationsBoardView } from './components/boards/Level01FoundationsBoardView';
import { Level02XorBoardView } from './components/boards/Level02XorBoardView';
import { Level03NandBoardView } from './components/boards/Level03NandBoardView';
import { Level04NorBoardView } from './components/boards/Level04NorBoardView';
import { Level05XnorBoardView } from './components/boards/Level05XnorBoardView';
import { SideMenu } from './components/SideMenu';
import { GateInfoModal } from './components/GateInfoModal';
import { createStore, type GameState, type GameStore } from '../state/store';
import type { GateType, LevelConfig } from '../types/circuit';
import { LevelValidationError, loadLevel } from '../content/levelLoader';
import type { StorageAdapter } from '../persistence/storageAdapter';
import { levelIntroGates, mainLevels } from '../content/levelCatalog';

type BoardView = GameBoardView | FixedLayoutBoardView;

const LEVEL_BOARD_VIEWS: Record<string, new (options: BoardViewOptions) => FixedLayoutBoardView> = {
  level_01_foundations: Level01FoundationsBoardView,
  level_02_xor: Level02XorBoardView,
  level_03_nand: Level03NandBoardView,
  level_04_nor: Level04NorBoardView,
  level_05_xnor: Level05XnorBoardView,
};

const DEFAULT_MINIGAME_DURATION_SECONDS = 15;

//Added this interface to allow for optional parameters in the LevelScreen constructor (i.e. minigame timer settings)
interface LevelScreenOptions {
  level?: LevelConfig;
  storage?: StorageAdapter;
  timed?: boolean;
  durationSeconds?: number;
  onNextLevel?: (level: LevelConfig) => void;
  onPreviousLevel?: (level: LevelConfig) => void;
  onMainMenu?: () => void;
}

const LEVEL_1_CONFIG: LevelConfig = {
  id: 'level_01_intro',
  title: 'Level 1: The OR Gate',
  difficulty: 'EASY',
  availableGatePalette: { OR: 1, AND: 1, NOT: 0, XOR: 0, NAND: 0, NOR: 0, XNOR: 0 },
  primaryInputs: ['in_A', 'in_B'],
  primaryOutputs: ['out_Y'],
  inputValues: { in_A: 1, in_B: 0 },
  targetOutputs: { out_Y: 1 },
  executionOrder: ['slot_1'],

  slots: {
    slot_1: {
      id: 'slot_1',
      assignedGate: 'NULL',
      inputs: [
        { sourceType: 'PRIMARY_INPUT', sourceId: 'in_A' },
        { sourceType: 'PRIMARY_INPUT', sourceId: 'in_B' },
      ],
      outputWireId: 'out_Y',
    },
  },
  hints: [],
};

export class LevelScreen {
  private store!: GameStore;
  private unsubscribe = () => {};
  private boardView: BoardView;
  private sideMenu!: SideMenu;
  private gateInfo!: GateInfoModal;
  private readonly startingLevel: LevelConfig;
  private readonly storage?: StorageAdapter;
  private readonly onNextLevel?: (level: LevelConfig) => void;
  private readonly onPreviousLevel?: (level: LevelConfig) => void;
  private readonly onMainMenu?: () => void;
  private readonly controls = new AbortController();

  // Minigame timer settings
  private readonly timed: boolean;
  private readonly durationSeconds: number;

  // Timer state
  private timeRemaining: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private gameEnded = false;

  constructor(options: LevelScreenOptions = {}) {
    this.startingLevel = options.level ?? LEVEL_1_CONFIG;
    this.storage = options.storage;
    this.onNextLevel = options.onNextLevel;
    this.onPreviousLevel = options.onPreviousLevel;
    this.onMainMenu = options.onMainMenu;
    this.timed = options.timed ?? false;
    this.durationSeconds =
      options.durationSeconds ?? DEFAULT_MINIGAME_DURATION_SECONDS;

    this.timeRemaining = this.durationSeconds;
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) timerDisplay.hidden = !this.timed;

    const container = document.getElementById('konva-container') as HTMLDivElement;
    const boardOptions = {
      container,
      levelConfig: this.startingLevel,
      onPlaceGate: (slotId: string, gate: GateType) => {
        if (!this.gameEnded) this.store.dispatch({ type: 'PLACE_GATE', slotId, gate });
      },
      onRemoveGate: (slotId: string) => {
        if (!this.gameEnded) this.store.dispatch({ type: 'REMOVE_GATE', slotId });
      },
      onGateInfo: (gate: GateType) => this.openGateInfo(gate),
    };

    const Board = LEVEL_BOARD_VIEWS[this.startingLevel.id];
    this.boardView = Board ? new Board(boardOptions) : new GameBoardView(boardOptions);

    this.setupHeaderAndTray();
    this.updateLevelProgressUI();
    this.loadLevel(this.restoreLevel());
    if (this.timed) this.startTimer();
    this.showLevelIntro();
  }

  // The store has no reset action, so starting a level over means a fresh store.
  private loadLevel(level: LevelConfig) {
    this.unsubscribe();
    this.store = createStore(level);
    this.unsubscribe = this.store.subscribe((state) => {
      this.saveProgress(state);
      this.render(state);
    });
    // Listeners only hear about later actions, so draw the starting state now.
    this.render(this.store.getState());
  }

  private restoreLevel(): LevelConfig {
    const level = this.startingLevel;
    const progress = this.storage?.loadLevel(level);
    if (!progress || Object.keys(progress.placements).length === 0) return level;

    const slots = Object.fromEntries(Object.entries(level.slots).map(([id, slot]) => [
      id,
      { ...slot, assignedGate: progress.placements[id] ?? slot.assignedGate },
    ]));
    try {
      // A partial save and the authored gates must fit within inventory together.
      return loadLevel({ ...level, slots });
    } catch (error) {
      if (error instanceof LevelValidationError) return level;
      throw error;
    }
  }

  private saveProgress(state: GameState): void {
    if (!this.storage) return;
    const placements = Object.fromEntries(Object.values(state.level.slots).map((slot) => [
      slot.id,
      slot.assignedGate,
    ]));
    this.storage.saveLevel(this.startingLevel, {
      placements,
      completed: state.result?.isSolved ?? false,
      stars: 0,
    });
  }

  destroy(): void {
    this.stopTimer();
    this.hideGameOver();
    this.hideLevelNavButtons();
    this.sideMenu.close();
    this.gateInfo.close();
    this.unsubscribe();
    this.controls.abort();
    this.boardView.destroy();
  }

  // Update the timer display in the UI
  private startTimer() {
    if (!this.timed) return;

    this.stopTimer();
    this.timeRemaining = this.durationSeconds;
    this.gameEnded = false;
    this.hideGameOver();
    this.updateTimerDisplay();

    this.timerId = setInterval(() => { this.timeRemaining--; this.updateTimerDisplay();
      if (this.timeRemaining <= 0) this.finishGame(false);}, 1000);
  }

  private stopTimer() {
    if (this.timerId !== null) clearInterval(this.timerId);
    this.timerId = null;
  }

  private updateTimerDisplay() {
    const timer = document.getElementById('timer-display');
    if (timer) timer.textContent = `${this.timeRemaining}s`;
  }

  private finishGame(won: boolean) {
    if (this.gameEnded) return;

    this.gameEnded = true;
    this.stopTimer();

    const overlay = document.getElementById('game-over-overlay');
    const title = document.getElementById('game-over-title');
    const message = document.getElementById('game-over-message');

    if (title) title.textContent = won ? 'Level Complete!' : "Time's Up!";
    if (message) message.textContent = won ? `You finished with ${this.timeRemaining}s remaining!` : 'You ran out of time.';
    if (overlay) overlay.hidden = false;
    
    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = true;
  }

  private hideGameOver() {
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) overlay.hidden = true;
  }

  private catalogIndex(): number {
    return mainLevels.findIndex((level) => level.id === this.startingLevel.id);
  }

  private nextCatalogLevel(): LevelConfig | undefined {
    const index = this.catalogIndex();
    if (index < 0 || index >= mainLevels.length - 1) return undefined;
    return mainLevels[index + 1];
  }

  private previousCatalogLevel(): LevelConfig | undefined {
    const index = this.catalogIndex();
    if (index <= 0) return undefined;
    return mainLevels[index - 1];
  }

  private hideLevelNavButtons(): void {
    const next = document.getElementById('next-level-btn');
    const prev = document.getElementById('prev-level-btn');
    if (next) next.hidden = true;
    if (prev) prev.hidden = true;
  }

  private updateLevelNavButtons(solved: boolean): void {
    const next = document.getElementById('next-level-btn');
    if (next) next.hidden = !(solved && this.nextCatalogLevel() && this.onNextLevel);

    const prev = document.getElementById('prev-level-btn');
    if (prev) prev.hidden = !(this.previousCatalogLevel() && this.onPreviousLevel);
  }

  private render(state: GameState) {
    this.boardView.render(state.level, state.result?.wireStates ?? {});
    this.renderTrayUI(state);
    this.updateLevelNavButtons(state.result?.isSolved ?? false);

    if (this.timed && !this.gameEnded && state.result?.isSolved) {
      this.finishGame(true);
    }

    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = this.gameEnded || !state.canUndo;
  }

  private setupHeaderAndTray() {
    const options = { signal: this.controls.signal };
    this.sideMenu = new SideMenu(this.controls.signal);
    this.gateInfo = new GateInfoModal(this.controls.signal);
    document.getElementById('menu-btn')?.addEventListener('click', () => this.sideMenu.open(), options);
    document.getElementById('main-menu-btn')?.addEventListener('click', () => this.onMainMenu?.(), options);

    document.getElementById('next-level-btn')?.addEventListener('click', () => {
      const next = this.nextCatalogLevel();
      if (next) this.onNextLevel?.(next);
    }, options);

    document.getElementById('prev-level-btn')?.addEventListener('click', () => {
      const previous = this.previousCatalogLevel();
      if (previous) this.onPreviousLevel?.(previous);
    }, options);

    const reset = () => {
      this.loadLevel(this.startingLevel);
      this.saveProgress(this.store.getState());
      if (this.timed) this.startTimer();
    };
    document.getElementById('reset-btn')?.addEventListener('click', reset, options);
    document.getElementById('restart-minigame-btn')?.addEventListener('click', reset, options);

    // Undo Button Event: the store takes back the latest board change, if there is one
    document.getElementById('undo-btn')?.addEventListener('click', () => {
      if (!this.gameEnded) {
        this.store.dispatch({ type: 'UNDO' });
      }
    }, options);

  }

  /** Sync top dots, board badge, and sidebar footer to the catalog position. */
  private updateLevelProgressUI(): void {
    const index = this.catalogIndex();
    const total = mainLevels.length;
    const levelNumber = index >= 0 ? index + 1 : 1;
    const label = `Level ${levelNumber} <span class="dim">/ ${total}</span>`;

    const title = document.getElementById('level-title');
    if (title) title.innerHTML = label;

    const footer = document.querySelector('.sidebar-footer');
    if (footer) footer.innerHTML = label;

    const dotsContainer = document.getElementById('progress-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = Array.from({ length: total }, (_, i) =>
        `<div class="dot${i === index ? ' current active' : ''}"></div>`,
      ).join('');
    }
  }

  private renderTrayUI(state: GameState) {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    // The palette never changes, so it fixes which cards show; the inventory says how many are left.
    const trayGates = (Object.keys(state.level.availableGatePalette) as GateType[])
      .filter((gate) => state.level.availableGatePalette[gate] > 0);
    const slots = Object.values(state.level.slots);

    grid.innerHTML = trayGates
      .map((gate) => {
        const isSelected = slots.length === 1 && slots[0].assignedGate === gate;
        const remaining = state.inventory[gate];
        const isEmpty = remaining <= 0;
        return `
          <div 
            class="gate-card${isSelected ? ' selected' : ''}" 
            draggable="${!isEmpty}" 
            data-gate="${gate}"
            aria-label="${gate}"
            aria-disabled="${isEmpty}"
            style="
              cursor: ${isEmpty ? 'not-allowed' : 'grab'};
              opacity: ${isEmpty && !isSelected ? 0.4 : 1};
            "
          >
            <img
              class="gate-card-icon"
              src="/assets/${gate}.svg"
              alt="${gate}"
              draggable="false"
            />
            <button
              type="button"
              class="gate-card-info-btn"
              data-gate-info="${gate}"
              aria-label="About ${gate}"
            >
              <img src="/assets/info.svg" alt="" draggable="false" />
            </button>
            <span class="gate-count">×${remaining}</span>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.gate-card-info-btn').forEach((button) => {
      const gate = button.getAttribute('data-gate-info') as GateType;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.openGateInfo(gate);
      });
      button.addEventListener('pointerdown', (event) => event.stopPropagation());
    });

    // Attach native HTML Drag & Click listeners; empty cards get none, as the store would reject them.
    grid.querySelectorAll('.gate-card[aria-disabled="false"]').forEach((card) => {
      const gate = card.getAttribute('data-gate') as GateType;

      if (slots.length === 1) {
        card.addEventListener('click', (event) => {
          if ((event.target as HTMLElement).closest('.gate-card-info-btn')) return;
          if (this.gameEnded) return;
          this.store.dispatch({ type: 'PLACE_GATE', slotId: slots[0].id, gate });
        });
      }
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }

  private openGateInfo(gate: GateType): void {
    this.gateInfo.open(gate);
  }

  /** Same info card(s) as ⓘ, shown when entering a catalog level. */
  private showLevelIntro(): void {
    const gates = levelIntroGates[this.startingLevel.id];
    if (!gates?.length) return;
    this.gateInfo.openGates(gates, { locked: true });
  }
}
