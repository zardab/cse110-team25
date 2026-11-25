import type { GateType, LevelConfig } from '../types/circuit';
import { loadLevel } from './levelLoader';
import foundations from './levels/level_01_foundations.json';
import xor from './levels/level_02_xor.json';
import nand from './levels/level_03_nand.json';
import nor from './levels/level_04_nor.json';
import xnor from './levels/level_05_xnor.json';

export const mainLevels: readonly LevelConfig[] =
  [foundations, xor, nand, nor, xnor].map(loadLevel);

/** Gates each main level introduces (pre-board intro carousel, in order). */
export const levelIntroGates: Readonly<Record<string, readonly GateType[]>> = {
  level_01_foundations: ['AND', 'OR', 'NOT'],
  level_02_xor: ['XOR'],
  level_03_nand: ['NAND'],
  level_04_nor: ['NOR'],
  level_05_xnor: ['XNOR'],
};
