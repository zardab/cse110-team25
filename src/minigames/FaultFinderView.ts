import Konva from 'konva';
import type { FaultLevel } from '../content/faultLevelLoader';
import type { View } from '../screenTypes';
import type { Fault, FaultMap } from '../types/circuit';
import { addGateIcon, loadGateIcon } from '../ui/components/boards/gateIcons';
import type { Bit, Bits, TestRecord } from './faultFinder';
import type { TutorialPrompt, TutorialTarget } from './faultTutorial';
import { layoutCircuit, type Point } from './faultLayout';

export type MessageTone = 'info' | 'hint' | 'good' | 'bad';

/** Everything the screen shows. The controller builds it; the view only draws it. */
export interface FaultFinderViewModel {
  readonly level: FaultLevel;
  /** The badge in the board's top-left corner, e.g. "Level 2 / 5". */
  readonly levelLabel: string;
  /** The walkthrough callout on the practice board, or null in a real level. */
  readonly tutorial: TutorialPrompt | null;
  readonly levelIndex: number;
  readonly levelCount: number;
  /** The switches as the player has them. */
  readonly inputs: Bits;
  /** The test that used these inputs, if one has run. Only its measurements light the board. */
  readonly current: TestRecord | null;
  /** How many gates are faulty on this level. */
  readonly faultCount: number;
  /** Slots the player has marked as faulty. */
  readonly diagnosis: readonly string[];
  /** The real faults once the round is over, or null while playing. */
  readonly revealed: FaultMap | null;
  readonly testsLeft: number;
  readonly lives: number;
  readonly maxLives: number;
  readonly message: string;
  readonly tone: MessageTone;
  readonly playing: boolean;
  /** The button under the message: none while a round is in play. */
  /** 'finish' after the last level: back to the level list instead of another board. */
  readonly action: 'next' | 'restart' | 'finish' | null;
}

/** One level's card on the level-select screen. */
export interface FaultFinderLevelCard {
  readonly title: string;
  readonly faultCount: number;
  readonly completed: boolean;
}

export interface FaultFinderSelectModel {
  readonly levels: readonly FaultFinderLevelCard[];
}

export interface FaultFinderHandlers {
  readonly onToggleInput: (inputId: string) => void;
  readonly onMarkGate: (slotId: string) => void;
  readonly onRunTest: () => void;
  readonly onSubmit: () => void;
  /** Opens a level, from a level card or a dot in the top bar. */
  readonly onSelectLevel: (index: number) => void;
  readonly onAction: () => void;
  readonly onBack: () => void;
  readonly onHowToPlay: () => void;
  /** The callout's button: moves the walkthrough on, or ends it on the last step. */
  readonly onTutorialNext: () => void;
  readonly onSkipTutorial: () => void;
}

// Everything is laid out on a 960 × 600 board, then scaled to fit the screen.
const BOARD = { width: 960, height: 600 };
/** The same font stack as the main game (src/index.css). */
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Colors from the main game's dark board and stylesheet, so the minigame looks like part of it.
const COLOR = {
  page: '#09090B',
  board: '#18181B',
  surface: '#27272A',
  border: '#3F3F46',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  label: '#71717A',
  wireUnknown: '#3F3F46',
  wireOff: '#52525B',
  wireOn: '#EAB308',
  bulbOn: '#FACC15',
  bulbOff: '#3F3F46',
  gateFill: '#1F2937',
  gateStroke: '#3B82F6',
  fault: '#EF4444',
  faultFill: '#450A0A',
  good: '#22C55E',
  highlight: '#3B82F6',
  goodFill: '#052E16',
  missed: '#F97316',
};

const TONE: Record<MessageTone, string> = {
  info: COLOR.text,
  hint: '#FACC15',
  good: '#4ADE80',
  bad: '#F87171',
};

const ALL_GATES = ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR'] as const;

/** The board card, like the main game's: it fills everything between the top bar and the controls. */
const CARD = { x: 0, y: 50, width: BOARD.width, height: 478 };
const GATE = { width: 120, height: 72 };
const PIN_GAP = 18;
/** Length of the stub drawn from each gate's output before its wire branches off. */
const OUTPUT_STUB = 20;

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon';

/**
 * FaultFinderView - Draws the "Fault Finder" minigame in the main game's layout: a slim top
 * bar (back, level dots), one board card holding the circuit and the number of faulty
 * gates, and the controls underneath.
 */
export class FaultFinderView implements View {
  private readonly group = new Konva.Group({ visible: false });
  private readonly board = new Konva.Group();
  private lastModel: FaultFinderViewModel | null = null;

  constructor(width: number, height: number, private readonly handlers: FaultFinderHandlers) {
    this.group.add(new Konva.Rect({ width, height, fill: COLOR.page }));
    const margin = 16;
    const scale = Math.min((width - margin * 2) / BOARD.width, (height - margin * 2) / BOARD.height, 1.5);
    this.board.scale({ x: scale, y: scale });
    this.board.position({ x: (width - BOARD.width * scale) / 2, y: (height - BOARD.height * scale) / 2 });
    this.group.add(this.board);

    // Gate icons load once; redraw when they arrive so placeholders are swapped for them.
    void Promise.all(ALL_GATES.map(loadGateIcon))
      .then(() => { if (this.lastModel) this.render(this.lastModel); })
      .catch(() => { /* Keep the text labels if the icons can't load. */ });
  }

  /** The level list: one card per level with its fault count and whether it's solved. */
  renderSelect(model: FaultFinderSelectModel): void {
    this.lastModel = null;
    this.setCursor('default');
    this.board.destroyChildren();

    this.board.add(this.button({
      name: 'back-button', x: 0, y: 2, width: 40, height: 36, label: '←', fontSize: 22,
      onClick: this.handlers.onBack, variant: 'icon',
    }));
    this.board.add(new Konva.Text({
      x: 0, y: 4, width: BOARD.width, align: 'center', text: 'Fault Finder',
      fontSize: 26, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text, listening: false,
    }));
    const solved = model.levels.filter((level) => level.completed).length;
    const total = badge('solved-count', `${solved} / ${model.levels.length} solved`, BOARD.width, 4, 'right');
    total.setAttr('solved', solved);
    this.board.add(total);

    const card = new Konva.Group({ x: CARD.x, y: CARD.y });
    card.add(new Konva.Rect({
      width: CARD.width, height: CARD.height, cornerRadius: 24, fill: COLOR.board,
      shadowColor: 'black', shadowOpacity: 0.25, shadowBlur: 10, shadowOffsetY: 2,
    }));
    const tile = { width: 160, height: 230, gap: 20 };
    const rowWidth = model.levels.length * tile.width + (model.levels.length - 1) * tile.gap;
    model.levels.forEach((level, index) => {
      card.add(this.drawLevelTile(level, index, {
        x: (CARD.width - rowWidth) / 2 + index * (tile.width + tile.gap),
        y: (CARD.height - tile.height) / 2, width: tile.width, height: tile.height,
      }));
    });
    this.board.add(card);
    this.board.add(this.button({
      name: 'how-to-play-button', x: (BOARD.width - 200) / 2, y: CARD.y + CARD.height + 16, width: 200, height: 50,
      label: 'How to Play', fontSize: 16, variant: 'secondary', onClick: this.handlers.onHowToPlay,
    }));
    this.group.getLayer()?.batchDraw();
  }

  private drawLevelTile(
    level: FaultFinderLevelCard, index: number, box: { x: number; y: number; width: number; height: number },
  ): Konva.Group {
    const group = new Konva.Group({ name: `level-card-${index}`, x: box.x, y: box.y });
    const frame = new Konva.Rect({
      width: box.width, height: box.height, cornerRadius: 16, fill: COLOR.page,
      stroke: level.completed ? COLOR.good : COLOR.surface, strokeWidth: 1.5,
    });
    group.add(frame);
    group.add(new Konva.Text({
      x: 0, y: 26, width: box.width, align: 'center', text: String(index + 1),
      fontSize: 44, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text,
    }));
    group.add(new Konva.Text({
      x: 12, y: 88, width: box.width - 24, height: 44, align: 'center', verticalAlign: 'middle',
      text: level.title, fontSize: 15, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.muted, lineHeight: 1.25,
    }));
    group.add(new Konva.Text({
      x: 0, y: 146, width: box.width, align: 'center', wrap: 'none',
      text: `${level.faultCount} faulty gate${level.faultCount === 1 ? '' : 's'}`,
      fontSize: 13, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.fault,
    }));
    if (level.completed) {
      group.add(new Konva.Rect({ x: (box.width - 92) / 2, y: 180, width: 92, height: 26, cornerRadius: 13, fill: COLOR.goodFill }));
      group.add(new Konva.Text({
        x: 0, y: 186, width: box.width, align: 'center', text: '✓ Solved', wrap: 'none',
        fontSize: 13, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.good,
      }));
    }
    group.setAttr('completed', level.completed);
    onPress(group, () => this.handlers.onSelectLevel(index));
    group.on('mouseenter', () => { frame.stroke(COLOR.gateStroke); group.getLayer()?.batchDraw(); });
    group.on('mouseleave', () => {
      frame.stroke(level.completed ? COLOR.good : COLOR.surface);
      group.getLayer()?.batchDraw();
    });
    return group;
  }

  render(model: FaultFinderViewModel): void {
    this.lastModel = model;
    // The node under the pointer may be replaced without a mouseleave, so reset the cursor.
    this.setCursor('default');
    this.board.destroyChildren();
    this.drawTopBar(model);
    this.drawCircuit(model);
    this.drawControls(model);
    if (model.tutorial) this.drawTutorial(model.tutorial);
    this.group.getLayer()?.batchDraw();
  }

  /** Like the main game's top nav: back on the left, level dots in the middle. */
  private drawTopBar(model: FaultFinderViewModel): void {
    this.board.add(this.button({
      name: 'back-button', x: 0, y: 2, width: 40, height: 36, label: '←', fontSize: 22,
      onClick: this.handlers.onBack, variant: 'icon',
    }));
    // The practice board isn't a level: no level dots, just a way out.
    if (model.tutorial) {
      if (model.tutorial.button !== 'Start Playing') {
        this.board.add(this.button({
          name: 'skip-tutorial-button', x: BOARD.width - 90, y: 2, width: 90, height: 36, label: 'Skip',
          fontSize: 14, variant: 'secondary', onClick: this.handlers.onSkipTutorial,
        }));
      }
      return;
    }

    // Level dots, like the main game's progress dots: hollow rings, the current one filled.
    const spacing = 28;
    const startX = BOARD.width / 2 - ((model.levelCount - 1) * spacing) / 2;
    for (let index = 0; index < model.levelCount; index += 1) {
      const current = index === model.levelIndex;
      const dot = new Konva.Group({ name: `level-button-${index}`, x: startX + index * spacing, y: 20 });
      if (current) dot.add(new Konva.Circle({ radius: 11, stroke: COLOR.text, strokeWidth: 2 }));
      dot.add(new Konva.Circle({ radius: 7, stroke: COLOR.text, strokeWidth: 2, fill: current ? COLOR.text : COLOR.page }));
      // A bigger invisible target, so the small dots are easy to click.
      dot.add(new Konva.Circle({ radius: 13, fill: 'transparent' }));
      if (!current) onPress(dot, () => this.handlers.onSelectLevel(index));
      this.board.add(dot);
    }

  }

  private drawCircuit(model: FaultFinderViewModel): void {
    const { level, current, diagnosis, revealed } = model;
    const card = new Konva.Group({ x: CARD.x, y: CARD.y });
    card.add(new Konva.Rect({
      width: CARD.width, height: CARD.height, cornerRadius: 24, fill: COLOR.board,
      shadowColor: 'black', shadowOpacity: 0.25, shadowBlur: 10, shadowOffsetY: 2,
    }));
    // Top-left badge, like the main game's level badge.
    card.add(badge('level-title', model.levelLabel, 20, 20, 'left'));
    if (!model.tutorial) card.add(guessesBadge(model.lives, model.maxLives, CARD.width - 20, 20));

    // How many gates are faulty: the one thing the player must know, so it gets the top centre.
    const count = model.faultCount;
    const faultText = new Konva.Text({
      name: 'fault-count', text: `${count} FAULTY GATE${count === 1 ? '' : 'S'}`,
      fontSize: 20, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.fault, letterSpacing: 1, wrap: 'none',
    });
    const faultWidth = faultText.width() + 40;
    faultText.position({ x: 20, y: (40 - faultText.height()) / 2 });
    const faultBadge = new Konva.Group({
      name: 'fault-badge', x: (CARD.width - faultWidth) / 2, y: 16, listening: false,
    });
    faultBadge.add(new Konva.Rect({
      width: faultWidth, height: 40, cornerRadius: 10, fill: COLOR.faultFill, stroke: COLOR.fault, strokeWidth: 1.5,
    }), faultText);
    card.add(faultBadge);

    // Short outcome messages only (wrong guess, solved); the walkthrough's callout replaces them.
    if (!model.tutorial) card.add(new Konva.Text({
      name: 'message', x: 40, y: CARD.height - 40, width: CARD.width - 80, align: 'center',
      text: model.message, fontSize: 17, fontStyle: 'bold', fontFamily: FONT, fill: TONE[model.tone],
    }));

    // Wires light up only from a test of the faulty board; until then every wire is unknown.
    // The healthy design's values are never shown.
    const known = (wireId: string): Bit | null => current?.wires[wireId] ?? null;

    // Leave room at the bottom of the card for the walkthrough's callout.
    const bottom = CARD.height - (model.tutorial ? 120 : 40);
    const layout = layoutCircuit(level, { left: 120, right: CARD.width - 90, top: 60, bottom });
    const gateIndex = new Map(level.executionOrder.map((slotId, index) => [slotId, index]));
    const outputOf = (slotId: string): Point => {
      const { x, y } = layout.gates[slotId];
      return { x: x + GATE.width / 2, y };
    };
    const sourcePoint = (source: { sourceType: string; sourceId: string }): Point =>
      source.sourceType === 'PRIMARY_INPUT'
        ? { x: layout.inputs[source.sourceId].x + 17, y: layout.inputs[source.sourceId].y }
        : { x: outputOf(source.sourceId).x + OUTPUT_STUB, y: outputOf(source.sourceId).y };
    const sourceValue = (source: { sourceType: string; sourceId: string }): Bit | null =>
      source.sourceType === 'PRIMARY_INPUT'
        ? known(source.sourceId)
        : known(level.slots[source.sourceId].outputWireId);

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
      card.add(wire(route(from, { x: bulb.x - 22, y: bulb.y }, wireIndex), known(outputId)));
      wireIndex += 1;
    }
    for (const slotId of level.executionOrder) {
      const out = outputOf(slotId);
      card.add(wire([out.x, out.y, out.x + OUTPUT_STUB, out.y], known(level.slots[slotId].outputWireId)));
    }

    for (const inputId of level.primaryInputs) {
      card.add(this.drawSwitch(inputId, layout.inputs[inputId], model.inputs[inputId], model.playing));
    }
    for (const slotId of level.executionOrder) {
      const label = `G${gateIndex.get(slotId)! + 1}`;
      card.add(this.drawGate(slotId, label, level, layout.gates[slotId], diagnosis, revealed, model.playing));
    }
    for (const outputId of level.primaryOutputs) {
      card.add(this.drawBulb(outputId, layout.outputs[outputId], known(outputId)));
    }

    this.board.add(card);
  }

  private drawSwitch(inputId: string, at: Point, value: Bit, playing: boolean): Konva.Group {
    const group = new Konva.Group({ name: `switch-${inputId}`, x: at.x - 80, y: at.y - 14, scale: { x: 1.1, y: 1.1 } });
    group.add(new Konva.Text({
      x: 0, y: 5, width: 24, text: inputId, fontSize: 18, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text,
    }));
    group.add(new Konva.Rect({
      x: 30, y: 0, width: 58, height: 28, cornerRadius: 14,
      fill: value ? COLOR.wireOn : COLOR.surface, stroke: COLOR.border, strokeWidth: 1,
    }));
    group.add(new Konva.Circle({ x: value ? 74 : 44, y: 14, radius: 10, fill: COLOR.text }));
    group.add(new Konva.Text({
      x: 30, y: 7, width: 58, align: 'center', text: value ? '1    ' : '    0', fontSize: 14, fontStyle: 'bold',
      fontFamily: FONT, fill: value ? COLOR.board : COLOR.muted,
    }));
    group.setAttr('value', value);
    if (playing) onPress(group, () => this.handlers.onToggleInput(inputId));
    return group;
  }

  private drawGate(
    slotId: string, label: string, level: FaultLevel, at: Point,
    diagnosis: readonly string[], revealed: FaultMap | null, playing: boolean,
  ): Konva.Group {
    const group = new Konva.Group({ name: `gate-${slotId}`, x: at.x - GATE.width / 2, y: at.y - GATE.height / 2 });
    const marked = diagnosis.includes(slotId);
    const truth: Fault | undefined = revealed?.[slotId];
    // While playing, a mark is red. Once revealed, real faults are green and a wrong mark is orange.
    let stroke = COLOR.gateStroke;
    let fill = COLOR.gateFill;
    let badgeText: string | null = null;
    let badgeColor = COLOR.fault;
    if (revealed) {
      if (truth !== undefined) {
        stroke = COLOR.good; fill = COLOR.goodFill; badgeColor = COLOR.good;
        badgeText = typeof truth === 'number' ? `STUCK ${truth}` : `LIKE ${truth}`;
      } else if (marked) {
        stroke = COLOR.missed; badgeText = 'OK'; badgeColor = COLOR.missed;
      }
    } else if (marked) {
      stroke = COLOR.fault; fill = COLOR.faultFill; badgeText = 'FAULTY';
    }
    group.add(new Konva.Rect({
      width: GATE.width, height: GATE.height, cornerRadius: 12, fill, stroke, strokeWidth: marked || truth !== undefined ? 3 : 2,
    }));
    const gate = level.slots[slotId].assignedGate;
    if (!addGateIcon(group, gate, GATE.width, GATE.height)) {
      group.add(new Konva.Text({
        width: GATE.width, height: GATE.height, align: 'center', verticalAlign: 'middle',
        text: gate, fontSize: 16, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.gateStroke,
      }));
    }
    // The G-number sits inside the box's corner, where wires and badges can't cover it.
    group.add(new Konva.Text({
      x: 8, y: 6, text: label, fontSize: 11, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.muted, wrap: 'none',
    }));
    if (badgeText) {
      group.add(new Konva.Rect({ x: -4, y: -12, width: GATE.width + 8, height: 20, cornerRadius: 10, fill: badgeColor }));
      group.add(new Konva.Text({
        name: 'badge', x: -4, y: -8, width: GATE.width + 8, align: 'center', text: badgeText, fontSize: 11,
        fontStyle: 'bold', fontFamily: FONT, fill: 'white', letterSpacing: 0.5, wrap: 'none',
      }));
    }
    group.setAttr('marked', marked);
    if (playing) onPress(group, () => this.handlers.onMarkGate(slotId));
    return group;
  }

  /** A bulb shows only what a test measured; before that it is dark and reads "?". */
  private drawBulb(outputId: string, at: Point, actual: Bit | null): Konva.Group {
    const group = new Konva.Group({ name: `bulb-${outputId}`, x: at.x, y: at.y });
    if (actual === 1) group.add(new Konva.Circle({ radius: 30, fill: '#FEF08A', opacity: 0.35 }));
    group.add(new Konva.Circle({
      radius: 22, fill: actual === 1 ? COLOR.bulbOn : COLOR.bulbOff,
      stroke: actual === null ? COLOR.border : undefined, strokeWidth: 1.5, dash: actual === null ? [4, 3] : [],
    }));
    group.add(new Konva.Text({ text: '💡', fontSize: 18, offsetX: 9, offsetY: 9, opacity: actual === 1 ? 1 : 0.5 }));
    group.add(new Konva.Text({
      name: 'bulb-label', x: -60, y: 30, width: 120, align: 'center', fontFamily: FONT, fontStyle: 'bold', fontSize: 13,
      fill: actual === 1 ? COLOR.bulbOn : COLOR.muted,
      text: `${outputId} = ${actual ?? '?'}`,
    }));
    group.setAttr('actual', actual);
    return group;
  }

  /**
   * The walkthrough callout along the bottom of the board, plus a ring around whatever it
   * talks about. The ring is drawn last so it sits on top, and ignores the pointer.
   */
  private drawTutorial(tutorial: TutorialPrompt): void {
    const target = tutorial.target ? this.targetRect(tutorial.target) : null;
    if (target) {
      const pad = 8;
      this.board.add(new Konva.Rect({
        name: 'tutorial-highlight', x: target.x - pad, y: target.y - pad,
        width: target.width + pad * 2, height: target.height + pad * 2, cornerRadius: 14,
        stroke: COLOR.highlight, strokeWidth: 3, dash: [8, 5], listening: false,
        shadowColor: COLOR.highlight, shadowBlur: 12, shadowOpacity: 0.6,
      }));
    }

    const width = 780;
    const height = 76;
    const callout = new Konva.Group({
      name: 'tutorial-callout', x: (BOARD.width - width) / 2, y: CARD.y + CARD.height - height - 16,
    });
    callout.add(new Konva.Rect({ width, height, cornerRadius: 14, fill: COLOR.surface, stroke: COLOR.highlight, strokeWidth: 1.5 }));
    const buttonWidth = tutorial.button ? 150 : 0;
    callout.add(new Konva.Text({
      name: 'tutorial-text', x: 20, y: 0, width: width - 40 - (buttonWidth ? buttonWidth + 16 : 0), height,
      verticalAlign: 'middle', text: tutorial.text, fontSize: 16, fontStyle: '500', fontFamily: FONT,
      fill: COLOR.text, lineHeight: 1.35,
    }));
    if (tutorial.button) {
      callout.add(this.button({
        name: 'tutorial-next-button', x: width - buttonWidth - 16, y: (height - 44) / 2, width: buttonWidth, height: 44,
        label: tutorial.button, fontSize: 16, onClick: this.handlers.onTutorialNext,
      }));
    }
    this.board.add(callout);
  }

  /** The area on the board covered by the nodes a callout points at. */
  private targetRect(target: TutorialTarget): { x: number; y: number; width: number; height: number } | null {
    const prefix: Record<TutorialTarget, string> = {
      faults: 'fault-badge', switches: 'switch-', run: 'run-button', gates: 'gate-', submit: 'submit-button',
    };
    const nodes = this.board.find((node: Konva.Node) => node.name().startsWith(prefix[target]));
    if (nodes.length === 0) return null;
    const rects = nodes.map((node) => node.getClientRect({ relativeTo: this.board, skipShadow: true }));
    const x = Math.min(...rects.map((rect) => rect.x));
    const y = Math.min(...rects.map((rect) => rect.y));
    return {
      x, y,
      width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x,
      height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y,
    };
  }

  private drawControls(model: FaultFinderViewModel): void {
    const y = CARD.y + CARD.height + 16;
    const height = 50;
    if (model.action) {
      this.board.add(this.button({
        name: 'action-button', x: (BOARD.width - 260) / 2, y, width: 260, height, fontSize: 17,
        label: model.action === 'next' ? 'Next Board →' : model.action === 'finish' ? 'Back to Levels' : 'Try Again',
        onClick: this.handlers.onAction,
      }));
      return;
    }
    const width = 260;
    const gap = 16;
    const left = (BOARD.width - width * 2 - gap) / 2;
    const marks = model.diagnosis.length;
    this.board.add(this.button({
      name: 'run-button', x: left, y, width, height, fontSize: 17,
      // The practice board has plenty of tests, so it doesn't count them.
      label: model.tutorial ? 'Run Test' : model.testsLeft > 0 ? `Run Test  ·  ${model.testsLeft} left` : 'No Tests Left',
      variant: 'primary', onClick: model.playing && model.testsLeft > 0 ? this.handlers.onRunTest : undefined,
    }));
    this.board.add(this.button({
      name: 'submit-button', x: left + width + gap, y, width, height, fontSize: 17,
      label: `Submit  ·  ${marks} / ${model.faultCount}`,
      variant: 'danger', onClick: model.playing && marks > 0 ? this.handlers.onSubmit : undefined,
    }));
  }

  private button(options: {
    name: string; x: number; y: number; width: number; height: number; label: string;
    onClick?: () => void; variant?: ButtonVariant; fontSize?: number;
  }): Konva.Group {
    const { name, x, y, width, height, label, onClick, variant = 'primary' } = options;
    const group = new Konva.Group({ name, x, y });
    // Primary matches the main game's light "Next Level" button; secondary its dark one.
    // Icon buttons are bare like the main game's top-bar icons until hovered.
    const fill = variant === 'primary' ? COLOR.text : variant === 'danger' ? COLOR.fault
      : variant === 'icon' ? 'transparent' : COLOR.surface;
    const textColor = variant === 'primary' ? COLOR.board : variant === 'icon' ? COLOR.muted : COLOR.text;
    const rect = new Konva.Rect({ width, height, fill, cornerRadius: 8 });
    group.add(rect);
    group.add(new Konva.Text({
      width, height, text: label, align: 'center', verticalAlign: 'middle', fontFamily: FONT, fontStyle: 'bold',
      fontSize: options.fontSize ?? 15, fill: textColor,
    }));
    group.setAttr('enabled', Boolean(onClick));
    // Buttons that can't be pressed right now fade out.
    if (!onClick) group.opacity(0.35);
    if (onClick) {
      onPress(group, onClick);
      group.on('mouseenter', () => {
        if (variant === 'icon') rect.fill(COLOR.surface); else group.opacity(0.9);
        group.getLayer()?.batchDraw();
      });
      group.on('mouseleave', () => {
        if (variant === 'icon') rect.fill('transparent'); else group.opacity(1);
        group.getLayer()?.batchDraw();
      });
    }
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


/** A rounded dark badge, like the main game's level badge. The text node carries `name`. */
function badge(name: string, text: string, x: number, y: number, anchor: 'left' | 'right'): Konva.Group {
  const label = new Konva.Text({
    name, text, x: 12, y: 8, fontSize: 14, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text,
  });
  const width = label.width() + 24;
  const group = new Konva.Group({ x: anchor === 'left' ? x : x - width, y, listening: false });
  group.add(new Konva.Rect({ width, height: 30, cornerRadius: 8, fill: COLOR.surface }), label);
  return group;
}

/**
 * Top-right badge mirroring the level badge: one pip per wrong guess allowed, filled while
 * still available and hollow once spent, in the same style as the level dots. The last
 * remaining guess turns red.
 */
function guessesBadge(left: number, total: number, right: number, y: number): Konva.Group {
  const label = new Konva.Text({
    text: 'Guesses', x: 12, y: 8, fontSize: 14, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text, wrap: 'none',
  });
  const pipGap = 16;
  const width = 12 + label.width() + 12 + total * pipGap + 6;
  const group = new Konva.Group({ name: 'lives', x: right - width, y, listening: false });
  group.add(new Konva.Rect({ width, height: 30, cornerRadius: 8, fill: COLOR.surface }), label);
  const color = left === 1 ? COLOR.fault : COLOR.text;
  for (let index = 0; index < total; index += 1) {
    const available = index < left;
    group.add(new Konva.Circle({
      name: available ? 'guess-left' : 'guess-used',
      x: 12 + label.width() + 12 + index * pipGap + 5, y: 15, radius: 5,
      fill: available ? color : 'transparent', stroke: available ? color : COLOR.muted, strokeWidth: 1.5,
    }));
  }
  group.setAttr('lives', left);
  return group;
}

/** An orthogonal path from `from` to `to`; the bend shifts a little per wire so parallel runs don't overlap. */
function route(from: Point, to: Point, index: number): number[] {
  const bend = from.x + (to.x - from.x) * (0.35 + 0.1 * (index % 4));
  return [from.x, from.y, bend, from.y, bend, to.y, to.x, to.y];
}

/** A lit wire is a measured 1, a solid grey wire a measured 0, and a dashed wire is unknown. */
function wire(points: number[], value: Bit | null): Konva.Line {
  const line = new Konva.Line({
    name: 'wire', points,
    stroke: value === 1 ? COLOR.wireOn : value === 0 ? COLOR.wireOff : COLOR.wireUnknown,
    strokeWidth: value === 1 ? 4 : value === 0 ? 3 : 2,
    dash: value === null ? [6, 5] : [], lineCap: 'round', lineJoin: 'round', listening: false,
  });
  line.setAttr('measured', value ?? 'unknown');
  return line;
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
