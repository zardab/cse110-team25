import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

const LAYOUT: BoardLayout = {
  width: 960,
  height: 410,
  slotWidth: 104,
  slotHeight: 50,
  inputs: {
    in_A: { x: 51, y: 66 },
    in_B: { x: 51, y: 111 },
    in_C: { x: 51, y: 169 },
    in_D: { x: 51, y: 215 },
    in_E: { x: 51, y: 278 },
    in_F: { x: 51, y: 332 },
  },
  slots: {
    slot_p: { x: 130, y: 65 },
    slot_q: { x: 130, y: 164 },
    slot_r: { x: 130, y: 281 },
    slot_s: { x: 406, y: 124 },
    slot_t: { x: 458, y: 273 },
    slot_output: { x: 708, y: 199 },
  },
  outputs: {
    out_U: { x: 297, y: 57 },
    out_V: { x: 298, y: 237 },
    out_X: { x: 299, y: 262 },
    out_W: { x: 614, y: 333 },
    out_Y: { x: 875, y: 224 },
  },
};

export class Level09SharedBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
