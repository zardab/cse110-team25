// src/ui/components/GameBoardView.ts
import Konva from 'konva';
import { LevelConfig, SignalState, AssignedGates, GateType } from '../../types/circuit';

interface GameBoardViewOptions {
  container: HTMLDivElement;
  levelConfig: LevelConfig;
  onPlaceGate?: (slotId: string, gate: GateType) => void;
  onRemoveGate?: (slotId: string) => void;
}

const CANVAS_WIDTH = 850;
const CANVAS_HEIGHT = 420;

export class GameBoardView {
  private stage: Konva.Stage;
  private layer: Konva.Layer;
  private container: HTMLDivElement;
  private onPlaceGate?: (slotId: string, gate: GateType) => void;
  private onRemoveGate?: (slotId: string) => void;

  // Layout Positions
  private inAPos = { x: 200, y: 150 };
  private inBPos = { x: 200, y: 270 };
  private slotPos = { x: 380, y: 160, width: 120, height: 80 };
  private outputPos = { x: 700, y: 200 };

  constructor(options: GameBoardViewOptions) {
    this.container = options.container;
    this.onPlaceGate = options.onPlaceGate;
    this.onRemoveGate = options.onRemoveGate;

    // 1. Initialize Stage and Main Layer
    this.stage = new Konva.Stage({
      container: this.container,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });

    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    // 2. Set up HTML Drag-and-Drop listener
    this.setupContainerDragDrop();
  }

  // --- Render Method ---
  public render(assignedGates: AssignedGates, wireStates: Record<string, SignalState> = {}) {
    // Clear previous shapes for clean redrawing
    this.layer.destroyChildren();

    const isHighA = wireStates['in_A'] === 1;
    const isHighB = wireStates['in_B'] === 1;
    const outputSignal = wireStates['out_Y'] === 1;
    const currentGate = assignedGates['slot_1'];

    // Pin Anchor Coordinates
    const slotPin0 = { x: this.slotPos.x, y: this.slotPos.y + 25 };
    const slotPin1 = { x: this.slotPos.x, y: this.slotPos.y + 55 };
    const slotOutPin = { x: this.slotPos.x + this.slotPos.width, y: this.slotPos.y + 40 };

    // 1. Background Board Card
    const background = new Konva.Rect({
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fill: '#FFFFFF',
      cornerRadius: 20,
    });
    this.layer.add(background);

    // 2. Wires (Miro-style Orthogonal Lines)
    this.layer.add(this.createOrthogonalWire(this.inAPos.x + 15, this.inAPos.y, slotPin0.x, slotPin0.y, isHighA));
    this.layer.add(this.createOrthogonalWire(this.inBPos.x + 15, this.inBPos.y, slotPin1.x, slotPin1.y, isHighB));
    this.layer.add(this.createOrthogonalWire(slotOutPin.x, slotOutPin.y, this.outputPos.x - 24, this.outputPos.y, outputSignal));

    // 3. Input Anchors
    this.layer.add(this.createInputGroup(this.inAPos.x, this.inAPos.y, '1 (HIGH)', isHighA));
    this.layer.add(this.createInputGroup(this.inBPos.x, this.inBPos.y, '0 (LOW)', isHighB));

    // 4. Slot Drop Socket
    this.layer.add(this.createSlotGroup(currentGate));

    // 5. Output Lightbulb
    this.layer.add(this.createOutputBulbGroup(outputSignal));

    // Draw layer
    this.layer.batchDraw();
  }

  private createOrthogonalWire(startX: number, startY: number, endX: number, endY: number, isHigh: boolean): Konva.Line {
    const midX = startX + (endX - startX) / 2;
    return new Konva.Line({
      points: [startX, startY, midX, startY, midX, endY, endX, endY],
      stroke: isHigh ? '#EAB308' : '#D1D5DB',
      strokeWidth: isHigh ? 4 : 3,
      cornerRadius: 12,
      lineCap: 'round',
      lineJoin: 'round',
    });
  }

  private createInputGroup(x: number, y: number, label: string, isHigh: boolean): Konva.Group {
    const group = new Konva.Group({ x, y });

    const bolt = new Konva.Text({
      text: '⚡',
      fontSize: 26,
      fill: isHigh ? '#EAB308' : '#9CA3AF',
      offsetX: 13,
      offsetY: 13,
    });

    const textLabel = new Konva.Text({
      text: label,
      x: -80,
      y: -6,
      fontSize: 12,
      fontStyle: 'bold',
      fill: isHigh ? '#CA8A04' : '#6B7280',
    });

    group.add(bolt, textLabel);
    return group;
  }

  private createSlotGroup(currentGate: GateType | null): Konva.Group {
    const group = new Konva.Group({
      x: this.slotPos.x,
      y: this.slotPos.y,
    });

    const rect = new Konva.Rect({
      width: this.slotPos.width,
      height: this.slotPos.height,
      fill: currentGate ? '#F9FAFB' : '#FAFAFA',
      stroke: currentGate ? '#3B82F6' : '#9CA3AF',
      strokeWidth: 2,
      dash: currentGate ? [] : [6, 6],
      cornerRadius: 14,
    });

    const label = new Konva.Text({
      text: currentGate ? currentGate : 'DROP GATE',
      x: 0,
      y: 32,
      width: this.slotPos.width,
      align: 'center',
      fontSize: 15,
      fontStyle: 'bold',
      fill: currentGate ? '#1D4ED8' : '#9CA3AF',
    });

    group.add(rect, label);

    group.on('click tap', () => {
      if (currentGate && this.onRemoveGate) {
        this.onRemoveGate('slot_1');
      }
    });

    return group;
  }

  private createOutputBulbGroup(isGlowing: boolean): Konva.Group {
    const group = new Konva.Group({ x: this.outputPos.x, y: this.outputPos.y });

    if (isGlowing) {
      const glow = new Konva.Circle({
        radius: 28,
        fill: '#FEF08A',
        opacity: 0.6,
      });
      group.add(glow);
    }

    const circle = new Konva.Circle({
      radius: 22,
      fill: isGlowing ? '#FACC15' : '#E5E7EB',
      stroke: isGlowing ? '#EAB308' : '#9CA3AF',
      strokeWidth: 2,
    });

    const bulbIcon = new Konva.Text({
      text: '💡',
      fontSize: 24,
      offsetX: 12,
      offsetY: 12,
    });

    group.add(circle, bulbIcon);
    return group;
  }

  private setupContainerDragDrop() {
    this.container.addEventListener('dragover', (e) => e.preventDefault());

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;

      const isInsideSlot =
        dropX >= this.slotPos.x &&
        dropX <= this.slotPos.x + this.slotPos.width &&
        dropY >= this.slotPos.y &&
        dropY <= this.slotPos.y + this.slotPos.height;

      if (isInsideSlot && this.onPlaceGate) {
        const gate = e.dataTransfer?.getData('gateType') as GateType;
        if (gate) {
          this.onPlaceGate('slot_1', gate);
        }
      }
    });
  }

  public destroy() {
    this.stage.destroy();
  }
}