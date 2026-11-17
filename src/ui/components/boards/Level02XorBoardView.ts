import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

/** level_02_xor: OR + NOT → XOR → AND, bulbs out_Z and out_Y */
const LAYOUT: BoardLayout = {
  width: 880,
  height: 400,
  scale: 1,
  inputs: {
    in_A: { x: 80, y: 100 },
    in_B: { x: 80, y: 160 },
    in_C: { x: 80, y: 270 },
    in_D: { x: 80, y: 360 },
  },
  slots: {
    slot_or: { x: 180, y: 100 },
    slot_not: { x: 180, y: 240 },
    slot_xor: { x: 400, y: 160 },
    slot_and: { x: 620, y: 230 },
  },
  outputs: {
    out_Z: { x: 560, y: 110 },
    out_Y: { x: 800, y: 258 },
  },
};

export class Level02XorBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
