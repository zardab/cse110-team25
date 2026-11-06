import { GameBoardView } from './components/GameBoardView';
import { createStore, type GameState, type GameStore } from '../state/store';
import type { GateType, LevelConfig } from '../types/circuit';

const DEFAULT_MINIGAME_DURATION_SECONDS = 15;

//Added this interface to allow for optional parameters in the LevelScreen constructor (i.e. minigame timer settings)
interface LevelScreenOptions {
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

  // Minigame timer settings
  private readonly timed: boolean;
  private readonly durationSeconds: number;

  // Timer state
  private timeRemaining: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private gameEnded = false;

  constructor(options: LevelScreenOptions = {}) {
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
      levelConfig: LEVEL_1_CONFIG,
      onPlaceGate: (slotId, gate) => { if (!this.gameEnded) this.store.dispatch({ type: 'PLACE_GATE', slotId, gate }); },
      onRemoveGate: (slotId) => { if (!this.gameEnded) this.store.dispatch({ type: 'REMOVE_GATE', slotId }); },
    });

    this.setupHeaderAndTray();
    this.loadLevel(LEVEL_1_CONFIG);
    if (this.timed) this.startTimer();
  }

  // The store has no reset action, so starting a level over means a fresh store.
  private loadLevel(level: LevelConfig) {
    this.unsubscribe();
    this.store = createStore(level);
    this.unsubscribe = this.store.subscribe((state) => this.render(state));
    // Listeners only hear about later actions, so draw the starting state now.
    this.render(this.store.getState());
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

  // Hard mode has no result until a check action exists, so wires stay unlit.
  private render(state: GameState) {
    this.boardView.render(state.level, state.result?.wireStates ?? {});
    this.renderTrayUI(state);

    if (this.timed && !this.gameEnded && state.result?.isSolved) {
      this.finishGame(true);
    }

    const undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
    if (undoBtn) undoBtn.disabled = this.gameEnded || !state.canUndo;
  }

  private setupHeaderAndTray() {
    // Reset Button Events (reset level and restart timer for minigame)
    document.getElementById('reset-btn')?.addEventListener('click', () => { this.loadLevel(LEVEL_1_CONFIG); if (this.timed) this.startTimer(); });
    document.getElementById('restart-minigame-btn')?.addEventListener('click', () => { this.loadLevel(LEVEL_1_CONFIG); this.startTimer(); });

    // Undo Button Event: the store takes back the latest board change, if there is one
    document.getElementById('undo-btn')?.addEventListener('click', () => {
      if (!this.gameEnded) {
        this.store.dispatch({ type: 'UNDO' });
      }
    });

    // Render 12 progress dots
    const dotsContainer = document.getElementById('progress-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = Array.from({ length: 12 }, (_, i) => 
        `<div class="dot ${i === 0 ? 'current active' : ''}"></div>`
      ).join('');
    }
  }

  private renderTrayUI(state: GameState) {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    // The palette never changes, so it fixes which cards show; the inventory says how many are left.
    const trayGates = (Object.keys(state.level.availableGatePalette) as GateType[])
      .filter((gate) => state.level.availableGatePalette[gate] > 0);

    grid.innerHTML = trayGates
      .map((gate) => {
        const isSelected = state.level.slots['slot_1'].assignedGate === gate;
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

      card.addEventListener('click', () => { if (!this.gameEnded) this.store.dispatch({ type: 'PLACE_GATE', slotId: 'slot_1', gate }); });
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }
}