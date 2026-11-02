// src/ui/LevelScreen.ts
import { GameBoardView } from './components/GameBoardView';
import { LevelConfig, AssignedGates, GateType, SignalState, SimulationResult } from '../types/circuit';

// Mock backend evaluator hook for Track A handoff
const evaluateCircuitState = (
  _levelConfig: LevelConfig,
  assignedGates: AssignedGates
): SimulationResult => {
  const in_A = 1;
  const in_B = 0;
  const gate = assignedGates['slot_1'];

  let out_Y: SignalState = 'FLOATING';
  if (gate === 'OR') out_Y = (in_A || in_B) as SignalState;
  if (gate === 'AND') out_Y = (in_A && in_B) as SignalState;
  if (gate === 'NOT') out_Y = in_A ? 0 : 1;

  const isSolved = out_Y === 1;

  return {
    isComplete: Boolean(gate),
    isSolved,
    wireStates: { in_A, in_B, out_Y },
    firstDivergentSlotId: isSolved ? null : 'slot_1',
  };
};

const LEVEL_1_CONFIG: LevelConfig = {
  id: 'level_01_intro',
  title: 'Level 1: The OR Gate',
  difficulty: 'EASY',
  availableGatePalette: { OR: 1, AND: 1, NOT: 1, XOR: 0, NAND: 0, NOR: 0, XNOR: 0 },
  primaryInputs: ['in_A', 'in_B'],
  primaryOutputs: ['out_Y'],
  executionOrder: ['slot_1'],
  slots: {
    slot_1: {
      id: 'slot_1',
      allowedGates: ['OR', 'AND', 'NOT'],
      inputs: [
        { sourceType: 'PRIMARY_INPUT', sourceId: 'in_A' },
        { sourceType: 'PRIMARY_INPUT', sourceId: 'in_B' },
      ],
      outputWireId: 'out_Y',
    },
  },
  truthTableTarget: [],
  hints: [],
};

export class LevelScreen {
  private assignedGates: AssignedGates = { slot_1: null };
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

  private placeGate(slotId: string, gate: GateType) {
    this.assignedGates = { ...this.assignedGates, [slotId]: gate };
    this.update();
  }

  private removeGate(slotId: string) {
    this.assignedGates = { ...this.assignedGates, [slotId]: null };
    this.update();
  }

  // Called on state changes to recalculate and redraw
  private update() {
    const simResult = evaluateCircuitState(LEVEL_1_CONFIG, this.assignedGates);
    this.boardView.render(this.assignedGates, simResult.wireStates);
    this.renderTrayUI();
  }

  private setupHeaderAndTray() {
    // Reset Button Event
    document.getElementById('reset-btn')?.addEventListener('click', () => {
      this.assignedGates = { slot_1: null };
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

    const gates: GateType[] = ['OR', 'AND', 'NOT'];
    grid.innerHTML = gates
      .map((gate) => {
        const isSelected = this.assignedGates['slot_1'] === gate;
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