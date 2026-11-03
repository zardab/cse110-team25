
import { GameBoardView } from './components/GameBoardView';
import type {
  LevelConfig,
  AssignedGates,
  GateType,
  SignalState,
  SimulationResult,
} from '../types/circuit';

// Descriptions displayed when hovering over gates
const GATE_DESCRIPTIONS: Partial<Record<GateType, string>> = {
  AND: 'AND: Outputs 1 only when both inputs are 1.',
  OR: 'OR: Outputs 1 when at least one input is 1.',
  NOT: 'NOT: Inverts the input (0 becomes 1, 1 becomes 0).',
};

import { evaluateCircuit } from '../simulation/evaluateCircuit';
import type { AssignedGate, GateType, LevelConfig } from '../types/circuit';

const LEVEL_1_CONFIG: LevelConfig = {
  id: 'level_01_intro',
  title: 'Level 1: The OR Gate',
  difficulty: 'EASY',
  availableGatePalette: { OR: 1, AND: 1, NOT: 1, XOR: 0, NAND: 0, NOR: 0, XNOR: 0 },
  primaryInputs: ['in_A', 'in_B'],
  primaryOutputs: ['out_Y'],
  inputValues: { in_A: 1, in_B: 0 },
  targetOutputs: { out_Y: 1 },
  executionOrder: ['slot_1'],

  slots: {
    slot_1: {
      id: 'slot_1',
      assignedGate: 'NULL',
      allowedGates: ['OR', 'AND', 'NOT'],
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
  private resetButton: HTMLElement | null = null;

  private readonly onReset = () => {
    this.assignedGates = { slot_1: null };
    this.update();
  };

  constructor() {
    const container = document.getElementById(
      'konva-container'
    ) as HTMLDivElement;

    this.boardView = new GameBoardView({
      container,
      levelConfig: LEVEL_1_CONFIG,
      onPlaceGate: (slotId, gate) => this.placeGate(slotId, gate),
      onRemoveGate: (slotId) => this.removeGate(slotId),
    });

    this.setupHeaderAndTray();
    this.update();
  }

  // REPLACE WITH PLACE GATE/REMOVE GATE
  //placeholders
  private placeGate(slotId: string, gate: GateType): void {
    this.assignedGates = {
      ...this.assignedGates,
      [slotId]: gate,
    };
    this.update();
  }

  private removeGate(slotId: string): void {
    this.assignedGates = {
      ...this.assignedGates,
      [slotId]: null,
    };
    this.update();
  }

  private update(): void {
    const simResult = evaluateCircuitState(
      LEVEL_1_CONFIG,
      this.assignedGates
    );

    this.boardView.render(
      this.assignedGates,
      simResult.wireStates
    );

    this.renderTrayUI();
  }

  private setupHeaderAndTray(): void {
    this.resetButton = document.getElementById('reset-btn');
    this.resetButton?.addEventListener('click', this.onReset);

    const dotsContainer = document.getElementById('progress-dots');

    if (dotsContainer) {
      dotsContainer.innerHTML = Array.from(
        { length: 12 },
        (_, i) =>
          `<div class="dot ${i === 0 ? 'current active' : ''}"></div>`
      ).join('');
    }
  }

  private renderTrayUI(): void {
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
            title="${GATE_DESCRIPTIONS[gate]}"
            style="
              border: ${isSelected ? '2px solid #3B82F6' : '1px solid #E5E7EB'};
              background-color: ${isSelected ? '#EFF6FF' : '#F9FAFB'};
              cursor: grab;
            "
          >
            <span style="font-weight: 700; font-size: 14px;">
              ${gate}
            </span>
          </div>
        `;
      })
      .join('');

    grid.querySelectorAll('.gate-card').forEach((card) => {
      const gate = card.getAttribute('data-gate') as GateType;

      card.addEventListener('click', () => {
        this.placeGate('slot_1', gate);
      });

      card.addEventListener('dragstart', (e) => {
        (e as DragEvent).dataTransfer?.setData('gateType', gate);
      });
    });
  }

  destroy(): void {
    this.resetButton?.removeEventListener('click', this.onReset);
    this.boardView.destroy();
  }
}
