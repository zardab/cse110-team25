import { GameBoardView } from './components/GameBoardView';
import { createStore, type GameState, type GameStore } from '../state/store';
import type { GateType, LevelConfig } from '../types/circuit';
import { LevelValidationError, loadLevel } from '../content/levelLoader';
import type { StorageAdapter } from '../persistence/storageAdapter';

const DEFAULT_MINIGAME_DURATION_SECONDS = 15;

//Added this interface to allow for optional parameters in the LevelScreen constructor (i.e. minigame timer settings)
interface LevelScreenOptions {
  level?: LevelConfig;
  storage?: StorageAdapter;
  timed?: boolean;
  durationSeconds?: number;
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
      allowedGates: ['OR', 'AND'],
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
  private boardView: GameBoardView;
  private readonly startingLevel: LevelConfig;
  private readonly storage?: StorageAdapter;
  private readonly controls = new AbortController();
  private selectedGate: GateType | undefined;

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
    this.timed = options.timed ?? false;
    this.durationSeconds =
      options.durationSeconds ?? DEFAULT_MINIGAME_DURATION_SECONDS;

    this.timeRemaining = this.durationSeconds;
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) timerDisplay.hidden = !this.timed;

    const container = document.getElementById('konva-container') as HTMLDivElement;

    // Initialize Vanilla Konva Canvas Renderer. The store validates every move,
    // so untrusted drag-and-drop data can be dispatched as is.
    this.boardView = new GameBoardView({
      container,
      levelConfig: this.startingLevel,
      onPlaceGate: (slotId, gate) => {
        if (!this.gameEnded) this.store.dispatch({ type: 'PLACE_GATE', slotId, gate });
      },
      onRemoveGate: (slotId) => {
        if (!this.gameEnded) this.store.dispatch({ type: 'REMOVE_GATE', slotId });
      },
      onSlotClick: (slotId) => {
        if (!this.gameEnded && this.selectedGate) {
          this.store.dispatch({ type: 'PLACE_GATE', slotId, gate: this.selectedGate });
        }
      },
    });

    this.setupHeaderAndTray();
    const title = document.getElementById('level-title');
    if (title) title.textContent = this.startingLevel.title;
    const check = document.getElementById('check-answer-btn');
    if (check) check.hidden = this.startingLevel.difficulty !== 'HARD';
    this.loadLevel(this.restoreLevel());
    if (this.timed) this.startTimer();
  }

  // The store has no reset action, so starting a level over means a fresh store.
  private loadLevel(level: LevelConfig) {
    this.unsubscribe();
    this.selectedGate = undefined;
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

  private render(state: GameState) {
    if (this.selectedGate && state.inventory[this.selectedGate] <= 0) {
      this.selectedGate = undefined;
    }
    this.boardView.setPlacingGate(this.selectedGate !== undefined);
    this.boardView.render(state.level, state.result?.wireStates ?? {});
    this.renderTrayUI(state);

    const status = document.getElementById('level-status');
    if (status) {
      status.textContent = state.result?.isSolved ? 'Level complete!'
        : this.startingLevel.difficulty === 'HARD' && state.result
          ? state.result.isComplete ? 'Check your gate placements.' : 'Fill every slot first.'
          : '';
    }

    if (this.timed && !this.gameEnded && state.result?.isSolved) {
      this.finishGame(true);
    }

    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = this.gameEnded || !state.canUndo;
  }

  private setupHeaderAndTray() {
    const options = { signal: this.controls.signal };
    const reset = () => {
      this.loadLevel(this.startingLevel);
      this.saveProgress(this.store.getState());
      if (this.timed) this.startTimer();
    };
    document.getElementById('reset-btn')?.addEventListener('click', reset, options);
    document.getElementById('restart-minigame-btn')?.addEventListener('click', reset, options);
    document.getElementById('check-answer-btn')?.addEventListener('click', () => {
      if (!this.gameEnded) this.store.dispatch({ type: 'CHECK_ANSWER' });
    }, options);

    // Undo Button Event: the store takes back the latest board change, if there is one
    document.getElementById('undo-btn')?.addEventListener('click', () => {
      if (!this.gameEnded) {
        this.store.dispatch({ type: 'UNDO' });
      }
    }, options);
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
        const isSelected = this.selectedGate === gate
          || (slots.length === 1 && slots[0].assignedGate === gate);
        const remaining = state.inventory[gate];
        const isEmpty = remaining <= 0;
        return `
          <div 
            class="gate-card" 
            draggable="${!isEmpty}" 
            data-gate="${gate}"
            aria-disabled="${isEmpty}"
            style="
              border: ${isSelected ? '2px solid #3B82F6' : '1px solid #E5E7EB'};
              background-color: ${isSelected ? '#EFF6FF' : '#F9FAFB'};
              cursor: ${isEmpty ? 'not-allowed' : 'grab'};
              opacity: ${isEmpty && !isSelected ? 0.4 : 1};
            "
          >
            <span style="font-weight: 700; font-size: 14px;">${gate}</span>
            <span class="gate-count" style="font-size: 12px; color: #6B7280;">×${remaining}</span>
          </div>
        `;
      })
      .join('');

    // Attach native HTML Drag & Click listeners; empty cards get none, as the store would reject them.
    grid.querySelectorAll('.gate-card[aria-disabled="false"]').forEach((card) => {
      const gate = card.getAttribute('data-gate') as GateType;

      card.addEventListener('click', () => {
        if (this.gameEnded) return;
        if (slots.length === 1) {
          this.store.dispatch({ type: 'PLACE_GATE', slotId: slots[0].id, gate });
        } else {
          this.selectedGate = this.selectedGate === gate ? undefined : gate;
          this.boardView.setPlacingGate(this.selectedGate !== undefined);
          this.renderTrayUI(state);
        }
      });
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }
}
