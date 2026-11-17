import Konva from 'konva';
import type { LevelConfig, SignalState, GateType } from '../../../types/circuit';

interface BoardViewOptions {
  container: HTMLDivElement;
  levelConfig: LevelConfig;
  onPlaceGate?: (slotId: string, gate: GateType) => void;
  onRemoveGate?: (slotId: string) => void;
}

interface Point { x: number; y: number }

const SLOT_WIDTH = 120;
const SLOT_HEIGHT = 64;
const STAGE_WIDTH = 850;
const STAGE_HEIGHT = 420;

/** Fixed layout for level_01_foundations: NOT → AND → OR → out_Y */
const INPUT_POSITIONS: Record<string, Point> = {
  in_A: { x: 105, y: 160 },
  in_B: { x: 105, y: 260 },
  in_C: { x: 105, y: 340 },
};

const SLOT_POSITIONS: Record<string, Point> = {
  slot_not: { x: 200, y: 128 },
  slot_and: { x: 400, y: 180 },
  slot_or: { x: 600, y: 220 },
};

const OUTPUT_POSITION: Point = { x: 780, y: 252 };

export class Level01FoundationsBoardView {
  private readonly stage: Konva.Stage;
  private readonly layer = new Konva.Layer();
  private readonly controls = new AbortController();
  private slotPositions = new Map<string, Point>();

  constructor(private readonly options: BoardViewOptions) {
    this.stage = new Konva.Stage({
      container: options.container,
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
    });
    this.stage.add(this.layer);
    options.container.addEventListener('dragover', (event) => event.preventDefault(),
      { signal: this.controls.signal });
    options.container.addEventListener('drop', (event) => this.dropGate(event),
      { signal: this.controls.signal });
  }

  render(level: LevelConfig, wireStates: Record<string, SignalState> = {}): void {
    this.layer.destroyChildren();
    this.slotPositions.clear();

    for (const [id, position] of Object.entries(SLOT_POSITIONS)) {
      this.slotPositions.set(id, position);
    }

    const outputSources = new Map<string, Point>();

    for (const id of level.executionOrder) {
      const slot = level.slots[id];
      const position = this.slotPositions.get(id);
      if (!position) continue;

      slot.inputs.forEach((source, index) => {
        const end = {
          x: position.x,
          y: position.y + SLOT_HEIGHT * (index + 1) / (slot.inputs.length + 1),
        };
        if (source.sourceType === 'PRIMARY_INPUT') {
          this.drawWire(INPUT_POSITIONS[source.sourceId], end, level.inputValues[source.sourceId]);
        } else {
          const wireId = level.slots[source.sourceId].outputWireId;
          const start = outputSources.get(wireId);
          if (start) this.drawWire(start, end, wireStates[wireId]);
        }
      });

      outputSources.set(slot.outputWireId, {
        x: position.x + SLOT_WIDTH,
        y: position.y + SLOT_HEIGHT / 2,
      });
    }

    for (const id of level.primaryOutputs) {
      const start = outputSources.get(id);
      if (!start) continue;
      const signal = wireStates[id];
      this.drawWire(start, OUTPUT_POSITION, signal);
      const x = OUTPUT_POSITION.x + 24;
      const y = OUTPUT_POSITION.y;
      const isHigh = signal === 1;
      if (isHigh) this.layer.add(new Konva.Circle({ x, y, radius: 28, fill: '#FEF08A', opacity: 0.6 }));
      this.layer.add(new Konva.Circle({ x, y, radius: 22, fill: isHigh ? '#FACC15' : '#E5E7EB' }));
      this.layer.add(new Konva.Text({ x, y, text: '💡', fontSize: 24, offsetX: 12, offsetY: 12 }));
    }

    for (const [id, point] of Object.entries(INPUT_POSITIONS)) {
      const value = level.inputValues[id];
      this.layer.add(new Konva.Text({
        x: point.x - 15, y: point.y, text: '⚡', fontSize: 26,
        fill: value ? '#EAB308' : '#9CA3AF', offsetX: 13, offsetY: 13,
      }));
    }

    for (const [id, position] of this.slotPositions) {
      const gate = level.slots[id]?.assignedGate;
      if (gate === undefined) continue;
      const empty = gate === 'NULL';
      const group = new Konva.Group(position);
      group.add(new Konva.Rect({
        width: SLOT_WIDTH, height: SLOT_HEIGHT, cornerRadius: 14, strokeWidth: 2,
        fill: empty ? '#FAFAFA' : '#F9FAFB', stroke: empty ? '#9CA3AF' : '#3B82F6',
        dash: empty ? [6, 6] : [],
      }));
      group.add(new Konva.Text({
        width: SLOT_WIDTH, height: SLOT_HEIGHT, align: 'center', verticalAlign: 'middle',
        text: empty ? 'DROP GATE' : gate, fontSize: 15, fontStyle: 'bold',
        fill: empty ? '#9CA3AF' : '#1D4ED8',
      }));
      group.on('click tap', () => {
        if (!empty) this.options.onRemoveGate?.(id);
      });
      this.layer.add(group);
    }

    this.layer.batchDraw();
  }

  private drawWire(start: Point, end: Point, signal?: SignalState): void {
    const middle = (start.x + end.x) / 2;
    this.layer.add(new Konva.Line({
      points: [start.x, start.y, middle, start.y, middle, end.y, end.x, end.y],
      stroke: signal === 1 ? '#EAB308' : '#D1D5DB',
      strokeWidth: signal === 1 ? 4 : 3,
      lineJoin: 'round',
      lineCap: 'round',
    }));
  }

  private dropGate(event: DragEvent): void {
    event.preventDefault();
    const gate = event.dataTransfer?.getData('gateType') as GateType | undefined;
    if (!gate) return;
    this.stage.setPointersPositions(event);
    const point = this.stage.getPointerPosition();
    if (!point) return;
    for (const [id, slot] of this.slotPositions) {
      if (point.x >= slot.x && point.x <= slot.x + SLOT_WIDTH
        && point.y >= slot.y && point.y <= slot.y + SLOT_HEIGHT) {
        this.options.onPlaceGate?.(id, gate);
        return;
      }
    }
  }

  destroy(): void {
    this.controls.abort();
    this.stage.destroy();
  }
}
