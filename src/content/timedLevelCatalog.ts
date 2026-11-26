import type { LevelConfig } from '../types/circuit';
import { loadLevel } from './levelLoader';
import quickStart from './timedLevels/timed_01_or.json';
import flipIt from './timedLevels/timed_02_flip.json';
import lightsOut from './timedLevels/timed_03_two_lights.json';
import chain from './timedLevels/timed_04_chain.json';
import countdown from './timedLevels/timed_05_countdown.json';

/** Minigame 2's levels, played in order against the clock. Separate from the story levels. */
export const timedLevels: readonly LevelConfig[] =
  [quickStart, flipIt, lightsOut, chain, countdown].map(loadLevel);

/** Seconds on the clock for each timed level; bigger boards get more time. */
export const timedLevelSeconds: Readonly<Record<string, number>> = {
  timed_01_or: 15,
  timed_02_flip: 15,
  timed_03_two_lights: 20,
  timed_04_chain: 25,
  timed_05_countdown: 30,
};
