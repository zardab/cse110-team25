import { loadFaultLevel, type FaultLevel } from './faultLevelLoader';
import twoLines from './faultLevels/fault_01_two_lines.json';
import behindTheAnd from './faultLevels/fault_02_behind_the_and.json';
import needle from './faultLevels/fault_03_needle.json';
import deepChain from './faultLevels/fault_04_deep_chain.json';
import doubleFault from './faultLevels/fault_05_double_fault.json';

export const faultLevels: readonly FaultLevel[] =
  [twoLines, behindTheAnd, needle, deepChain, doubleFault].map(loadFaultLevel);
