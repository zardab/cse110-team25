
import type { ScreenController } from "../screenTypes.ts";
import { LevelSelectorView } from "./LevelSelectorView.ts";
import type { LevelConfig } from "../types/circuit";

/**
 * LevelSelectorController - Handles level selector interactions
 */
export class LevelSelectorController implements ScreenController {
  private view: LevelSelectorView;

  constructor(
    width: number,
    height: number,
    levels: readonly LevelConfig[],
    onLevelClick: (id: string) => void,
  ) {
    this.view = new LevelSelectorView(
      width,
      height,
      levels,
      onLevelClick,
    );
  }

  getView(): LevelSelectorView {
    return this.view;
  }
}
