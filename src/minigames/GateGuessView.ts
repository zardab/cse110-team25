import Konva from 'konva';
import type { View } from '../screenTypes';
import { addGateIcon, loadGateIcon } from '../ui/components/boards/gateIcons';
import { GUESS_GATES, MAX_LIVES, ROUND_SECONDS, outputOf, type Bit, type Clue, type GuessGate } from './gateGuess';

export type MessageTone = 'info' | 'hint' | 'good' | 'bad';

/** Everything the screen shows. The controller builds it; the view only draws it. */
export interface GateGuessViewModel {
  readonly clues: readonly Clue[];
  /** Which clue the circuit is showing. */
  readonly selectedClue: number;
  /** The gate to show in the box, or null to keep it hidden. */
  readonly revealedGate: GuessGate | null;
  readonly guessed: readonly GuessGate[];
  readonly lives: number;
  readonly streak: number;
  readonly best: number;
  /** Whole seconds left to solve this circuit. */
  readonly timeLeft: number;
  readonly message: string;
  readonly tone: MessageTone;
  /** The button under the gates: none while a round is in play. */
  readonly action: 'next' | 'restart' | null;
}

export interface GateGuessHandlers {
  readonly onGuess: (gate: GuessGate) => void;
  readonly onSelectClue: (index: number) => void;
  readonly onAction: () => void;
  readonly onBack: () => void;
  readonly onStart: () => void;
}

/** What the How to Play screen shows before a run starts. */
export interface GateGuessIntroModel {
  readonly best: number;
}

/** The How to Play steps, in order. Each is a heading and the text under it. */
const INTRO_STEPS: readonly (readonly [string, string])[] = [
  ['A gate is hidden in the box.',
    'It has two inputs, A and B. Its output (OUT) lights the bulb when it is 1 and leaves it off when it is 0.'],
  ['Read the test.',
    'Each circuit starts with one test: the inputs A and B and the output the hidden gate gave. Use the cheat sheet to see which gates match.'],
  ['Click a gate to guess.',
    `✔ Correct: the gate is revealed and your streak goes up.\n` +
    `➜ Fits so far: your guess matches every test but is not the answer. No penalty, you get a new test.\n` +
    `✘ Wrong: your guess breaks a test you can already see. You lose a life.`],
  ['Beat the clock.',
    `You have ${MAX_LIVES} lives and ${ROUND_SECONDS} seconds per circuit. The run ends when you run out of lives or time.`],
  ['Build your streak.',
    'Name as many gates in a row as you can. Your best streak is saved.'],
];


// Everything is laid out on a 960 × 600 board, then scaled to fit the screen.
const BOARD = { width: 960, height: 600 };
/** The same font stack as the main game (src/index.css). */
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Colors from the main game's dark stylesheet (src/index.css) and board, so the minigame looks like part of it.
const COLOR = {
  page: '#09090B',
  card: '#18181B',
  surface: '#18181B',
  raised: '#27272A',
  border: '#27272A',
  edge: '#3F3F46',
  tray: '#18181B',
  badge: '#27272A',
  ink: '#FAFAFA',
  onInk: '#18181B',
  muted: '#A1A1AA',
  faint: '#71717A',
  label: '#71717A',
  hover: '#A1A1AA',
  wireOff: '#52525B',
  wireOn: '#EAB308',
  inputOff: '#9CA3AF',
  bulbOn: '#FACC15',
  bulbOff: '#3F3F46',
  slot: '#52525B',
  slotFill: '#27272A',
  slotText: '#A1A1AA',
  placed: '#3B82F6',
  placedText: '#93C5FD',
  placedFill: '#1F2937',
  one: '#FACC15',
  heart: '#EF4444',
  warning: '#F87171',
};

const TONE: Record<MessageTone, string> = {
  info: COLOR.ink,
  hint: '#FACC15',
  good: '#4ADE80',
  bad: '#F87171',
};

type ButtonVariant = 'primary' | 'secondary' | 'gate';

const GATE_BUTTON = { width: 130, height: 64, gap: 15, y: 452 };
const TIMER_BAR = { y: 84, height: 6 };
/** At or below this many seconds the timer turns red. */
const TIMER_WARNING = 5;

/**
 * GateGuessView - Draws the "Name That Gate" minigame: a circuit with a hidden gate,
 * the clues found so far, and one button per gate.
 */
export class GateGuessView implements View {
  private readonly group = new Konva.Group({ visible: false });
  private readonly board = new Konva.Group();
  private timerText?: Konva.Text;
  private timerBar?: Konva.Rect;
  /** Redraws the current screen; used once the gate icons finish loading. */
  private redraw?: () => void;

  constructor(width: number, height: number, private readonly handlers: GateGuessHandlers) {
    // A light page with one rounded card on it, like the main game's board card.
    this.group.add(new Konva.Rect({ width, height, fill: COLOR.page }));
    const inset = 12;
    this.group.add(new Konva.Rect({
      x: inset, y: inset, width: width - inset * 2, height: height - inset * 2, cornerRadius: 24,
      fill: COLOR.card, shadowColor: 'black', shadowOpacity: 0.04, shadowBlur: 10, shadowOffsetY: 2,
    }));
    // Keep a margin so the board's edges stay clear of the card's edges.
    const margin = 40;
    const scale = Math.min((width - margin * 2) / BOARD.width, (height - margin * 2) / BOARD.height, 1.5);
    this.board.scale({ x: scale, y: scale });
    this.board.position({ x: (width - BOARD.width * scale) / 2, y: (height - BOARD.height * scale) / 2 });
    this.group.add(this.board);
    // Gate icons load once; redraw whatever is showing when they arrive.
    Promise.all(GUESS_GATES.map(loadGateIcon)).then(() => this.redraw?.(), () => undefined);
  }

  render(model: GateGuessViewModel): void {
    this.redraw = () => this.render(model);
    // The node under the pointer may be replaced without a mouseleave, so reset the cursor.
    this.setCursor('default');
    this.board.destroyChildren();
    this.drawHeader(model);
    this.drawCircuit(model);
    this.drawClues(model);
    this.board.add(new Konva.Text({
      name: 'message', x: 40, y: 388, width: BOARD.width - 80, align: 'center',
      text: model.message, fontSize: 17, fontStyle: '500', fontFamily: FONT, fill: TONE[model.tone], lineHeight: 1.35,
    }));
    this.drawGateButtons(model);
    if (model.action) {
      this.board.add(this.button({
        name: 'action-button', x: (BOARD.width - 220) / 2, y: 540, width: 220, height: 44,
        label: model.action === 'next' ? 'Next Circuit →' : 'Play Again', onClick: this.handlers.onAction,
      }));
    }
    this.group.getLayer()?.batchDraw();
  }

  /** Draws the How to Play screen shown before a run starts. */
  renderIntro(model: GateGuessIntroModel): void {
    this.redraw = () => this.renderIntro(model);
    this.setCursor('default');
    this.board.destroyChildren();
    this.drawTitle('Work out which logic gate is hidden in the box.');
    this.board.add(sectionLabel('HOW TO PLAY', 0, 100));

    // Numbered steps down the left, each placed under the one before it.
    let y = 124;
    INTRO_STEPS.forEach(([heading, body], index) => {
      this.board.add(new Konva.Circle({ x: 11, y: y + 10, radius: 11, fill: COLOR.ink }));
      this.board.add(new Konva.Text({
        x: 0, y: y + 3, width: 22, align: 'center', text: `${index + 1}`,
        fontSize: 13, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.onInk,
      }));
      const title = new Konva.Text({
        x: 34, y: y + 1, width: 510, text: heading, fontSize: 16, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
      });
      const text = new Konva.Text({
        x: 34, y: y + 23, width: 510, text: body, fontSize: 14, fontFamily: FONT, fill: COLOR.muted, lineHeight: 1.35,
      });
      this.board.add(title, text);
      y = text.y() + text.height() + 14;
    });
    this.drawCheatSheet();

    // The best streak and START sit under the cheat sheet, leaving the left column to the steps.
    const column = { x: 580, width: 380 };
    this.board.add(badge('intro-best', `BEST STREAK ${model.best}`, column.x + column.width / 2, 432, 'center'));
    this.board.add(this.button({
      name: 'start-button', x: column.x + (column.width - 260) / 2, y: 476, width: 260, height: 56,
      label: 'START', fontSize: 20, onClick: this.handlers.onStart,
    }));
    this.group.getLayer()?.batchDraw();
  }

  /** A truth table of every gate in the game, so the player can match tests to gates. */
  private drawCheatSheet(): void {
    const panel = new Konva.Group({ name: 'cheat-sheet', x: 580, y: 100 });
    const size = { width: 380, height: 300 };
    panel.add(new Konva.Rect({
      ...size, cornerRadius: 16, fill: COLOR.surface, stroke: COLOR.border, strokeWidth: 1.5,
    }));
    panel.add(sectionLabel('GATE CHEAT SHEET', 20, 18));
    panel.add(new Konva.Text({
      x: 20, y: 38, width: size.width - 40, fontSize: 13, fontFamily: FONT, fill: COLOR.muted,
      text: 'OUT for each gate and each pair of inputs:',
    }));

    const columns = ['A', 'B', ...GUESS_GATES];
    const left = 14;
    const inputWidth = 30;
    const gateWidth = (size.width - left * 2 - inputWidth * 2) / GUESS_GATES.length;
    const columnX = (column: number) =>
      left + (column < 2 ? column * inputWidth : inputWidth * 2 + (column - 2) * gateWidth);
    const columnWidth = (column: number) => (column < 2 ? inputWidth : gateWidth);

    columns.forEach((label, column) => {
      panel.add(new Konva.Text({
        x: columnX(column), y: 72, width: columnWidth(column), align: 'center', text: label,
        fontSize: 13, fontStyle: 'bold', fontFamily: FONT, fill: column < 2 ? COLOR.faint : COLOR.ink,
      }));
    });
    panel.add(new Konva.Line({
      points: [left, 94, size.width - left, 94], stroke: COLOR.border, strokeWidth: 1.5,
    }));

    const inputs: readonly (readonly [Bit, Bit])[] = [[0, 0], [0, 1], [1, 0], [1, 1]];
    inputs.forEach(([a, b], row) => {
      const y = 104 + row * 32;
      const values = [a, b, ...GUESS_GATES.map((gate) => outputOf(gate, a, b))];
      values.forEach((value, column) => {
        panel.add(new Konva.Text({
          x: columnX(column), y, width: columnWidth(column), align: 'center', text: String(value),
          fontSize: 17, fontStyle: 'bold', fontFamily: FONT,
          fill: column < 2 ? COLOR.faint : value ? COLOR.one : COLOR.muted,
        }));
      });
    });

    panel.add(new Konva.Text({
      x: 20, y: 240, width: size.width - 40, fontSize: 13, fontFamily: FONT, fill: COLOR.muted, lineHeight: 1.35,
      text: 'Tip: one test always fits three gates. Guessing one of them is safe and earns another test.',
    }));
    this.board.add(panel);
  }

  /** The back button, title and subtitle shared by the intro and the game. */
  private drawTitle(subtitle: string): void {
    this.board.add(this.button({
      name: 'back-button', x: 0, y: 0, width: 96, height: 36, label: '← Back',
      onClick: this.handlers.onBack, variant: 'secondary', fontSize: 14,
    }));
    // The title and subtitle span the full board width and overlap the back button,
    // so they must not listen for pointer events or they swallow its clicks.
    this.board.add(new Konva.Text({
      x: 0, y: 6, width: BOARD.width, align: 'center', text: 'Name That Gate',
      fontSize: 30, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink, listening: false,
    }));
    this.board.add(new Konva.Text({
      name: 'subtitle', x: 0, y: 46, width: BOARD.width, align: 'center', fontSize: 15, fontFamily: FONT,
      fill: COLOR.muted, listening: false, text: subtitle,
    }));
  }

  private drawHeader(model: GateGuessViewModel): void {
    this.drawTitle('A gate is hidden in the box. Use the tests to work out which one.');
    this.drawLives(model.lives);
    this.board.add(badge('score', `STREAK ${model.streak}   BEST ${model.best}`, BOARD.width, 44, 'right'));

    const timer = badge('timer', '', 0, 44, 'left', 76);
    this.timerText = timer.findOne<Konva.Text>('.timer');
    this.board.add(timer);
    this.board.add(new Konva.Rect({
      x: 0, y: TIMER_BAR.y, width: BOARD.width, height: TIMER_BAR.height, cornerRadius: 3, fill: COLOR.border,
    }));
    this.timerBar = new Konva.Rect({
      name: 'timer-bar', x: 0, y: TIMER_BAR.y, height: TIMER_BAR.height, cornerRadius: 3,
    });
    this.board.add(this.timerBar);
    this.showTime(model.timeLeft);
  }

  /**
   * One heart per life, right-aligned. Lost lives use the same ♥ glyph drawn as an outline:
   * the outline glyph ♡ comes out smaller than ♥ in most fonts.
   */
  private drawLives(lives: number): void {
    const size = 40;
    const gap = 2;
    const width = new Konva.Text({ text: '♥', fontSize: size }).width();
    const group = new Konva.Group({ name: 'lives', x: BOARD.width - MAX_LIVES * (width + gap) + gap, y: -8 });
    for (let i = 0; i < MAX_LIVES; i += 1) {
      const full = i < lives;
      group.add(new Konva.Text({
        name: full ? 'heart-full' : 'heart-empty', x: i * (width + gap), text: '♥', fontSize: size,
        fill: full ? COLOR.heart : 'transparent', stroke: full ? undefined : COLOR.heart, strokeWidth: full ? 0 : 1.5,
      }));
    }
    this.board.add(group);
  }

  /** Updates only the timer, so a tick doesn't rebuild the board under the pointer. */
  setTimeLeft(seconds: number): void {
    this.showTime(seconds);
    this.group.getLayer()?.batchDraw();
  }

  private showTime(seconds: number): void {
    const warning = seconds <= TIMER_WARNING;
    this.timerText?.text(`⏱ ${seconds}s`).fill(warning ? COLOR.warning : COLOR.ink);
    this.timerBar?.width(BOARD.width * Math.max(0, seconds) / ROUND_SECONDS)
      .fill(warning ? COLOR.warning : COLOR.wireOn);
  }

  private drawCircuit(model: GateGuessViewModel): void {
    const clue = model.clues[model.selectedClue];
    const card = new Konva.Group({ x: 40, y: 104 });
    card.add(new Konva.Rect({
      width: 560, height: 266, cornerRadius: 16, fill: COLOR.surface, stroke: COLOR.border, strokeWidth: 1.5,
    }));
    card.add(sectionLabel(`SHOWING TEST ${model.selectedClue + 1} OF ${model.clues.length}`, 20, 16));

    const box = { x: 230, y: 85, width: 130, height: 100 };
    const inputs: [string, number, 0 | 1][] = [['A', 105, clue.a], ['B', 165, clue.b]];
    for (const [name, y, value] of inputs) {
      card.add(new Konva.Text({
        x: 22, y: y - 13, text: '⚡', fontSize: 26, fill: value ? COLOR.wireOn : COLOR.inputOff,
      }));
      card.add(new Konva.Text({
        x: 56, y: y - 9, text: `${name} = ${value}`, fontSize: 17, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
      }));
      card.add(wire([140, y, box.x, y], value));
    }

    // The hidden gate looks like the main game's empty "DROP GATE" slot, and like a placed gate once revealed.
    const outY = box.y + box.height / 2;
    card.add(wire([box.x + box.width, outY, 445, outY], clue.out));
    const hidden = model.revealedGate === null;
    card.add(new Konva.Rect({
      ...box, cornerRadius: 14, strokeWidth: 2,
      fill: hidden ? COLOR.slotFill : COLOR.placedFill, stroke: hidden ? COLOR.slot : COLOR.placed, dash: hidden ? [6, 6] : [],
    }));
    // Once revealed, the box shows the gate's symbol like a placed gate, with its name under it.
    const icon = new Konva.Group({ x: box.x, y: box.y - 8, listening: false });
    const hasIcon = !hidden && addGateIcon(icon, model.revealedGate!, box.width, box.height);
    if (hasIcon) card.add(icon);
    card.add(new Konva.Text({
      name: 'gate-box', ...box, align: 'center', fontFamily: FONT, fontStyle: 'bold',
      verticalAlign: hasIcon ? 'bottom' : 'middle', padding: hasIcon ? 8 : 0,
      text: hidden ? '?' : model.revealedGate!, fontSize: hidden ? 44 : hasIcon ? 14 : 24,
      fill: hidden ? COLOR.slotText : COLOR.placedText,
    }));

    const bulb = { x: 475, y: outY };
    if (clue.out) card.add(new Konva.Circle({ ...bulb, radius: 32, fill: '#FEF08A', opacity: 0.6 }));
    card.add(new Konva.Circle({ ...bulb, radius: 25, fill: clue.out ? COLOR.bulbOn : COLOR.bulbOff }));
    card.add(new Konva.Text({ ...bulb, text: '💡', fontSize: 26, offsetX: 13, offsetY: 13 }));
    card.add(new Konva.Text({
      x: bulb.x - 50, y: bulb.y + 38, width: 100, align: 'center', text: `OUT = ${clue.out}`,
      fontSize: 17, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
    }));
    this.board.add(card);
  }

  private drawClues(model: GateGuessViewModel): void {
    const panel = new Konva.Group({ x: 630, y: 104 });
    panel.add(new Konva.Rect({
      width: 290, height: 266, cornerRadius: 16, fill: COLOR.surface, stroke: COLOR.border, strokeWidth: 1.5,
    }));
    panel.add(sectionLabel('TESTS', 20, 16));
    const columns = [{ label: 'A', x: 60 }, { label: 'B', x: 130 }, { label: 'OUT', x: 210 }];
    for (const { label, x } of columns) {
      panel.add(new Konva.Text({
        x: x - 30, y: 46, width: 60, align: 'center', text: label, fontSize: 13, fontStyle: 'bold',
        fontFamily: FONT, fill: COLOR.faint,
      }));
    }

    model.clues.forEach((clue, index) => {
      const selected = index === model.selectedClue;
      const row = new Konva.Group({ name: `clue-row-${index}`, x: 14, y: 70 + index * 46 });
      row.add(new Konva.Rect({
        width: 262, height: 38, cornerRadius: 10, strokeWidth: selected ? 1.5 : 1,
        fill: selected ? COLOR.raised : COLOR.surface, stroke: selected ? COLOR.ink : COLOR.edge,
      }));
      const values = [clue.a, clue.b, clue.out];
      columns.forEach(({ x }, column) => {
        row.add(new Konva.Text({
          x: x - 44, y: 10, width: 60, align: 'center', text: String(values[column]), fontSize: 17,
          fontStyle: 'bold', fontFamily: FONT, fill: column === 2 && values[2] ? COLOR.one : COLOR.ink,
        }));
      });
      onPress(row, () => this.handlers.onSelectClue(index));
      panel.add(row);
    });

    panel.add(new Konva.Text({
      x: 20, y: 214, width: 250, fontSize: 12, fontFamily: FONT, fill: COLOR.muted, lineHeight: 1.35,
      text: 'Click a test to show it on the circuit. Guessing a gate that fits every test earns a new one.',
    }));
    this.board.add(panel);
  }

  /** The gates sit in a tray like the main game's "Available Gates" palette. */
  private drawGateButtons(model: GateGuessViewModel): void {
    const total = GUESS_GATES.length * GATE_BUTTON.width + (GUESS_GATES.length - 1) * GATE_BUTTON.gap;
    const start = (BOARD.width - total) / 2;
    const padding = 12;
    this.board.add(new Konva.Rect({
      x: start - padding, y: GATE_BUTTON.y - padding, width: total + padding * 2,
      height: GATE_BUTTON.height + padding * 2, cornerRadius: 16, fill: COLOR.tray, stroke: COLOR.border, strokeWidth: 1,
    }));
    const playing = model.action === null;
    GUESS_GATES.forEach((gate, index) => {
      const used = model.guessed.includes(gate) && gate !== model.revealedGate;
      const enabled = playing && !used;
      this.board.add(this.button({
        name: `gate-button-${gate}`, variant: 'gate',
        x: start + index * (GATE_BUTTON.width + GATE_BUTTON.gap),
        y: GATE_BUTTON.y, width: GATE_BUTTON.width, height: GATE_BUTTON.height, label: gate, fontSize: 17,
        revealed: gate === model.revealedGate, used,
        onClick: enabled ? () => this.handlers.onGuess(gate) : undefined,
      }));
    });
  }

  private button(options: {
    name: string; x: number; y: number; width: number; height: number; label: string;
    onClick?: () => void; variant?: ButtonVariant; fontSize?: number; used?: boolean; revealed?: boolean;
  }): Konva.Group {
    const { name, x, y, width, height, label, onClick, variant = 'primary' } = options;
    const group = new Konva.Group({ name, x, y });
    let fill: string = COLOR.ink;
    let stroke: string | undefined;
    let textColor: string = COLOR.onInk;
    if (variant === 'secondary') {
      fill = COLOR.raised;
      textColor = COLOR.ink;
    } else if (variant === 'gate') {
      fill = options.revealed ? COLOR.placedFill : COLOR.raised;
      stroke = options.revealed ? COLOR.placed : COLOR.edge;
      textColor = options.revealed ? COLOR.placedText : COLOR.ink;
    }
    const rect = new Konva.Rect({
      width, height, fill, stroke, strokeWidth: stroke ? 1.5 : 0, cornerRadius: variant === 'gate' ? 12 : 8,
    });
    group.add(rect);
    // Gate cards show the gate's symbol, like the main game's tray, with its name under it.
    const icon = new Konva.Group({ y: -8, listening: false });
    const hasIcon = variant === 'gate' && addGateIcon(icon, label, width, height);
    if (hasIcon) group.add(icon);
    group.add(new Konva.Text({
      width, height, text: label, align: 'center', fontFamily: FONT, fontStyle: 'bold',
      verticalAlign: hasIcon ? 'bottom' : 'middle', padding: hasIcon ? 5 : 0,
      fontSize: hasIcon ? 12 : options.fontSize ?? 15, fill: textColor, textDecoration: options.used ? 'line-through' : '',
    }));
    // Spent gates fade out, like a gate with none left in the main game's tray.
    if (options.used) group.opacity(0.4);
    group.setAttr('enabled', Boolean(onClick));
    if (onClick) {
      onPress(group, onClick);
      // Hover feedback matches the main game: gate cards get a darker border, buttons dim slightly.
      group.on('mouseenter', () => {
        if (variant === 'gate') rect.stroke(COLOR.hover);
        else group.opacity(0.9);
        group.getLayer()?.batchDraw();
      });
      group.on('mouseleave', () => {
        if (variant === 'gate') rect.stroke(stroke);
        else group.opacity(1);
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

/** A small, bold, spaced-out uppercase label, like the main game's "AVAILABLE GATES". */
function sectionLabel(text: string, x: number, y: number): Konva.Text {
  return new Konva.Text({
    x, y, text, fontSize: 11, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.label, letterSpacing: 1,
  });
}

/**
 * A rounded gray badge, like the main game's level badge and timer. `x` is the badge's
 * left edge, center or right edge depending on `anchor`. The text node carries `name`.
 */
function badge(
  name: string, text: string, x: number, y: number, anchor: 'left' | 'center' | 'right', minWidth = 0,
): Konva.Group {
  const label = new Konva.Text({
    name, text, x: 12, y: 7, fontSize: 14, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
  });
  const width = Math.max(minWidth, label.width() + 24);
  label.width(width - 24).align('center');
  const left = anchor === 'left' ? x : anchor === 'center' ? x - width / 2 : x - width;
  const group = new Konva.Group({ x: left, y });
  group.add(new Konva.Rect({ width, height: 30, cornerRadius: 8, fill: COLOR.badge }), label);
  return group;
}

function wire(points: number[], value: 0 | 1): Konva.Line {
  return new Konva.Line({
    points, stroke: value ? COLOR.wireOn : COLOR.wireOff, strokeWidth: value ? 4 : 3, lineCap: 'round', lineJoin: 'round',
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
