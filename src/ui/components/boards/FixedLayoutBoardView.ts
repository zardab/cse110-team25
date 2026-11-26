import Konva from 'konva';
import type { LevelConfig, SignalState, GateType } from '../../../types/circuit';
import { addGateIcon, addSlotInfoButton, loadGateIcon, loadInfoIcon } from './gateIcons';

export interface Point { x: number; y: number }

export interface BoardLayout {
  width: number;
  height: number;
  /** Visual scale applied to the whole board (hit-testing stays in layout coords). */
  scale?: number;
  slotWidth?: number;
  slotHeight?: number;
  inputs: Record<string, Point>;
  slots: Record<string, Point>;
  /** Bulb/skull anchor per primary output wire id */
  outputs: Record<string, Point>;
}

export interface BoardViewOptions {
  container: HTMLDivElement;
  levelConfig: LevelConfig;
  onPlaceGate?: (slotId: string, gate: GateType) => void;
  onRemoveGate?: (slotId: string) => void;
  onGateInfo?: (gate: GateType) => void;
}

const DEFAULT_SLOT_WIDTH = 120;
const DEFAULT_SLOT_HEIGHT = 64;

/** Shared Konva board that draws a hand-authored fixed layout. */
export class FixedLayoutBoardView {
  private readonly stage: Konva.Stage;
  private readonly layer = new Konva.Layer();
  private readonly controls = new AbortController();
  private slotPositions = new Map<string, Point>();
  private readonly scale: number;
  private readonly slotWidth: number;
  private readonly slotHeight: number;
  private lastRender: { level: LevelConfig; wireStates: Record<string, SignalState> } | null = null;

  constructor(
    private readonly options: BoardViewOptions,
    private readonly layout: BoardLayout,
  ) {
    this.scale = layout.scale ?? 1;
    this.slotWidth = layout.slotWidth ?? DEFAULT_SLOT_WIDTH;
    this.slotHeight = layout.slotHeight ?? DEFAULT_SLOT_HEIGHT;

    this.stage = new Konva.Stage({
      container: options.container,
      width: layout.width * this.scale,
      height: layout.height * this.scale,
    });
    this.layer.scale({ x: this.scale, y: this.scale });
    this.stage.add(this.layer);
    options.container.addEventListener('dragover', (event) => event.preventDefault(),
      { signal: this.controls.signal });
    options.container.addEventListener('drop', (event) => this.dropGate(event),
      { signal: this.controls.signal });
  }

  render(level: LevelConfig, wireStates: Record<string, SignalState> = {}): void {
    this.lastRender = { level, wireStates };
    this.layer.destroyChildren();
    this.slotPositions.clear();

    for (const [id, position] of Object.entries(this.layout.slots)) {
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
          y: position.y + this.slotHeight * (index + 1) / (slot.inputs.length + 1),
        };
        if (source.sourceType === 'PRIMARY_INPUT') {
          const start = this.layout.inputs[source.sourceId];
          if (start) this.drawWire(start, end, level.inputValues[source.sourceId], index);
        } else {
          const wireId = level.slots[source.sourceId].outputWireId;
          const start = outputSources.get(wireId);
          if (start) this.drawWire(start, end, wireStates[wireId], index);
        }
      });

      outputSources.set(slot.outputWireId, {
        x: position.x + this.slotWidth,
        y: position.y + this.slotHeight / 2,
      });
    }

    for (const id of level.primaryOutputs) {
      const start = outputSources.get(id);
      const end = this.layout.outputs[id];
      if (!start || !end) continue;
      const signal = wireStates[id];
      const target = level.targetOutputs[id];
      this.drawWire(start, end, signal);
      const x = end.x + 20;
      const y = end.y;
      const met = signal === target;
      const icon = target === 0 ? '💀' : '💡';
      const active = met ? (target === 0 ? '#A1A1AA' : '#FACC15') : '#3F3F46';
      const glow = met ? (target === 0 ? '#D4D4D8' : '#FEF08A') : null;
      const iconSize = Math.round(22 * (this.slotWidth / DEFAULT_SLOT_WIDTH));
      if (glow) this.layer.add(new Konva.Circle({ x, y, radius: 24, fill: glow, opacity: 0.6 }));
      this.layer.add(new Konva.Circle({ x, y, radius: 18, fill: active }));
      this.layer.add(new Konva.Text({
        x: x - 18, y: y - 18,
        width: 36, height: 36,
        text: icon, fontSize: iconSize,
        align: 'center', verticalAlign: 'middle',
      }));
    }

    for (const [id, point] of Object.entries(this.layout.inputs)) {
      const value = level.inputValues[id];
      const iconSize = Math.round(22 * (this.slotWidth / DEFAULT_SLOT_WIDTH));
      this.layer.add(new Konva.Text({
        x: point.x - 12, y: point.y, text: '⚡', fontSize: iconSize,
        fill: value ? '#EAB308' : '#9CA3AF', offsetX: iconSize / 2, offsetY: iconSize / 2,
      }));
    }

    const fontSize = Math.round(14 * (this.slotWidth / DEFAULT_SLOT_WIDTH));
    const pendingIcons: string[] = [];
    let needsInfoIcon = false;
    for (const [id, position] of this.slotPositions) {
      const gate = level.slots[id]?.assignedGate;
      if (gate === undefined) continue;
      const empty = gate === 'NULL';
      const group = new Konva.Group(position);
      group.add(new Konva.Rect({
        width: this.slotWidth, height: this.slotHeight, cornerRadius: 12, strokeWidth: 2,
        fill: empty ? '#27272A' : '#1F2937', stroke: empty ? '#52525B' : '#3B82F6',
        dash: empty ? [6, 6] : [],
      }));
      if (empty) {
        group.add(new Konva.Text({
          width: this.slotWidth, height: this.slotHeight, align: 'center', verticalAlign: 'middle',
          text: 'DROP GATE', fontSize, fontStyle: 'bold', fill: '#A1A1AA',
        }));
      } else {
        if (!addGateIcon(group, gate, this.slotWidth, this.slotHeight)) {
          pendingIcons.push(gate);
        }
        if (!addSlotInfoButton(group, this.slotWidth, () => this.options.onGateInfo?.(gate))) {
          needsInfoIcon = true;
        }
      }
      group.on('click tap', () => {
        if (!empty) this.options.onRemoveGate?.(id);
      });
      this.layer.add(group);
    }

    this.layer.batchDraw();

    const pending = [
      ...[...new Set(pendingIcons)].map(loadGateIcon),
      ...(needsInfoIcon ? [loadInfoIcon()] : []),
    ];
    if (pending.length > 0) {
      void Promise.all(pending).then(() => {
        if (!this.lastRender) return;
        this.render(this.lastRender.level, this.lastRender.wireStates);
      });
    }
  }

  private drawWire(start: Point, end: Point, signal?: SignalState, lane = 0): void {
    const dx = end.x - start.x;
    // Long runs bend near the destination so the vertical segment clears earlier gates.
    // Short runs / bulb stubs keep a mid elbow, staggered by input lane.
    const t = Math.abs(dx) > 180
      ? Math.min(0.88, 0.7 + lane * 0.06)
      : Math.min(0.7, 0.42 + lane * 0.14);
    const middle = start.x + dx * t;
    this.layer.add(new Konva.Line({
      points: [start.x, start.y, middle, start.y, middle, end.y, end.x, end.y],
      stroke: signal === 1 ? '#EAB308' : '#52525B',
      strokeWidth: signal === 1 ? 3.5 : 2.5,
      lineJoin: 'round',
      lineCap: 'round',
    }));
  }

  private dropGate(event: DragEvent): void {
    event.preventDefault();
    const gate = event.dataTransfer?.getData('gateType') as GateType | undefined;
    if (!gate) return;
    this.stage.setPointersPositions(event);
    const point = this.layer.getRelativePointerPosition();
    if (!point) return;
    for (const [id, slot] of this.slotPositions) {
      if (point.x >= slot.x && point.x <= slot.x + this.slotWidth
        && point.y >= slot.y && point.y <= slot.y + this.slotHeight) {
        this.options.onPlaceGate?.(id, gate);
        return;
      }
    }
  }

  destroy(): void {
    this.lastRender = null;
    this.controls.abort();
    this.stage.destroy();
  }
}
