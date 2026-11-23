import type { StorageLike } from '../persistence/storageAdapter';

export const FAULT_FINDER_BEST_KEY = 'cse110-team25:fault-finder-best';

/** Fewest tests the player has solved each level in, keyed by level ID. */
export type BestTests = Readonly<Record<string, number>>;

export function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadBestTests(storage: StorageLike | null): BestTests {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(FAULT_FINDER_BEST_KEY) ?? '');
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, number] => Number.isSafeInteger(entry[1]) && (entry[1] as number) > 0));
  } catch {
    return {};
  }
}

/** Records `tests` for the level if it beats the saved score. Returns the resulting table. */
export function recordBest(storage: StorageLike | null, best: BestTests, levelId: string, tests: number): BestTests {
  if (Object.hasOwn(best, levelId) && best[levelId] <= tests) return best;
  const next = { ...best, [levelId]: tests };
  try {
    storage?.setItem(FAULT_FINDER_BEST_KEY, JSON.stringify(next));
  } catch {
    // Storage may be full or disabled; the score still counts for this session.
  }
  return next;
}
