import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

const LAYOUT: BoardLayout = {
  width: 960,
  height: 410,
  slotWidth: 104,
  slotHeight: 50,
  inputs: {
    in_A: { x: 48, y: 49 },
    in_B: { x: 48, y: 70 },
    in_C: { x: 48, y: 135 },
    in_D: { x: 48, y: 156 },
    in_E: { x: 48, y: 223 },
    in_F: { x: 48, y: 244 },
    in_G: { x: 48, y: 321 },
    in_H: { x: 665, y: 293 },
  },
  slots: {
    slot_and_ab: { x: 115, y: 35 },
    slot_xor_cd: { x: 115, y: 122 },
    slot_or_ef: { x: 115, y: 210 },
    slot_not_g: { x: 115, y: 296 },
    slot_m1: { x: 337, y: 83 },
    slot_m2: { x: 337, y: 262 },
    slot_m3: { x: 553, y: 169 },
    slot_output: { x: 763, y: 169 },
  },
  outputs: {
    out_V: { x: 488, y: 76 },
    out_W: { x: 488, y: 325 },
    out_X: { x: 703, y: 151 },
    out_Y: { x: 899, y: 194 },
  },
};

export class Level10FinaleBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
