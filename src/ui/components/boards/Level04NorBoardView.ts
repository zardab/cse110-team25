import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

/** level_04_nor: OR/NOT → NOR, XOR → AND, then OR; bulbs out_V/Z/W/Y */
const LAYOUT: BoardLayout = {
  width: 980,
  height: 460,
  scale: 1.1,
  slotWidth: 110,
  slotHeight: 56,
  inputs: {
    in_A: { x: 60, y: 70 },
    in_B: { x: 60, y: 120 },
    in_C: { x: 60, y: 210 },
    in_D: { x: 60, y: 310 },
    in_E: { x: 60, y: 360 },
    in_F: { x: 60, y: 430 },
  },
  slots: {
    slot_or: { x: 150, y: 70 },
    slot_not: { x: 150, y: 180 },
    slot_xor: { x: 150, y: 310 },
    slot_nor: { x: 380, y: 110 },
    slot_and: { x: 380, y: 330 },
    slot_output: { x: 640, y: 220 },
  },
  outputs: {
    out_V: { x: 300, y: 50 },
    out_Z: { x: 540, y: 80 },
    out_W: { x: 540, y: 370 },
    out_Y: { x: 860, y: 248 },
  },
};

export class Level04NorBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
