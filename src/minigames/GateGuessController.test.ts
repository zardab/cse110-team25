import Konva from 'konva';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GateGuessController } from './GateGuessController';
import { GUESS_GATES, MAX_LIVES, ROUND_SECONDS, fits, type GuessGate } from './gateGuess';
import { GATE_GUESS_BEST_KEY } from './gateGuessRecord';
import type { StorageLike } from '../persistence/storageAdapter';
import type { ScreenSwitcher } from '../screenTypes';

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function setup(initial: Record<string, string> = {}, { pressStart = true } = {}) {
  const switcher: ScreenSwitcher = { switchToScreen: vi.fn() };
  const storage = memory(initial);
  // A fixed sequence keeps the hidden gates and tests the same on every run.
  let n = 0;
  const rng = () => ((n++ * 0.37) % 1);
  const controller = new GateGuessController(switcher, 960, 600, { rng, storage });
  const layer = new Konva.Layer();
  layer.add(controller.getView().getGroup());
  controller.start();

  const group = controller.getView().getGroup();
  const find = (name: string) => group.findOne(`.${name}`) as Konva.Node;
  const text = (name: string) => (find(name) as Konva.Text).text();
  const click = (name: string) => find(name).fire('click');
  if (pressStart) click('start-button');
  const enabled = (name: string) => find(name).getAttr('enabled') as boolean;
  // Full and empty hearts, e.g. "2/1" for two lives left of three.
  const hearts = () => {
    const lives = find('lives') as Konva.Group;
    return `${lives.find('.heart-full').length}/${lives.find('.heart-empty').length}`;
  };
  const round = () => controller.getSession().round;
  const wrongGate = (): GuessGate => GUESS_GATES.find((gate) => !fits(gate, round().clues))!;
  const fittingGate = () =>
    GUESS_GATES.find((gate) => gate !== round().answer && fits(gate, round().clues));
  return { controller, switcher, storage, find, text, click, enabled, hearts, round, wrongGate, fittingGate };
}

describe('GateGuessController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('how to play screen', () => {
    it('opens on the instructions with a START button and no game running', () => {
      const s = setup({ [GATE_GUESS_BEST_KEY]: '7' }, { pressStart: false });
      const group = s.controller.getView().getGroup();
      const allText = group.find('Text').map((node) => (node as Konva.Text).text()).join('\n');
      expect(allText).toContain('HOW TO PLAY');
      expect(allText).toContain('Fits so far');
      expect(allText).toContain(`${MAX_LIVES} lives and ${ROUND_SECONDS} seconds`);
      expect(s.find('cheat-sheet')).toBeTruthy();
      expect(s.text('intro-best')).toBe('BEST STREAK 7');
      expect(s.enabled('start-button')).toBe(true);
      expect(s.find('gate-box')).toBeUndefined();
      expect(s.find('gate-button-AND')).toBeUndefined();
      expect(s.find('timer')).toBeUndefined();
    });

    it('does not run the clock until START is pressed', () => {
      const s = setup({}, { pressStart: false });
      vi.advanceTimersByTime(ROUND_SECONDS * 3000);
      s.click('start-button');
      expect(s.controller.getSession().status).toBe('playing');
      expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS}s`);
      expect(s.text('gate-box')).toBe('?');
    });

    it('can go back to the main menu without starting', () => {
      const s = setup({}, { pressStart: false });
      s.click('back-button');
      expect(s.switcher.switchToScreen).toHaveBeenCalledWith({ type: 'menu' });
    });

    it('shows the instructions again on every visit, but Play Again skips them', () => {
      const s = setup();
      s.controller.stop();
      s.controller.start();
      expect(s.find('start-button')).toBeTruthy();
      expect(s.find('gate-box')).toBeUndefined();

      s.click('start-button');
      vi.advanceTimersByTime(ROUND_SECONDS * 1000);
      expect(s.controller.getSession().status).toBe('lost');
      s.click('action-button');
      expect(s.find('start-button')).toBeUndefined();
      expect(s.controller.getSession().status).toBe('playing');
    });
  });

  it('starts with the gate hidden, one test and every gate button enabled', () => {
    const { text, enabled, find, round, hearts } = setup();
    expect(text('gate-box')).toBe('?');
    expect(text('message')).toContain('Which gate is it?');
    expect(hearts()).toBe(`${MAX_LIVES}/0`);
    expect(find('clue-row-0')).toBeTruthy();
    expect(find('clue-row-1')).toBeUndefined();
    expect(find('action-button')).toBeUndefined();
    for (const gate of GUESS_GATES) expect(enabled(`gate-button-${gate}`)).toBe(true);
    expect(round().clues).toHaveLength(1);
  });

  it('reveals the gate, offers the next circuit and saves the best streak on a correct guess', () => {
    const { click, text, find, round, storage, enabled } = setup();
    const answer = round().answer;
    click(`gate-button-${answer}`);
    expect(text('gate-box')).toBe(answer);
    expect(text('message')).toContain(`Correct, it's ${answer}`);
    expect(text('score')).toContain('STREAK 1');
    expect(storage.data[GATE_GUESS_BEST_KEY]).toBe('1');
    for (const gate of GUESS_GATES) expect(enabled(`gate-button-${gate}`)).toBe(false);

    click('action-button');
    expect(round().answer).not.toBe(answer);
    expect(text('gate-box')).toBe('?');
    expect(find('action-button')).toBeUndefined();
  });

  it('adds a test, shows it and costs no life when the guess fits so far', () => {
    const s = setup();
    // Any single test fits three gates, so there is always a wrong one that fits.
    const gate = s.fittingGate()!;
    s.click(`gate-button-${gate}`);
    expect(s.text('message')).toContain(`${gate} fits so far`);
    expect(s.hearts()).toBe(`${MAX_LIVES}/0`);
    expect(s.find('clue-row-1')).toBeTruthy();
    expect(s.text('gate-box')).toBe('?');
    expect(s.enabled(`gate-button-${gate}`)).toBe(false);
  });

  it('explains a wrong guess and takes a life', () => {
    const s = setup();
    const gate = s.wrongGate();
    s.click(`gate-button-${gate}`);
    expect(s.text('message')).toContain(`${gate} doesn't fit`);
    expect(s.text('message')).toContain(`${MAX_LIVES - 1} lives left`);
    expect(s.hearts()).toBe(`${MAX_LIVES - 1}/1`);
    // Lost lives use the same glyph and size as the full hearts, drawn as an outline.
    const [full, empty] = [s.find('heart-full') as Konva.Text, s.find('heart-empty') as Konva.Text];
    expect(empty.text()).toBe(full.text());
    expect(empty.fontSize()).toBe(full.fontSize());
  });

  it('ends the run after the last life and starts over on Play Again', () => {
    const s = setup({ [GATE_GUESS_BEST_KEY]: '4' });
    const answer = s.round().answer;
    for (let i = 0; i < MAX_LIVES; i += 1) {
      // Only three gates contradict any single test, so a run of wrong guesses needs fresh ones.
      const wrong = GUESS_GATES.find((gate) => !fits(gate, s.round().clues) && !s.round().guessed.includes(gate))!;
      s.click(`gate-button-${wrong}`);
    }
    expect(s.text('message')).toContain(`It was ${answer}`);
    expect(s.text('gate-box')).toBe(answer);
    expect(s.text('score')).toContain('BEST 4');

    s.click('action-button');
    expect(s.controller.getSession()).toMatchObject({ lives: MAX_LIVES, streak: 0, status: 'playing' });
    expect(s.text('gate-box')).toBe('?');
  });

  it('shows the clicked test on the circuit', () => {
    const s = setup();
    s.click(`gate-button-${s.fittingGate()!}`);
    const [first] = s.round().clues;
    s.click('clue-row-0');
    const card = s.find('gate-box').getParent()!;
    const labels = card.find('Text').map((node) => (node as Konva.Text).text());
    expect(labels).toContain(`A = ${first.a}`);
    expect(labels).toContain(`B = ${first.b}`);
    expect(labels).toContain(`OUT = ${first.out}`);
    expect(labels).toContain('SHOWING TEST 1 OF 2');
  });

  it('goes back to the main menu', () => {
    const { click, switcher } = setup();
    click('back-button');
    expect(switcher.switchToScreen).toHaveBeenCalledWith({ type: 'menu' });
  });

  describe('back button hit area', () => {
    // `fire('click')` skips Konva's hit detection, so these tests put the view on a real
    // stage and check what is actually under the pointer. Text drawn over the button
    // (like the full-width title) used to swallow clicks below the button's top edge.
    function onStage() {
      const s = setup();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const stage = new Konva.Stage({ container, width: 960, height: 600 });
      stage.add(s.find('back-button').getLayer()!);
      s.controller.getView().show();
      // Layers normally redraw on the next animation frame, which fake timers hold back.
      stage.draw();
      const back = s.find('back-button') as Konva.Group;
      const rect = back.getClientRect();
      const destroy = () => { stage.destroy(); container.remove(); };
      return { ...s, stage, back, rect, destroy };
    }

    /** Points spread across the button, kept 2px inside its edges so the stroke can't decide them. */
    function pointsAcross(rect: { x: number; y: number; width: number; height: number }) {
      const points: { x: number; y: number }[] = [];
      for (const fx of [0, 0.25, 0.5, 0.75, 1]) {
        for (const fy of [0, 0.25, 0.5, 0.75, 1]) {
          points.push({ x: rect.x + 2 + (rect.width - 4) * fx, y: rect.y + 2 + (rect.height - 4) * fy });
        }
      }
      return points;
    }

    it('has the back button on top everywhere across it', () => {
      const { stage, back, rect, destroy } = onStage();
      const missed = pointsAcross(rect).filter((point) => {
        const hit = stage.getIntersection(point);
        return !hit || !back.isAncestorOf(hit);
      });
      destroy();
      expect(missed).toEqual([]);
    });

    it('goes back to the main menu when the bottom of the button is clicked', () => {
      const { stage, rect, switcher, destroy } = onStage();
      const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height - 4 };
      // Konva turns mousedown + mouseup on the same shape into the `click` the button listens for.
      const init = { clientX: point.x, clientY: point.y, bubbles: true };
      stage.content.dispatchEvent(new MouseEvent('mousedown', init));
      stage.content.dispatchEvent(new MouseEvent('mouseup', init));
      destroy();
      expect(switcher.switchToScreen).toHaveBeenCalledWith({ type: 'menu' });
    });
  });

  it('counts down from 15 seconds and ends the run when time runs out', () => {
    const s = setup();
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS}s`);
    vi.advanceTimersByTime(4000);
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS - 4}s`);

    const answer = s.round().answer;
    vi.advanceTimersByTime((ROUND_SECONDS - 4) * 1000);
    expect(s.controller.getSession().status).toBe('lost');
    expect(s.text('message')).toContain(`Time's up! It was ${answer}`);
    expect(s.text('gate-box')).toBe(answer);
    expect(s.text('timer')).toBe('⏱ 0s');
    for (const gate of GUESS_GATES) expect(s.enabled(`gate-button-${gate}`)).toBe(false);

    s.click('action-button');
    expect(s.controller.getSession().status).toBe('playing');
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS}s`);
  });

  it('resets the timer for the next circuit after a correct guess, and pauses until then', () => {
    const s = setup();
    vi.advanceTimersByTime(10_000);
    s.click(`gate-button-${s.round().answer}`);
    // Waiting on the Next button never times out.
    vi.advanceTimersByTime(60_000);
    expect(s.controller.getSession().status).toBe('won');
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS - 10}s`);

    s.click('action-button');
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS}s`);
    vi.advanceTimersByTime((ROUND_SECONDS - 1) * 1000);
    expect(s.controller.getSession().status).toBe('playing');
  });

  it('keeps counting through guesses that fit so far or are wrong', () => {
    const s = setup();
    vi.advanceTimersByTime(3000);
    s.click(`gate-button-${s.fittingGate()!}`);
    s.click(`gate-button-${s.wrongGate()}`);
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS - 3}s`);
    vi.advanceTimersByTime(2000);
    expect(s.text('timer')).toBe(`⏱ ${ROUND_SECONDS - 5}s`);
  });

  it('stops the clock when the screen is left', () => {
    const s = setup();
    s.controller.stop();
    vi.advanceTimersByTime(ROUND_SECONDS * 2000);
    expect(s.controller.getSession().status).toBe('playing');
  });
});
