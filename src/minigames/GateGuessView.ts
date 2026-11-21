import Konva from 'konva';
import type { View } from '../screenTypes';
import { GUESS_GATES, MAX_LIVES, ROUND_SECONDS, type Clue, type GuessGate } from './gateGuess';

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
  mystery: '#7C3AED',
  reveal: '#1D4ED8',
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

const GATE_BUTTON = { width: 130, height: 56, gap: 15, y: 452 };
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

  constructor(width: number, height: number, private readonly handlers: GateGuessHandlers) {
    this.group.add(new Konva.Rect({ width, height, fill: COLOR.background }));
    // Keep a margin so text at the board's edges never touches the screen's edges.
    const margin = 16;
    const scale = Math.min((width - margin * 2) / BOARD.width, (height - margin * 2) / BOARD.height, 1.5);
    this.board.scale({ x: scale, y: scale });
    this.board.position({ x: (width - BOARD.width * scale) / 2, y: (height - BOARD.height * scale) / 2 });
    this.group.add(this.board);
  }

  render(model: GateGuessViewModel): void {
    // The node under the pointer may be replaced without a mouseleave, so reset the cursor.
    this.setCursor('default');
    this.board.destroyChildren();
    this.drawHeader(model);
    this.drawCircuit(model);
    this.drawClues(model);
    this.board.add(new Konva.Text({
      name: 'message', x: 40, y: 400, width: BOARD.width - 80, align: 'center',
      text: model.message, fontSize: 19, fontFamily: FONT, fill: TONE[model.tone], lineHeight: 1.3,
    }));
    this.drawGateButtons(model);
    if (model.action) {
      this.board.add(this.button({
        name: 'action-button', x: (BOARD.width - 240) / 2, y: 528, width: 240, height: 46,
        label: model.action === 'next' ? 'NEXT CIRCUIT →' : 'PLAY AGAIN', onClick: this.handlers.onAction,
      }));
    }
    this.group.getLayer()?.batchDraw();
  }

  private drawHeader(model: GateGuessViewModel): void {
    this.board.add(this.button({
      name: 'back-button', x: 0, y: 0, width: 110, height: 38, label: '← BACK',
      onClick: this.handlers.onBack, fill: 'transparent', stroke: COLOR.dim,
    }));
    // The title and subtitle span the full board width and overlap the back button,
    // so they must not listen for pointer events or they swallow its clicks.
    this.board.add(new Konva.Text({
      x: 0, y: 10, width: BOARD.width, align: 'center', text: 'NAME THAT GATE',
      fontSize: 34, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text, listening: false,
    }));
    this.board.add(new Konva.Text({
      x: 0, y: 52, width: BOARD.width, align: 'center', fontSize: 15, fontFamily: FONT, fill: COLOR.dim,
      listening: false,
      text: 'A gate is hidden in the box. Use the tests to work out which one.',
    }));
    const hearts = '♥'.repeat(model.lives) + '♡'.repeat(Math.max(0, MAX_LIVES - model.lives));
    this.board.add(new Konva.Text({
      name: 'lives', x: BOARD.width - 260, y: -4, width: 260, align: 'right',
      text: hearts, fontSize: 40, fill: COLOR.heart, letterSpacing: 2,
    }));
    this.board.add(new Konva.Text({
      name: 'score', x: BOARD.width - 260, y: 42, width: 260, align: 'right', fontFamily: FONT,
      text: `STREAK ${model.streak}   BEST ${model.best}`, fontSize: 14, fill: COLOR.dim,
    }));

    this.timerText = new Konva.Text({
      name: 'timer', x: 0, y: 50, width: 150, fontSize: 20, fontStyle: 'bold', fontFamily: FONT,
    });
    this.board.add(this.timerText);
    this.board.add(new Konva.Rect({
      x: 0, y: TIMER_BAR.y, width: BOARD.width, height: TIMER_BAR.height, cornerRadius: 3, fill: COLOR.panelStroke,
    }));
    this.timerBar = new Konva.Rect({
      name: 'timer-bar', x: 0, y: TIMER_BAR.y, height: TIMER_BAR.height, cornerRadius: 3,
    });
    this.board.add(this.timerBar);
    this.showTime(model.timeLeft);
  }

  /** Updates only the timer, so a tick doesn't rebuild the board under the pointer. */
  setTimeLeft(seconds: number): void {
    this.showTime(seconds);
    this.group.getLayer()?.batchDraw();
  }

  private showTime(seconds: number): void {
    const color = seconds <= TIMER_WARNING ? '#F87171' : COLOR.wireOn;
    this.timerText?.text(`⏱ ${seconds}s`).fill(color);
    this.timerBar?.width(BOARD.width * Math.max(0, seconds) / ROUND_SECONDS).fill(color);
  }

  private drawCircuit(model: GateGuessViewModel): void {
    const clue = model.clues[model.selectedClue];
    const card = new Konva.Group({ x: 40, y: 100 });
    card.add(new Konva.Rect({
      width: 560, height: 270, cornerRadius: 16, fill: COLOR.card, stroke: COLOR.cardStroke, strokeWidth: 2,
    }));
    card.add(new Konva.Text({
      x: 20, y: 14, fontSize: 13, fontFamily: FONT, fill: COLOR.dim,
      text: `SHOWING TEST ${model.selectedClue + 1} OF ${model.clues.length}`,
    }));

    const box = { x: 230, y: 85, width: 130, height: 110 };
    const inputs: [string, number, 0 | 1][] = [['A', 105, clue.a], ['B', 175, clue.b]];
    for (const [name, y, value] of inputs) {
      card.add(new Konva.Text({
        x: 22, y: y - 13, text: '⚡', fontSize: 26, fill: value ? COLOR.wireOn : COLOR.dim,
      }));
      card.add(new Konva.Text({
        x: 56, y: y - 10, text: `${name} = ${value}`, fontSize: 18, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
      }));
      card.add(wire([140, y, box.x, y], value));
    }

    const outY = box.y + box.height / 2;
    card.add(wire([box.x + box.width, outY, 445, outY], clue.out));
    const hidden = model.revealedGate === null;
    card.add(new Konva.Rect({
      ...box, cornerRadius: 14, strokeWidth: 3,
      fill: hidden ? '#F5F3FF' : '#EFF6FF', stroke: hidden ? COLOR.mystery : COLOR.reveal, dash: hidden ? [8, 6] : [],
    }));
    card.add(new Konva.Text({
      name: 'gate-box', ...box, align: 'center', verticalAlign: 'middle', fontFamily: FONT, fontStyle: 'bold',
      text: hidden ? '?' : model.revealedGate!, fontSize: hidden ? 54 : 26, fill: hidden ? COLOR.mystery : COLOR.reveal,
    }));

    const bulb = { x: 475, y: outY };
    if (clue.out) card.add(new Konva.Circle({ ...bulb, radius: 32, fill: '#FEF08A', opacity: 0.6 }));
    card.add(new Konva.Circle({ ...bulb, radius: 25, fill: clue.out ? COLOR.bulbOn : COLOR.bulbOff }));
    card.add(new Konva.Text({ ...bulb, text: '💡', fontSize: 26, offsetX: 13, offsetY: 13 }));
    card.add(new Konva.Text({
      x: bulb.x - 50, y: bulb.y + 38, width: 100, align: 'center', text: `OUT = ${clue.out}`,
      fontSize: 18, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.ink,
    }));
    this.board.add(card);
  }

  private drawClues(model: GateGuessViewModel): void {
    const panel = new Konva.Group({ x: 630, y: 100 });
    panel.add(new Konva.Rect({
      width: 290, height: 270, cornerRadius: 16, fill: COLOR.panel, stroke: COLOR.panelStroke, strokeWidth: 2,
    }));
    panel.add(new Konva.Text({
      x: 20, y: 16, text: 'TESTS', fontSize: 16, fontStyle: 'bold', fontFamily: FONT, fill: COLOR.text,
    }));
    const columns = [{ label: 'A', x: 60 }, { label: 'B', x: 130 }, { label: 'OUT', x: 210 }];
    for (const { label, x } of columns) {
      panel.add(new Konva.Text({
        x: x - 30, y: 50, width: 60, align: 'center', text: label, fontSize: 14, fontFamily: FONT, fill: COLOR.dim,
      }));
    }

    model.clues.forEach((clue, index) => {
      const selected = index === model.selectedClue;
      const row = new Konva.Group({ name: `clue-row-${index}`, x: 14, y: 76 + index * 46 });
      row.add(new Konva.Rect({
        width: 262, height: 38, cornerRadius: 8,
        fill: selected ? '#1E293B' : 'transparent', stroke: selected ? COLOR.wireOn : COLOR.panelStroke,
      }));
      const values = [clue.a, clue.b, clue.out];
      columns.forEach(({ x }, column) => {
        row.add(new Konva.Text({
          x: x - 44, y: 10, width: 60, align: 'center', text: String(values[column]), fontSize: 18,
          fontStyle: 'bold', fontFamily: FONT, fill: column === 2 && values[2] ? COLOR.wireOn : COLOR.text,
        }));
      });
      onPress(row, () => this.handlers.onSelectClue(index));
      panel.add(row);
    });

    panel.add(new Konva.Text({
      x: 20, y: 222, width: 250, fontSize: 12, fontFamily: FONT, fill: COLOR.dim, lineHeight: 1.3,
      text: 'Click a test to show it on the circuit. Guessing a gate that fits every test earns a new one.',
    }));
    this.board.add(panel);
  }

  private drawGateButtons(model: GateGuessViewModel): void {
    const total = GUESS_GATES.length * GATE_BUTTON.width + (GUESS_GATES.length - 1) * GATE_BUTTON.gap;
    const playing = model.action === null;
    GUESS_GATES.forEach((gate, index) => {
      const used = model.guessed.includes(gate) && gate !== model.revealedGate;
      const enabled = playing && !used;
      this.board.add(this.button({
        name: `gate-button-${gate}`,
        x: (BOARD.width - total) / 2 + index * (GATE_BUTTON.width + GATE_BUTTON.gap),
        y: GATE_BUTTON.y, width: GATE_BUTTON.width, height: GATE_BUTTON.height, label: gate, fontSize: 20,
        fill: used ? COLOR.buttonUsed : gate === model.revealedGate ? '#16A34A' : COLOR.button,
        textColor: used ? COLOR.dim : 'black', strike: used,
        onClick: enabled ? () => this.handlers.onGuess(gate) : undefined,
      }));
    });
  }

  private button(options: {
    name: string; x: number; y: number; width: number; height: number; label: string;
    onClick?: () => void; fill?: string; stroke?: string; textColor?: string;
    fontSize?: number; strike?: boolean;
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
      textDecoration: options.strike ? 'line-through' : '',
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

function wire(points: number[], value: 0 | 1): Konva.Line {
  return new Konva.Line({
    points, stroke: value ? COLOR.wireOn : COLOR.wireOff, strokeWidth: value ? 5 : 4, lineCap: 'round',
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
