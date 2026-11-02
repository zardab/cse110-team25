// src/ui/LevelScreen.ts
import { GameBoardView } from './components/GameBoardView';
import { evaluateCircuit } from '../simulation/evaluateCircuit';
import type { AssignedGate, GateType, LevelConfig } from '../types/circuit';

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

const TRAY_GATES: GateType[] = ['OR', 'AND'];

// Board changes replace the slot value; connections are never touched.
function withGate(level: LevelConfig, slotId: string, gate: AssignedGate): LevelConfig {
  return { ...level, slots: { ...level.slots, [slotId]: { ...level.slots[slotId], assignedGate: gate } } };
}

export class LevelScreen {
  private level: LevelConfig = LEVEL_1_CONFIG;
  private boardView: GameBoardView;

  constructor() {
    const container = document.getElementById('konva-container') as HTMLDivElement;

    // Initialize Vanilla Konva Canvas Renderer
    this.boardView = new GameBoardView({
      container,
      levelConfig: LEVEL_1_CONFIG,
      onPlaceGate: (slotId, gate) => this.placeGate(slotId, gate),
      onRemoveGate: (slotId) => this.removeGate(slotId),
    });

    this.setupHeaderAndTray();
    this.update();
  }

  // Gates arrive from drag-and-drop data, so treat them as untrusted: reject
  // unknown slots and gates the slot does not allow instead of evaluating them.
  private placeGate(slotId: string, gate: GateType) {
    if (!Object.hasOwn(this.level.slots, slotId)) return;
    const { allowedGates } = this.level.slots[slotId];
    if (allowedGates && !allowedGates.includes(gate)) return;
    this.level = withGate(this.level, slotId, gate);
    this.update();
  }

  private removeGate(slotId: string) {
    if (!Object.hasOwn(this.level.slots, slotId)) return;
    this.level = withGate(this.level, slotId, 'NULL');
    this.update();
  }

  // Called on state changes to recalculate and redraw
  private update() {
    const simResult = evaluateCircuit(this.level);
    this.boardView.render(this.level, simResult.wireStates);
    this.renderTrayUI();
  }

  private setupHeaderAndTray() {
    // Reset Button Event
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.level = LEVEL_1_CONFIG;
      this.update();
    });

    // Render 12 progress dots
    const dotsContainer = document.getElementById('progress-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = Array.from({ length: 12 }, (_, i) => 
        `<div class="dot ${i === 0 ? 'current active' : ''}"></div>`
      ).join('');
    }
  }

  private renderTrayUI() {
    const grid = document.getElementById('palette-grid');
    if (!grid) return;

    grid.innerHTML = TRAY_GATES
      .map((gate) => {
        const isSelected = this.level.slots['slot_1'].assignedGate === gate;
        return `
          <div 
            class="gate-card" 
            draggable="true" 
            data-gate="${gate}"
            style="
              border: ${isSelected ? '2px solid #3B82F6' : '1px solid #E5E7EB'};
              background-color: ${isSelected ? '#EFF6FF' : '#F9FAFB'};
              cursor: grab;
            "
          >
            <span style="font-weight: 700; font-size: 14px;">${gate}</span>
          </div>
        `;
      })
      .join('');

    // Attach native HTML Drag & Click listeners
    grid.querySelectorAll('.gate-card').forEach((card) => {
      const gate = card.getAttribute('data-gate') as GateType;

      card.addEventListener('click', () => this.placeGate('slot_1', gate));
      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }
}