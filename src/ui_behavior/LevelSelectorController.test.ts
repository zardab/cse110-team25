import Konva from 'konva';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mainLevels } from '../content/levelCatalog';
import { StorageAdapter } from '../persistence/storageAdapter';
import { LevelSelectorController } from './LevelSelectorController';

const [foundations, xor] = mainLevels;

function levelLabels(selector: LevelSelectorController): Konva.Text[] {
  return selector.getView().getGroup().find<Konva.Text>('Text');
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(Konva.Image, 'fromURL').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

it('refreshes completion by level ID and keeps completed levels playable', () => {
  const storage = new StorageAdapter();
  const onSelect = vi.fn();
  // Use a different order from the game catalog to verify lookup by ID.
  const levels = [xor, foundations];
  const selector = new LevelSelectorController(960, 600, levels, onSelect, storage);

  selector.start();
  expect(levelLabels(selector).map((label) => label.text())).toEqual(['Level 1', 'Level 2']);

  expect(storage.saveLevel(xor, { completed: false, stars: 0, placements: {} })).toBe(true);
  expect(storage.saveLevel(foundations, { completed: true, stars: 0, placements: {} })).toBe(true);
  selector.start();

  const labels = levelLabels(selector);
  expect(labels.map((label) => label.text())).toEqual(['Level 1', 'Level 2 · Completed']);
  labels[1].getParent()?.fire('click');
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith(foundations.id);

  const reloaded = new LevelSelectorController(960, 600, levels, onSelect, new StorageAdapter());
  reloaded.start();
  expect(levelLabels(reloaded).map((label) => label.text())).toEqual(['Level 1', 'Level 2 · Completed']);
});
