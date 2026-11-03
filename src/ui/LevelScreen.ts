import { GameBoardView } from './components/GameBoardView';
import { createStore, type GameState, type GameStore } from '../state/store';
import type { GateType, LevelConfig } from '../types/circuit';

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

  constructor() {
    const container = document.getElementById('konva-container') as HTMLDivElement;

    // Initialize Vanilla Konva Canvas Renderer. The store validates every move,
    // so untrusted drag-and-drop data can be dispatched as is.
    this.boardView = new GameBoardView({
      container,
      levelConfig: LEVEL_1_CONFIG,
      onPlaceGate: (slotId, gate) => this.store.dispatch({ type: 'PLACE_GATE', slotId, gate }),
      onRemoveGate: (slotId) => this.store.dispatch({ type: 'REMOVE_GATE', slotId }),
    });

    this.setupHeaderAndTray();
    this.loadLevel(LEVEL_1_CONFIG);
  }

  // The store has no reset action, so starting a level over means a fresh store.
  private loadLevel(level: LevelConfig) {
    this.unsubscribe();
    this.store = createStore(level);
    this.unsubscribe = this.store.subscribe((state) => this.render(state));
    // Listeners only hear about later actions, so draw the starting state now.
    this.render(this.store.getState());
  }

  // Hard mode has no result until a check action exists, so wires stay unlit.
  private render(state: GameState) {
    this.boardView.render(state.level, state.result?.wireStates ?? {});
    this.renderTrayUI(state);
  }

  private setupHeaderAndTray() {
    // Reset Button Event
    document.getElementById('reset-btn')?.addEventListener('click', () => this.loadLevel(LEVEL_1_CONFIG));

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

      card.addEventListener('click', () => this.store.dispatch({ type: 'PLACE_GATE', slotId: 'slot_1', gate }));
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }
}