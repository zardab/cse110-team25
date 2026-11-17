import type { LevelConfig } from '../types/circuit';
import { loadLevel } from './levelLoader';
import foundations from './levels/level_01_foundations.json';
import xor from './levels/level_02_xor.json';
import nand from './levels/level_03_nand.json';
import nor from './levels/level_04_nor.json';
import xnor from './levels/level_05_xnor.json';

export const mainLevels: readonly LevelConfig[] =
  [foundations, xor, nand, nor, xnor].map(loadLevel);
