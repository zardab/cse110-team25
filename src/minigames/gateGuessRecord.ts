import type { StorageLike } from '../persistence/storageAdapter';

export const GATE_GUESS_BEST_KEY = 'cse110-team25:gate-guess-best';

export function browserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The best "Name That Gate" streak saved, or 0 when there is none or it can't be read. */
export function loadBestStreak(storage: StorageLike | null): number {
  try {
    const value = Number(storage?.getItem(GATE_GUESS_BEST_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Saves a streak. Returns false if storage is missing or refuses the write. */
export function saveBestStreak(storage: StorageLike | null, streak: number): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GATE_GUESS_BEST_KEY, String(streak));
    return true;
  } catch {
    return false;
  }
}
