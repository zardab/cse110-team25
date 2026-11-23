import Konva from 'konva';
import { describe, expect, it, vi } from 'vitest';
import { faultLevels } from '../content/faultLevelCatalog';
import type { StorageLike } from '../persistence/storageAdapter';
import type { ScreenSwitcher } from '../screenTypes';
import { FaultFinderController } from './FaultFinderController';
import { FAULT_FINDER_BEST_KEY } from './faultFinderRecord';

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function setup(initial: Record<string, string> = {}) {
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
  return { controller, switcher, storage, find, text, textIn, click, enabled, game: () => controller.getGame() };
}

describe('FaultFinderController', () => {
  it('opens the first level with its briefing and a full budget', () => {
    const { text, game, enabled } = setup();
    expect(game().level.id).toBe(faultLevels[0].id);
    expect(text('message')).toBe(faultLevels[0].briefing);
    expect(text('status')).toContain(`TESTS ${faultLevels[0].testBudget}`);
    expect(text('suspects')).toBe('SUSPECTS LEFT: 4');
    expect(enabled('run-button')).toBe(true);
    // Nothing is marked yet, so there's nothing to submit.
    expect(enabled('submit-button')).toBe(false);
  });

  it('solves level 1: run a test, read the mismatch, mark the gate, submit', () => {
    // Level 1: AND → Z and OR → Y, with the OR stuck at 1. A=B=0 should give Y=0 but reads 1.
    const { click, text, find, game, storage } = setup();
    click('run-button');
    expect(game().tests).toHaveLength(1);
    expect(text('message')).toContain('Y should be 0 but reads 1');
    expect(find('bulb-Y').getAttr('actual')).toBe(1);
    expect(text('suspects')).toBe('SUSPECTS LEFT: 1');

    click('gate-g_or');
    click('gate-g_or');
    expect(find('gate-g_or').getAttr('mark')).toBe(1);
    click('submit-button');
    expect(game().status).toBe('won');
    expect(text('message')).toContain('Solved in 1 test.');
    expect(JSON.parse(storage.data[FAULT_FINDER_BEST_KEY])).toEqual({ [faultLevels[0].id]: 1 });
    expect(find('action-button')).toBeDefined();
  });

  it('moves to the next level after a win and remembers the best score', () => {
    const { click, text, game } = setup({ [FAULT_FINDER_BEST_KEY]: JSON.stringify({ [faultLevels[0].id]: 2 }) });
    expect(text('status')).toContain('BEST 2');
    click('run-button');
    click('gate-g_or');
    click('gate-g_or');
    click('submit-button');
    click('action-button');
    expect(game().level.id).toBe(faultLevels[1].id);
    expect(game().tests).toEqual([]);
  });

  it('charges a mistake for a diagnosis that contradicts a test, and reveals on loss', () => {
    const { click, text, textIn, game } = setup();
    click('run-button');
    click('gate-g_and'); // AND stuck at 0 can't explain Y=1.
    click('submit-button');
    expect(text('message')).toContain('test 1');
    expect(game().mistakes).toBe(1);
    click('submit-button');
    expect(game().status).toBe('lost');
    expect(text('message')).toContain('The answer was G2 (OR) stuck at 1');
    // The reveal shows the real fault in green and flags the wrongly marked gate as fine.
    expect(textIn('gate-g_or', 'badge')).toBe('STUCK 1');
    expect(textIn('gate-g_and', 'badge')).toBe('OK');
  });

  it('attaches a probe and reads it on later tests', () => {
    const { click, text, textIn, game } = setup();
    click('level-button-1');
    expect(game().level.id).toBe('fault_02_behind_the_and');
    click('switch-A');
    click('switch-C');
    click('probe-g_xor');
    expect(game().probes).toEqual(['g_xor']);
    expect(text('message')).toContain('Probe attached to G1 (XOR)');
    click('run-button');
    expect(game().tests[0].readings).toEqual({ g_xor: 1 });
    expect(textIn('probe-g_xor', 'reading')).toBe('G1=1');
    // Only the AND stuck at 0 explains Z=0 with the XOR reading 1.
    expect(text('suspects')).toBe('SUSPECTS LEFT: 1');
  });

  it('recalls a logged test onto the switches when its row is clicked', () => {
    const { click, find, game } = setup();
    click('switch-A');
    click('run-button');
    click('switch-A');
    expect(game().inputs.A).toBe(0);
    click('test-row-0');
    expect(game().inputs.A).toBe(1);
    expect(find('switch-A').getAttr('value')).toBe(1);
  });

  it('goes back to the menu', () => {
    const { click, switcher } = setup();
    click('back-button');
    expect(switcher.switchToScreen).toHaveBeenCalledWith({ type: 'menu' });
  });
});
