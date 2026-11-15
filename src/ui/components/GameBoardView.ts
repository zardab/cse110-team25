import Konva from 'konva';
import type { LevelConfig, SignalState, GateType } from '../../types/circuit';

interface GameBoardViewOptions {
  container: HTMLDivElement;
  levelConfig: LevelConfig;
  onPlaceGate?: (slotId: string, gate: GateType) => void;
  onRemoveGate?: (slotId: string) => void;
}

interface Point { x: number; y: number }

const SLOT_WIDTH = 120;
const SLOT_HEIGHT = 64;
const COLUMN_SPACING = 170;
const ROW_SPACING = 90;

export class GameBoardView {
  private readonly stage: Konva.Stage;
  private readonly layer = new Konva.Layer();
  private readonly controls = new AbortController();
  private slotPositions = new Map<string, Point>();

  constructor(private readonly options: GameBoardViewOptions) {
    this.stage = new Konva.Stage({ container: options.container, width: 850, height: 420 });
    this.stage.add(this.layer);
    options.container.addEventListener('dragover', (event) => event.preventDefault(),
      { signal: this.controls.signal });
    options.container.addEventListener('drop', (event) => this.dropGate(event),
      { signal: this.controls.signal });
  }

  render(level: LevelConfig, wireStates: Record<string, SignalState> = {}): void {
    this.layer.destroyChildren();
    this.slotPositions.clear();

    const columns: string[][] = [];
    const depthBySlot = new Map<string, number>();
    for (const id of level.executionOrder) {
      const depth = Math.max(0, ...level.slots[id].inputs.map((source) =>
        source.sourceType === 'SLOT_OUTPUT' ? depthBySlot.get(source.sourceId)! + 1 : 0,
      ));
      depthBySlot.set(id, depth);
      (columns[depth] ??= []).push(id);
    }

    const rows = Math.max(level.primaryInputs.length, level.primaryOutputs.length,
      ...columns.map((column) => column.length));
    const height = Math.max(420, rows * ROW_SPACING);
    const width = Math.max(850, 300 + columns.length * COLUMN_SPACING);
    this.stage.size({ width, height });
    const rowY = (index: number, count: number) => height / 2 + (index - (count - 1) / 2) * ROW_SPACING;

    columns.forEach((column, depth) => {
      column.forEach((id, index) => {
        this.slotPositions.set(id, {
          x: 160 + depth * COLUMN_SPACING,
          y: rowY(index, column.length) - SLOT_HEIGHT / 2,
        });
      });
    });
    const inputs = new Map(level.primaryInputs.map((id, index) =>
      [id, { x: 105, y: rowY(index, level.primaryInputs.length) }],
    ));
    const outputSources = new Map<string, Point>();

    // Draw each connection from the same source IDs the evaluator uses.
    for (const id of level.executionOrder) {
      const slot = level.slots[id];
      const position = this.slotPositions.get(id)!;
      slot.inputs.forEach((source, index) => {
        const end = { x: position.x, y: position.y + SLOT_HEIGHT * (index + 1) / (slot.inputs.length + 1) };
        if (source.sourceType === 'PRIMARY_INPUT') {
          this.drawWire(inputs.get(source.sourceId)!, end, level.inputValues[source.sourceId]);
        } else {
          const wireId = level.slots[source.sourceId].outputWireId;
          this.drawWire(outputSources.get(wireId)!, end, wireStates[wireId]);
        }
      });
      outputSources.set(slot.outputWireId, { x: position.x + SLOT_WIDTH, y: position.y + SLOT_HEIGHT / 2 });
    }
    level.primaryOutputs.forEach((id, index) => {
      const end = { x: width - 134, y: rowY(index, level.primaryOutputs.length) };
      const signal = wireStates[id];
      this.drawWire(outputSources.get(id)!, end, signal);
      const x = end.x + 24;
      const y = end.y;
      const isHigh = signal === 1;
      if (isHigh) this.layer.add(new Konva.Circle({ x, y, radius: 28, fill: '#FEF08A', opacity: 0.6 }));
      this.layer.add(new Konva.Circle({ x, y, radius: 22, fill: isHigh ? '#FACC15' : '#E5E7EB' }));
      this.layer.add(new Konva.Text({ x, y, text: '💡', fontSize: 24, offsetX: 12, offsetY: 12 }));
      this.layer.add(new Konva.Text({
        x: x + 30, y: y - 13, fill: '#4B5563', fontSize: 13,
        text: `${id}: ${signal ?? '—'}\nTarget: ${level.targetOutputs[id]}`,
      }));
    });
    for (const [id, point] of inputs) {
      const value = level.inputValues[id];
      this.layer.add(new Konva.Text({
        x: point.x - 15, y: point.y, text: '⚡', fontSize: 26,
        fill: value ? '#EAB308' : '#9CA3AF', offsetX: 13, offsetY: 13,
      }));
      this.layer.add(new Konva.Text({
        x: 12, y: point.y - 7, fontSize: 14, fill: '#374151', text: `${id}: ${value}`,
      }));
    }
    for (const [id, position] of this.slotPositions) {
      const gate = level.slots[id].assignedGate;
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
