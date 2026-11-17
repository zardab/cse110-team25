import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

/** Fixed layout for level_01_foundations: NOT → AND → OR → out_Y */
const LAYOUT: BoardLayout = {
  width: 850,
  height: 420,
  inputs: {
    in_A: { x: 105, y: 160 },
    in_B: { x: 105, y: 260 },
    in_C: { x: 105, y: 340 },
  },
  slots: {
    slot_not: { x: 200, y: 128 },
    slot_and: { x: 400, y: 180 },
    slot_or: { x: 600, y: 220 },
  },
  outputs: {
    out_Y: { x: 780, y: 252 },
  },
};

export class Level01FoundationsBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
