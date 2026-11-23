import Konva from 'konva';
import type { FaultLevel } from '../content/faultLevelLoader';
import type { View } from '../screenTypes';
import type { FaultMap, StuckAt } from '../types/circuit';
import type { Bit, Bits, TestRecord } from './faultFinder';
import { layoutCircuit, type Point } from './faultLayout';

export type MessageTone = 'info' | 'hint' | 'good' | 'bad';

/** Everything the screen shows. The controller builds it; the view only draws it. */
export interface FaultFinderViewModel {
  readonly level: FaultLevel;
  readonly levelIndex: number;
  readonly levelCount: number;
  /** The switches as the player has them. */
  readonly inputs: Bits;
  /** Every wire's value on a healthy board for these inputs. */
  readonly expected: Bits;
  /** The test that used these inputs, if one has run, so the circuit can show real readings. */
  readonly current: TestRecord | null;
  readonly tests: readonly TestRecord[];
  readonly probes: readonly string[];
  readonly diagnosis: FaultMap;
  /** The real faults once the round is over, or null while playing. */
  readonly revealed: FaultMap | null;
  readonly testsLeft: number;
  readonly probesLeft: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly suspects: number;
  /** Fewest tests this level has been solved in before, or null. */
  readonly best: number | null;
  readonly message: string;
  readonly tone: MessageTone;
  readonly playing: boolean;
  /** The button under the message: none while a round is in play. */
  readonly action: 'next' | 'restart' | null;
}

export interface FaultFinderHandlers {
  readonly onToggleInput: (inputId: string) => void;
  readonly onAttachProbe: (slotId: string) => void;
  readonly onMarkGate: (slotId: string) => void;
  readonly onRunTest: () => void;
  readonly onSubmit: () => void;
  readonly onSelectTest: (index: number) => void;
  readonly onSelectLevel: (index: number) => void;
  readonly onAction: () => void;
  readonly onBack: () => void;
}

// Everything is laid out on a 960 × 600 board, then scaled to fit the screen.
const BOARD = { width: 960, height: 600 };
const FONT = 'Courier New, monospace';

const COLOR = {
  background: '#0B1020',
  card: '#F9FAFB',
  cardStroke: '#CBD5E1',
  panel: '#111827',
  panelStroke: '#374151',
  text: '#F9FAFB',
  dim: '#9CA3AF',
  ink: '#1F2937',
  wireOff: '#CBD5E1',
  wireOn: '#EAB308',
  bulbOn: '#FACC15',
  bulbOff: '#E5E7EB',
  gate: '#EFF6FF',
  gateStroke: '#1D4ED8',
  probe: '#7C3AED',
  fault: '#DC2626',
  faultFill: '#FEE2E2',
  good: '#16A34A',
  goodFill: '#DCFCE7',
  missed: '#EA580C',
  button: '#DC2626',
  buttonUsed: '#374151',
  heart: '#F87171',
};

const TONE: Record<MessageTone, string> = {
  info: COLOR.text,
  hint: '#FBBF24',
  good: '#4ADE80',
  bad: '#F87171',
};

const CARD = { x: 40, y: 96, width: 580, height: 300 };
const LOG = { x: 640, y: 96, width: 280, height: 300 };
const GATE = { width: 72, height: 44 };
const PIN_GAP = 11;
const PROBE_OFFSET = 24;

/**
 * FaultFinderView - Draws the "Fault Finder" minigame: the circuit under test with its
 * switches, gates, probe pads and bulbs, the log of tests run, and the controls.
 */
export class FaultFinderView implements View {
  private readonly group = new Konva.Group({ visible: false });
  private readonly board = new Konva.Group();

  constructor(width: number, height: number, private readonly handlers: FaultFinderHandlers) {
    this.group.add(new Konva.Rect({ width, height, fill: COLOR.background }));
    const margin = 16;
    const scale = Math.min((width - margin * 2) / BOARD.width, (height - margin * 2) / BOARD.height, 1.5);
    this.board.scale({ x: scale, y: scale });
    this.board.position({ x: (width - BOARD.width * scale) / 2, y: (height - BOARD.height * scale) / 2 });
    this.group.add(this.board);
  }

  render(model: FaultFinderViewModel): void {
    // The node under the pointer may be replaced without a mouseleave, so reset the cursor.
    this.setCursor('default');
    this.board.destroyChildren();
    this.drawHeader(model);
    this.drawCircuit(model);
    this.drawLog(model);
    this.board.add(new Konva.Text({
      name: 'message', x: 40, y: 406, width: BOARD.width - 80, align: 'center',
      text: model.message, fontSize: 17, fontFamily: FONT, fill: TONE[model.tone], lineHeight: 1.3,
    }));
    this.drawControls(model);
    this.group.getLayer()?.batchDraw();
  }

  private drawHeader(model: FaultFinderViewModel): void {
    this.board.add(this.button({
      name: 'back-button', x: 0, y: 0, width: 110, height: 38, label: '← BACK',
      onClick: this.handlers.onBack, fill: 'transparent', stroke: COLOR.dim,
    }));
    // The title spans the full board and overlaps the buttons, so it must not take pointer events.
    this.board.add(new Konva.Text({
      x: 0, y: 8, width: BOARD.width, align: 'center', text: 'FAULT FINDER',
      fontSize: 34, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text, listening: false,
    }));
    this.board.add(new Konva.Text({
      name: 'level-title', x: 0, y: 50, width: BOARD.width, align: 'center', fontSize: 15, fontFamily: FONT,
      fill: COLOR.dim, listening: false,
      text: `LEVEL ${model.levelIndex + 1}: ${model.level.title.toUpperCase()}`,
    }));

    // Level strip: one small square per level, the current one lit.
    const size = 30;
    const gap = 6;
    const stripX = BOARD.width - model.levelCount * (size + gap) + gap;
    for (let index = 0; index < model.levelCount; index += 1) {
      const current = index === model.levelIndex;
      this.board.add(this.button({
        name: `level-button-${index}`, x: stripX + index * (size + gap), y: 4, width: size, height: size,
        label: String(index + 1), fontSize: 14,
        fill: current ? COLOR.wireOn : 'transparent', stroke: current ? undefined : COLOR.panelStroke,
        textColor: current ? 'black' : COLOR.dim,
        onClick: current ? undefined : () => this.handlers.onSelectLevel(index),
      }));
    }

    const hearts = '♥'.repeat(model.lives) + '♡'.repeat(Math.max(0, model.maxLives - model.lives));
    const best = model.best === null ? '' : `   BEST ${model.best}`;
    this.board.add(new Konva.Text({
      name: 'status', x: BOARD.width - 480, y: 46, width: 380, align: 'right', fontFamily: FONT, fontSize: 14,
      text: `TESTS ${model.testsLeft}   PROBES ${model.probesLeft}${best}`, fill: COLOR.dim, listening: false,
    }));
    this.board.add(new Konva.Text({
      name: 'lives', x: BOARD.width - 90, y: 42, width: 90, align: 'right', text: hearts, fontSize: 20,
      fill: COLOR.heart, listening: false,
    }));
  }

  private drawCircuit(model: FaultFinderViewModel): void {
    const { level, expected, current, probes, diagnosis, revealed } = model;
    const card = new Konva.Group({ x: CARD.x, y: CARD.y });
    card.add(new Konva.Rect({
      width: CARD.width, height: CARD.height, cornerRadius: 16, fill: COLOR.card, stroke: COLOR.cardStroke, strokeWidth: 2,
    }));
    card.add(new Konva.Text({
      x: 20, y: 12, fontSize: 13, fontFamily: FONT, fill: COLOR.dim, listening: false,
      text: current ? 'SHOWING MEASURED VALUES' : 'SHOWING DESIGN VALUES (NOT TESTED YET)',
    }));

    const layout = layoutCircuit(level, { left: 70, right: 520, top: 40, bottom: 240 });
    const gateIndex = new Map(level.executionOrder.map((slotId, index) => [slotId, index]));
    const outputOf = (slotId: string): Point => {
      const { x, y } = layout.gates[slotId];
      return { x: x + GATE.width / 2, y };
    };
    const sourcePoint = (source: { sourceType: string; sourceId: string }): Point =>
      source.sourceType === 'PRIMARY_INPUT'
        ? { x: layout.inputs[source.sourceId].x + 28, y: layout.inputs[source.sourceId].y }
        : { x: outputOf(source.sourceId).x + PROBE_OFFSET + 10, y: outputOf(source.sourceId).y };
    const sourceValue = (source: { sourceType: string; sourceId: string }): Bit =>
      source.sourceType === 'PRIMARY_INPUT'
        ? expected[source.sourceId]
        : expected[level.slots[source.sourceId].outputWireId];

    // Wires first, so gates and switches sit on top of them.
    let wireIndex = 0;
    for (const slotId of level.executionOrder) {
      const slot = level.slots[slotId];
      const { x, y } = layout.gates[slotId];
      const pins = slot.inputs.length === 1 ? [y] : [y - PIN_GAP, y + PIN_GAP];
      slot.inputs.forEach((source, pin) => {
        const from = sourcePoint(source);
        const to = { x: x - GATE.width / 2, y: pins[pin] };
        card.add(wire(route(from, to, wireIndex), sourceValue(source)));
        wireIndex += 1;
      });
    }
    for (const outputId of level.primaryOutputs) {
      const producer = Object.values(level.slots).find((slot) => slot.outputWireId === outputId)!;
      const from = sourcePoint({ sourceType: 'SLOT_OUTPUT', sourceId: producer.id });
      const bulb = layout.outputs[outputId];
      card.add(wire(route(from, { x: bulb.x - 18, y: bulb.y }, wireIndex), expected[outputId]));
      wireIndex += 1;
    }
    for (const slotId of level.executionOrder) {
      const out = outputOf(slotId);
      card.add(wire([out.x, out.y, out.x + PROBE_OFFSET + 10, out.y], expected[level.slots[slotId].outputWireId]));
    }

    for (const inputId of level.primaryInputs) {
      card.add(this.drawSwitch(inputId, layout.inputs[inputId], model.inputs[inputId], model.playing));
    }
    for (const slotId of level.executionOrder) {
      const label = `G${gateIndex.get(slotId)! + 1}`;
      card.add(this.drawGate(slotId, label, level, layout.gates[slotId], diagnosis, revealed, model.playing));
      card.add(this.drawProbePad(slotId, label, outputOf(slotId), model, probes.includes(slotId)));
    }
    for (const outputId of level.primaryOutputs) {
      card.add(this.drawBulb(outputId, layout.outputs[outputId], expected[outputId], current?.actual[outputId] ?? null));
    }

    card.add(new Konva.Text({
      x: 20, y: CARD.height - 30, width: CARD.width - 40, fontSize: 12, fontFamily: FONT, fill: COLOR.dim,
      listening: false, align: 'center',
      text: 'Click a switch to set it · click a gate to mark it STUCK 0 / STUCK 1 · click a ◌ pad to attach a probe',
    }));
    this.board.add(card);
  }

  private drawSwitch(inputId: string, at: Point, value: Bit, playing: boolean): Konva.Group {
    const group = new Konva.Group({ name: `switch-${inputId}`, x: at.x - 60, y: at.y - 13 });
    group.add(new Konva.Text({
      x: 0, y: 4, width: 28, text: inputId, fontSize: 18, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
    }));
    group.add(new Konva.Rect({
      x: 34, y: 0, width: 54, height: 26, cornerRadius: 13,
      fill: value ? COLOR.wireOn : COLOR.wireOff, stroke: COLOR.cardStroke, strokeWidth: 1,
    }));
    group.add(new Konva.Circle({ x: value ? 75 : 47, y: 13, radius: 10, fill: COLOR.card, stroke: COLOR.ink, strokeWidth: 1 }));
    group.add(new Konva.Text({
      x: 34, y: 5, width: 54, align: 'center', text: value ? '1   ' : '   0', fontSize: 14, fontStyle: 'bold',
      fontFamily: FONT, fill: COLOR.ink,
    }));
    group.setAttr('value', value);
    if (playing) onPress(group, () => this.handlers.onToggleInput(inputId));
    return group;
  }

  private drawGate(
    slotId: string, label: string, level: FaultLevel, at: Point,
    diagnosis: FaultMap, revealed: FaultMap | null, playing: boolean,
  ): Konva.Group {
    const group = new Konva.Group({ name: `gate-${slotId}`, x: at.x - GATE.width / 2, y: at.y - GATE.height / 2 });
    const mark: StuckAt | undefined = diagnosis[slotId];
    const truth: StuckAt | undefined = revealed?.[slotId];
    // While playing, a mark is red. Once revealed, real faults are green and a wrong mark is orange.
    let stroke = COLOR.gateStroke;
    let fill = COLOR.gate;
    let badge: string | null = null;
    let badgeColor = COLOR.fault;
    if (revealed) {
      if (truth !== undefined) {
        stroke = COLOR.good; fill = COLOR.goodFill; badge = `STUCK ${truth}`; badgeColor = COLOR.good;
      } else if (mark !== undefined) {
        stroke = COLOR.missed; badge = 'OK'; badgeColor = COLOR.missed;
      }
    } else if (mark !== undefined) {
      stroke = COLOR.fault; fill = COLOR.faultFill; badge = `STUCK ${mark}`;
    }
    group.add(new Konva.Rect({
      width: GATE.width, height: GATE.height, cornerRadius: 8, fill, stroke, strokeWidth: 2.5,
    }));
    group.add(new Konva.Text({
      width: GATE.width, height: GATE.height - 10, align: 'center', verticalAlign: 'middle',
      text: level.slots[slotId].assignedGate, fontSize: 17, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
    }));
    group.add(new Konva.Text({
      x: 0, y: GATE.height - 14, width: GATE.width, align: 'center', text: label, fontSize: 10, fontFamily: FONT, fill: COLOR.dim,
    }));
    if (badge) {
      group.add(new Konva.Rect({ x: -6, y: -14, width: GATE.width + 12, height: 18, cornerRadius: 9, fill: badgeColor }));
      group.add(new Konva.Text({
        name: 'badge', x: -6, y: -12, width: GATE.width + 12, align: 'center', text: badge, fontSize: 11,
        fontStyle: 'bold', fontFamily: FONT, fill: 'white',
      }));
    }
    group.setAttr('mark', mark ?? null);
    if (playing) onPress(group, () => this.handlers.onMarkGate(slotId));
    return group;
  }

  private drawProbePad(slotId: string, label: string, out: Point, model: FaultFinderViewModel, attached: boolean): Konva.Group {
    const group = new Konva.Group({ name: `probe-${slotId}`, x: out.x + PROBE_OFFSET, y: out.y });
    const expected = model.expected[model.level.slots[slotId].outputWireId];
    const reading = model.current?.readings[slotId];
    if (attached) {
      group.add(new Konva.Circle({ radius: 8, fill: COLOR.probe, stroke: 'white', strokeWidth: 2 }));
      const measured = reading !== undefined;
      const wrong = measured && reading !== expected;
      group.add(new Konva.Text({
        name: 'reading', x: -30, y: -30, width: 60, align: 'center', fontFamily: FONT, fontStyle: 'bold',
        fontSize: 13, fill: wrong ? COLOR.fault : COLOR.probe,
        text: measured ? `${label}=${reading}${wrong ? ' ✗' : ''}` : `${label}=?`,
      }));
    } else if (model.playing && model.probesLeft > 0) {
      group.add(new Konva.Circle({ radius: 8, fill: 'white', stroke: COLOR.probe, strokeWidth: 2, dash: [3, 3] }));
      onPress(group, () => this.handlers.onAttachProbe(slotId));
    }
    group.setAttr('attached', attached);
    return group;
  }

  private drawBulb(outputId: string, at: Point, expected: Bit, actual: Bit | null): Konva.Group {
    const group = new Konva.Group({ name: `bulb-${outputId}`, x: at.x, y: at.y });
    const shown = actual ?? expected;
    const wrong = actual !== null && actual !== expected;
    if (shown) group.add(new Konva.Circle({ radius: 24, fill: '#FEF08A', opacity: 0.6 }));
    group.add(new Konva.Circle({
      radius: 17, fill: shown ? COLOR.bulbOn : COLOR.bulbOff,
      stroke: wrong ? COLOR.fault : actual === null ? COLOR.cardStroke : COLOR.ink,
      strokeWidth: wrong ? 3 : 1.5, dash: actual === null ? [4, 3] : [],
    }));
    group.add(new Konva.Text({ text: '💡', fontSize: 18, offsetX: 9, offsetY: 9 }));
    group.add(new Konva.Text({
      name: 'bulb-label', x: -60, y: 24, width: 120, align: 'center', fontFamily: FONT, fontStyle: 'bold', fontSize: 12,
      fill: wrong ? COLOR.fault : COLOR.ink,
      text: actual === null ? `${outputId} should be ${expected}` : wrong ? `${outputId}=${actual} ✗ want ${expected}` : `${outputId}=${actual} ✓`,
    }));
    group.setAttr('actual', actual);
    return group;
  }

  private drawLog(model: FaultFinderViewModel): void {
    const { level, tests, current } = model;
    const panel = new Konva.Group({ x: LOG.x, y: LOG.y });
    panel.add(new Konva.Rect({
      width: LOG.width, height: LOG.height, cornerRadius: 16, fill: COLOR.panel, stroke: COLOR.panelStroke, strokeWidth: 2,
    }));
    panel.add(new Konva.Text({
      x: 20, y: 16, text: 'TEST LOG', fontSize: 16, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text,
    }));
    panel.add(new Konva.Text({
      x: 20, y: 40, text: `#   ${level.primaryInputs.join('')}   ${level.primaryOutputs.join(' ')}   PROBES`,
      fontSize: 12, fontFamily: FONT, fill: COLOR.dim,
    }));

    const gateIndex = new Map(level.executionOrder.map((slotId, index) => [slotId, index]));
    tests.forEach((test, index) => {
      const selected = test === current;
      const row = new Konva.Group({ name: `test-row-${index}`, x: 10, y: 60 + index * 30 });
      row.add(new Konva.Rect({
        width: LOG.width - 20, height: 26, cornerRadius: 6,
        fill: selected ? '#1E293B' : 'transparent', stroke: selected ? COLOR.wireOn : 'transparent',
      }));
      const inputs = level.primaryInputs.map((id) => test.inputs[id]).join('');
      row.add(new Konva.Text({
        x: 10, y: 6, text: `${index + 1}   ${inputs}   `, fontSize: 13, fontFamily: FONT, fill: COLOR.text,
      }));
      // Each output is its own text so a mismatch can be coloured on its own.
      let x = 10 + (4 + inputs.length + 3) * 7.8;
      for (const outputId of level.primaryOutputs) {
        const wrong = test.actual[outputId] !== test.expected[outputId];
        row.add(new Konva.Text({
          x, y: 6, text: `${test.actual[outputId]}${wrong ? '!' : ' '}`, fontSize: 13, fontFamily: FONT, fontStyle: 'bold',
          fill: wrong ? COLOR.heart : COLOR.text,
        }));
        x += (outputId.length + 1) * 7.8;
      }
      const readings = Object.entries(test.readings)
        .map(([slotId, value]) => `G${gateIndex.get(slotId)! + 1}=${value}`).join(' ');
      row.add(new Konva.Text({
        x: x + 16, y: 6, text: readings, fontSize: 13, fontFamily: FONT, fill: '#C4B5FD',
      }));
      onPress(row, () => this.handlers.onSelectTest(index));
      panel.add(row);
    });

    if (tests.length === 0) {
      panel.add(new Konva.Text({
        x: 20, y: 70, width: LOG.width - 40, fontSize: 13, fontFamily: FONT, fill: COLOR.dim, lineHeight: 1.4,
        text: 'No tests yet. Set the switches and press RUN TEST. A ! marks an output that differs from the design.',
      }));
    }
    panel.add(new Konva.Text({
      name: 'suspects', x: 20, y: LOG.height - 30, width: LOG.width - 40, fontSize: 13, fontFamily: FONT,
      fontStyle: 'bold', fill: model.suspects === 1 ? TONE.good : COLOR.wireOn,
      text: `SUSPECTS LEFT: ${model.suspects}`,
    }));
    this.board.add(panel);
  }

  private drawControls(model: FaultFinderViewModel): void {
    const y = 470;
    const canRun = model.playing && model.testsLeft > 0;
    this.board.add(this.button({
      name: 'run-button', x: 40, y, width: 260, height: 48, fontSize: 18,
      label: model.testsLeft > 0 ? `RUN TEST (${model.testsLeft} left)` : 'NO TESTS LEFT',
      fill: canRun ? COLOR.wireOn : COLOR.buttonUsed, textColor: canRun ? 'black' : COLOR.dim,
      onClick: canRun ? this.handlers.onRunTest : undefined,
    }));
    const marks = Object.keys(model.diagnosis).length;
    const canSubmit = model.playing && marks > 0;
    this.board.add(this.button({
      name: 'submit-button', x: 320, y, width: 300, height: 48, fontSize: 18,
      label: `SUBMIT DIAGNOSIS (${marks} marked)`,
      fill: canSubmit ? COLOR.button : COLOR.buttonUsed, textColor: canSubmit ? 'black' : COLOR.dim,
      onClick: canSubmit ? this.handlers.onSubmit : undefined,
    }));
    const needed = Object.keys(model.level.faults).length;
    this.board.add(new Konva.Text({
      x: 640, y: y + 6, width: 280, fontSize: 13, fontFamily: FONT, fill: COLOR.dim, lineHeight: 1.3, listening: false,
      text: `${needed} gate${needed === 1 ? ' is' : 's are'} stuck.\nMark exactly ${needed}, then submit.`,
    }));
    if (model.action) {
      this.board.add(this.button({
        name: 'action-button', x: (BOARD.width - 260) / 2, y: 536, width: 260, height: 46,
        label: model.action === 'next' ? 'NEXT BOARD →' : 'TRY AGAIN', onClick: this.handlers.onAction,
      }));
    }
  }

  private button(options: {
    name: string; x: number; y: number; width: number; height: number; label: string;
    onClick?: () => void; fill?: string; stroke?: string; textColor?: string; fontSize?: number;
  }): Konva.Group {
    const { name, x, y, width, height, label, onClick } = options;
    const group = new Konva.Group({ name, x, y });
    group.add(new Konva.Rect({
      width, height, fill: options.fill ?? COLOR.button,
      stroke: options.stroke, strokeWidth: options.stroke ? 2 : 0,
    }));
    group.add(new Konva.Text({
      width, height, text: label, align: 'center', verticalAlign: 'middle', fontFamily: FONT, fontStyle: 'bold',
      fontSize: options.fontSize ?? 16, fill: options.textColor ?? (options.fill === 'transparent' ? COLOR.text : 'black'),
    }));
    group.setAttr('enabled', Boolean(onClick));
    if (onClick) onPress(group, onClick);
    return group;
  }

  show(): void {
    this.group.visible(true);
    this.group.getLayer()?.batchDraw();
  }

  hide(): void {
    this.group.visible(false);
    this.setCursor('default');
    this.group.getLayer()?.batchDraw();
  }

  getGroup(): Konva.Group {
    return this.group;
  }

  private setCursor(cursor: string): void {
    const container = this.group.getStage()?.container();
    if (container) container.style.cursor = cursor;
  }
}

/** An orthogonal path from `from` to `to`; the bend shifts a little per wire so parallel runs don't overlap. */
function route(from: Point, to: Point, index: number): number[] {
  const bend = from.x + (to.x - from.x) * (0.35 + 0.1 * (index % 4));
  return [from.x, from.y, bend, from.y, bend, to.y, to.x, to.y];
}

function wire(points: number[], value: Bit): Konva.Line {
  return new Konva.Line({
    points, stroke: value ? COLOR.wireOn : COLOR.wireOff, strokeWidth: value ? 4 : 3, lineCap: 'round', lineJoin: 'round',
    listening: false,
  });
}

/** Clicks and taps call `action`; the pointer becomes a hand while over the node. */
function onPress(node: Konva.Group, action: () => void): void {
  node.on('click tap', action);
  node.on('mouseenter', () => {
    const container = node.getStage()?.container();
    if (container) container.style.cursor = 'pointer';
  });
  node.on('mouseleave', () => {
    const container = node.getStage()?.container();
    if (container) container.style.cursor = 'default';
  });
}
