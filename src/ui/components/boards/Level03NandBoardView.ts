import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

/** level_03_nand: AND/OR → NAND → AND, plus NOT branch; bulbs out_Z, out_W, out_Y */
const LAYOUT: BoardLayout = {
  width: 960,
  height: 460,
  scale: 1,
  slotWidth: 110,
  slotHeight: 56,
  inputs: {
    in_A: { x: 70, y: 80 },
    in_B: { x: 70, y: 140 },
    in_C: { x: 70, y: 240 },
    in_D: { x: 70, y: 300 },
    in_E: { x: 70, y: 400 },
  },
  slots: {
    slot_and_left: { x: 160, y: 80 },
    slot_or_right: { x: 160, y: 240 },
    slot_nand: { x: 380, y: 150 },
    slot_not: { x: 380, y: 370 },
    slot_output: { x: 680, y: 240 },
  },
  outputs: {
    out_Z: { x: 540, y: 90 },
    out_W: { x: 540, y: 430 },
    out_Y: { x: 880, y: 268 },
  },
};

export class Level03NandBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
