import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

const LAYOUT: BoardLayout = {
  width: 800,
  height: 340,
  slotWidth: 116,
  slotHeight: 52,
  inputs: {
    in_A: { x: 56, y: 88 },
    in_B: { x: 56, y: 114 },
    in_C: { x: 56, y: 223 },
    in_D: { x: 56, y: 249 },
  },
  slots: {
    slot_left: { x: 145, y: 75 },
    slot_right: { x: 145, y: 210 },
    slot_output: { x: 465, y: 143 },
  },
  outputs: {
    out_X: { x: 313, y: 63 },
    out_Z: { x: 313, y: 274 },
    out_Y: { x: 695, y: 169 },
  },
};

export class Level06ChoicesBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
