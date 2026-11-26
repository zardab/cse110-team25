import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

const LAYOUT: BoardLayout = {
  width: 940,
  height: 390,
  slotWidth: 104,
  slotHeight: 50,
  inputs: {
    in_A: { x: 50, y: 42 },
    in_B: { x: 50, y: 110 },
    in_C: { x: 50, y: 199 },
    in_D: { x: 50, y: 216 },
    in_E: { x: 50, y: 316 },
  },
  slots: {
    slot_xor_ab: { x: 114, y: 77 },
    slot_xor_cd: { x: 114, y: 182 },
    slot_compare: { x: 310, y: 130 },
    slot_not: { x: 310, y: 290 },
    slot_gate: { x: 509, y: 218 },
    slot_output: { x: 727, y: 108 },
  },
  outputs: {
    out_Z: { x: 451, y: 116 },
    out_W: { x: 650, y: 281 },
    out_Y: { x: 864, y: 133 },
  },
};

export class Level08MirrorBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
