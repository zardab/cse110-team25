import { FixedLayoutBoardView, type BoardLayout, type BoardViewOptions } from './FixedLayoutBoardView';

/**
 * level_05_xnor — tighter footprint so the final bulb stays on-canvas.
 * Intermediate bulbs sit just above/below their gate exits (stubs), not on
 * the continuing horizontal feeds. in_H is parked near the final AND.
 */
const LAYOUT: BoardLayout = {
  width: 900,
  height: 400,
  scale: 1.2,
  slotWidth: 92,
  slotHeight: 46,
  inputs: {
    in_A: { x: 36, y: 36 },
    in_B: { x: 36, y: 64 },
    in_C: { x: 36, y: 118 },
    in_D: { x: 36, y: 146 },
    in_E: { x: 36, y: 210 },
    in_F: { x: 36, y: 250 },
    in_G: { x: 36, y: 310 },
    // Keep H near the final gate so its feed doesn't cross the whole board.
    in_H: { x: 700, y: 370 },
  },
  slots: {
    slot_and: { x: 90, y: 28 },
    slot_or: { x: 90, y: 108 },
    slot_xor: { x: 90, y: 205 },
    slot_nor: { x: 90, y: 290 },
    slot_nand: { x: 290, y: 130 },
    slot_not: { x: 290, y: 245 },
    slot_xnor: { x: 450, y: 205 },
    slot_or_final: { x: 600, y: 145 },
    slot_output: { x: 750, y: 175 },
  },
  outputs: {
    // Short stubs above/below gate outputs — not in the gate-to-gate corridors.
    out_V: { x: 200, y: 14 },
    out_W: { x: 200, y: 94 },
    out_X: { x: 200, y: 350 },
    out_Z: { x: 560, y: 175 },
    out_Y: { x: 860, y: 198 },
  },
};

export class Level05XnorBoardView extends FixedLayoutBoardView {
  constructor(options: BoardViewOptions) {
    super(options, LAYOUT);
  }
}
