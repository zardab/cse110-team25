import Konva from 'konva';
import { describe, expect, it, vi } from 'vitest';
import { faultLevels, faultTutorialLevel } from '../content/faultLevelCatalog';
import { PROGRESS_STORAGE_KEY, StorageAdapter, type StorageLike } from '../persistence/storageAdapter';
import type { ScreenSwitcher } from '../screenTypes';
import { FAULT_FINDER_PROGRESS_KEY, FaultFinderController } from './FaultFinderController';

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

/** Fault Finder progress as the shared adapter would read it back. */
function savedProgress(storage: StorageLike) {
  return new StorageAdapter(storage, FAULT_FINDER_PROGRESS_KEY).getProgress();
}

/** Storage in which the walkthrough has already been seen, so play opens on the level list. */
function seenTutorial(): Record<string, string> {
  const storage = memory();
  new StorageAdapter(storage, FAULT_FINDER_PROGRESS_KEY).saveSummary(faultTutorialLevel.id, { completed: true, stars: 0 });
  return storage.data;
}

/** Starts on the level list; `level` opens that level's card, or null stays on the list. */
function setup(initial: Record<string, string> = seenTutorial(), level: number | null = 0) {
  const switcher: ScreenSwitcher = { switchToScreen: vi.fn() };
  const storage = memory(initial);
  const controller = new FaultFinderController(switcher, 960, 600, { storage });
  const layer = new Konva.Layer();
  layer.add(controller.getView().getGroup());
  controller.start();

  const group = controller.getView().getGroup();
  const find = (name: string) => group.findOne(`.${name}`) as Konva.Group;
  const text = (name: string) => (find(name) as unknown as Konva.Text).text();
  const textIn = (name: string, child: string) => (find(name).findOne(`.${child}`) as Konva.Text | undefined)?.text();
  const click = (name: string) => find(name).fire('click');
  const enabled = (name: string) => find(name).getAttr('enabled') as boolean;
  const label = (name: string) => (find(name).findOne('Text') as Konva.Text).text();
  if (level !== null) click(`level-card-${level}`);
  return { controller, switcher, storage, find, text, textIn, click, enabled, label, game: () => controller.getGame() };
}

describe('FaultFinderController', () => {
  it('opens on a level list showing which levels are solved, with no stars or scores', () => {
    const storage = memory(seenTutorial());
    new StorageAdapter(storage, FAULT_FINDER_PROGRESS_KEY).saveSummary(faultLevels[1].id, { completed: true, stars: 0 });
    const { find, text } = setup(storage.data, null);
    expect(find(`level-card-${faultLevels.length - 1}`)).toBeDefined();
    expect(find('level-card-0').getAttr('completed')).toBe(false);
    expect(find('level-card-1').getAttr('completed')).toBe(true);
    expect(text('solved-count')).toBe('1 / 5 solved');
    expect(find('run-button')).toBeUndefined();
  });

  it('opens the first level stating how many gates are stuck, with no other hints', () => {
    const { text, game, enabled, find, label } = setup();
    expect(game().level.id).toBe(faultLevels[0].id);
    // No instructions or hints: the board, the fault count and the buttons speak for themselves.
    expect(text('message')).toBe('');
    expect(label('run-button')).toContain(`${faultLevels[0].testBudget} left`);
    expect(find('suspects')).toBeUndefined();
    // The number of faulty gates is shown up top in its own banner, and there is no test log.
    expect(text('fault-count')).toContain('1 FAULTY GATE');
    expect(find('test-row-0')).toBeUndefined();
    expect(enabled('run-button')).toBe(true);
    // Nothing is marked yet, so there's nothing to submit.
    expect(enabled('submit-button')).toBe(false);
  });

  it('solves level 1: run a test, read the mismatch, mark the gate, submit', () => {
    // Level 1: AND → Z and OR → Y, with the OR stuck at 1. A=B=0 should give Y=0 but reads 1.
    const { click, text, textIn, find, game, storage } = setup();
    click('run-button');
    expect(game().tests).toHaveLength(1);
    // The result is the lit board itself, with no text explaining it.
    expect(text('message')).toBe('');
    expect(find('bulb-Y').getAttr('actual')).toBe(1);

    click('gate-g_or');
    expect(find('gate-g_or').getAttr('marked')).toBe(true);
    expect(textIn('gate-g_or', 'badge')).toBe('FAULTY');
    click('submit-button');
    expect(game().status).toBe('won');
    expect(text('message')).toBe('Solved!');
    // Saved through the shared adapter, under Fault Finder's own key only.
    expect(savedProgress(storage)[faultLevels[0].id]).toEqual({ completed: true, stars: 0 });
    expect(storage.data[PROGRESS_STORAGE_KEY]).toBeUndefined();
    expect(find('action-button')).toBeDefined();
  });

  it('moves to the next level after a win', () => {
    const { click, game } = setup();
    click('run-button');
    click('gate-g_or');
    click('submit-button');
    click('action-button');
    expect(game().level.id).toBe(faultLevels[1].id);
    expect(game().tests).toEqual([]);
  });

  it('says only "wrong" for a wrong diagnosis, and reveals the answer on loss', () => {
    const { click, text, textIn, find, game } = setup();
    click('run-button');
    click('gate-g_and');
    click('submit-button');
    expect(text('message')).toBe('Wrong. 1 guess left.');
    expect(find('lives').find('.guess-left')).toHaveLength(1);
    expect(find('lives').find('.guess-used')).toHaveLength(1);
    expect(game().mistakes).toBe(1);
    click('submit-button');
    expect(game().status).toBe('lost');
    expect(text('message')).toBe('Out of guesses.');
    // The reveal shows the real fault in green and flags the wrongly marked gate as fine.
    expect(textIn('gate-g_or', 'badge')).toBe('STUCK 1');
    expect(textIn('gate-g_and', 'badge')).toBe('OK');
  });

  it('keeps every wire dark until a test runs, then lights every wire from the faulty board', () => {
    const { click, controller, find, textIn } = setup();
    const wires = () => controller.getView().getGroup().find('.wire').map((node) => node.getAttr('measured'));
    expect(wires().every((value) => value === 'unknown')).toBe(true);
    expect(find('bulb-Y').getAttr('actual') ?? null).toBeNull();
    expect(textIn('bulb-Y', 'bulb-label')).toBe('Y = ?');

    click('run-button');
    // Every wire now carries a measured value, including ones between gates.
    expect(wires().every((value) => value === 0 || value === 1)).toBe(true);
    expect(textIn('bulb-Y', 'bulb-label')).toBe('Y = 1');

    // Changing a switch to untested inputs goes dark again.
    click('switch-A');
    expect(wires().every((value) => value === 'unknown')).toBe(true);
  });

  it('says the minigame is finished after the last level, then returns to the level list', () => {
    const last = faultLevels.length - 1;
    const { click, text, label, find, game } = setup(seenTutorial(), last);
    for (const slotId of Object.keys(game().level.faults)) click(`gate-${slotId}`);
    click('submit-button');
    expect(text('message')).toBe('Solved! You\'ve finished Fault Finder.');
    expect(label('action-button')).toBe('Back to Levels');
    click('action-button');
    expect(find(`level-card-${last}`).getAttr('completed')).toBe(true);
    expect(find('run-button')).toBeUndefined();
  });

  it('goes back from a level to the level list, and from the list to the menu', () => {
    const { click, find, switcher } = setup();
    click('back-button');
    expect(find('level-card-0')).toBeDefined();
    expect(switcher.switchToScreen).not.toHaveBeenCalled();
    click('back-button');
    expect(switcher.switchToScreen).toHaveBeenCalledWith({ type: 'menu' });
  });

  it('opens the walkthrough on the first visit and walks through a full solve', () => {
    const { find, click, text, game, storage } = setup({}, null);
    expect(game().level.id).toBe(faultTutorialLevel.id);
    expect(text('level-title')).toBe('How to Play');
    expect(find('level-button-0')).toBeUndefined();
    expect(text('tutorial-text')).toContain('One gate in this circuit is faulty');
    expect(find('tutorial-highlight')).toBeDefined();

    click('tutorial-next-button');
    expect(text('tutorial-text')).toContain('Click a switch');
    click('switch-A');
    expect(text('tutorial-text')).toContain('Run Test');
    // A=1, B=0: the AND should give 0 but is stuck at 1, so the fault shows.
    click('run-button');
    expect(text('tutorial-text')).toContain('Can you spot it?');
    click('tutorial-next-button');
    click('gate-g_or');
    expect(text('tutorial-text')).toContain('matches its inputs');
    click('gate-g_or');
    click('gate-g_and');
    expect(text('tutorial-text')).toContain('Press Submit');
    click('submit-button');
    expect(text('tutorial-text')).toContain('Solved!');
    expect(find('action-button')).toBeUndefined();

    click('tutorial-next-button');
    expect(find('level-card-0')).toBeDefined();
    // Seen now, and the practice board is never listed or counted as a level.
    expect(savedProgress(storage)[faultTutorialLevel.id].completed).toBe(true);
    expect(text('solved-count')).toBe('0 / 5 solved');
  });

  it('asks for different switches when a test doesn\'t show the fault', () => {
    const { click, text } = setup({}, null);
    click('tutorial-next-button');
    click('switch-A');
    click('switch-B');
    click('run-button'); // A=B=1: AND gives 1 either way.
    expect(text('tutorial-text')).toContain('Every gate looks right');
    click('switch-B');
    expect(text('tutorial-text')).toContain('Press Run Test');
    click('run-button');
    expect(text('tutorial-text')).toContain('Can you spot it?');
  });

  it('can be skipped, and replayed from How to Play', () => {
    const { click, find, game, storage } = setup({}, null);
    click('skip-tutorial-button');
    expect(find('level-card-0')).toBeDefined();
    expect(savedProgress(storage)[faultTutorialLevel.id].completed).toBe(true);
    click('how-to-play-button');
    expect(game().level.id).toBe(faultTutorialLevel.id);
  });

  it('keeps playing when storage is unavailable', () => {
    const switcher: ScreenSwitcher = { switchToScreen: vi.fn() };
    const controller = new FaultFinderController(switcher, 960, 600, { storage: null });
    new Konva.Layer().add(controller.getView().getGroup());
    controller.start();
    // Nothing can be saved, so the walkthrough opens; skipping still reaches the levels.
    expect(controller.getGame().level.id).toBe(faultTutorialLevel.id);
    (controller.getView().getGroup().findOne('.skip-tutorial-button') as Konva.Group).fire('click');
    (controller.getView().getGroup().findOne('.level-card-0') as Konva.Group).fire('click');
    expect(controller.getGame().status).toBe('playing');
  });
});
