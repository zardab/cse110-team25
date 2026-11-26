import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

const LAYOUT: BoardLayout = {
  width: 870,
  height: 340,
  slotWidth: 112,
  slotHeight: 52,
  inputs: {
    in_A: { x: 52, y: 81 },
    in_B: { x: 52, y: 240 },
    in_C: { x: 52, y: 99 },
  },
  slots: {
    slot_and: { x: 130, y: 64 },
    slot_nand_tied: { x: 335, y: 64 },
    slot_nor_tied: { x: 335, y: 214 },
    slot_output: { x: 585, y: 139 },
  },
  outputs: {
    out_Z: { x: 495, y: 56 },
    out_W: { x: 495, y: 274 },
    out_Y: { x: 765, y: 165 },
  },
};

export class Level07TiedBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
