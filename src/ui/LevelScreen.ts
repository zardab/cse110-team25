import { GameBoardView } from './components/GameBoardView';
import { createStore } from '../state/store';
import type { GameState, GameStore } from '../state/store';
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
  private store: GameStore;
  private boardView: GameBoardView;
  // Gates the level offers. Fixed at the start so a gate that runs out stays visible, greyed out.
  private trayGates: GateType[];

  constructor() {
    const container = document.getElementById('konva-container') as HTMLDivElement;
    this.store = createStore(LEVEL_1_CONFIG);
    this.trayGates = (Object.keys(LEVEL_1_CONFIG.availableGatePalette) as GateType[]).filter(
      (gate) => LEVEL_1_CONFIG.availableGatePalette[gate] > 0,
    );

    // Initialize Vanilla Konva Canvas Renderer
    this.boardView = new GameBoardView({
      container,
      levelConfig: LEVEL_1_CONFIG,
      // The store decides whether a placement is legal, so unknown slots, disallowed gates
      // and empty inventory are rejected there rather than checked here.
      onPlaceGate: (slotId, gate) => this.store.dispatch({ type: 'PLACE_GATE', slotId, gate }),
      onRemoveGate: (slotId) => this.store.dispatch({ type: 'REMOVE_GATE', slotId }),
    });

    this.setupHeaderAndTray();
    this.store.subscribe((state) => this.render(state));
    this.render(this.store.getState());
  }

  // Redraws everything from the store's state.
  private render(state: GameState) {
    this.boardView.render(state.level, state.result?.wireStates ?? {});
    this.renderTrayUI(state);
  }

  // The store has no reset action yet, so reset removes every placed gate through it.
  private resetBoard() {
    for (const slot of Object.values(this.store.getState().level.slots)) {
      if (slot.assignedGate !== 'NULL') {
        this.store.dispatch({ type: 'REMOVE_GATE', slotId: slot.id });
      }
    }
  }

  private setupHeaderAndTray() {
    // Reset Button Event
    document.getElementById('reset-btn')?.addEventListener('click', () => this.resetBoard());

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

    grid.innerHTML = this.trayGates
      .map((gate) => {
        const remaining = state.inventory[gate];
        const isAvailable = remaining > 0;
        const isSelected = state.level.slots['slot_1'].assignedGate === gate;
        return `
          <div 
            class="gate-card" 
            draggable="${isAvailable}" 
            data-gate="${gate}"
            data-remaining="${remaining}"
            style="
              border: ${isSelected ? '2px solid #3B82F6' : '1px solid #E5E7EB'};
              background-color: ${isSelected ? '#EFF6FF' : '#F9FAFB'};
              cursor: ${isAvailable ? 'grab' : 'not-allowed'};
              opacity: ${isAvailable ? 1 : 0.4};
            "
          >
            <span style="font-weight: 700; font-size: 14px;">${gate}</span>
            <span style="font-size: 12px; color: #6B7280;">×${remaining}</span>
          </div>
        `;
      })
      .join('');

    // Attach native HTML Drag & Click listeners
    grid.querySelectorAll('.gate-card').forEach((card) => {
      const gate = card.getAttribute('data-gate') as GateType;

      card.addEventListener('click', () => {
        this.store.dispatch({ type: 'PLACE_GATE', slotId: 'slot_1', gate });
      });
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }
}
