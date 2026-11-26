import { describe, expect, it } from 'vitest';
import { mainLevels } from './levelCatalog';
import { lintLevel } from './levelLinter';
import { timedLevelSeconds, timedLevels } from './timedLevelCatalog';

describe('Minigame 2 level catalog', () => {
  it('has five levels with unique IDs that do not clash with the story levels', () => {
    const ids = timedLevels.map((level) => level.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    const storyIds = new Set(mainLevels.map((level) => level.id));
    expect(ids.filter((id) => storyIds.has(id))).toEqual([]);
  });

  it('gives every level a positive clock', () => {
    for (const level of timedLevels) {
      expect(timedLevelSeconds[level.id]).toBeGreaterThan(0);
    }
  });

  it.each(timedLevels.map((level) => [level.id, level] as const))('%s is solvable', (_id, level) => {
    expect(() => lintLevel(level)).not.toThrow();
  });
});
