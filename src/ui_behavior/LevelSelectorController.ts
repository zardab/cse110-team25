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

  //Changes to level 1 when the level button is pressed
  private handleLevelClick(levelId: string): void {
    if (levelId === "level1") {
      this.onLevel1();
    }
  }

  //for view modification
  getView(): LevelSelectorView {
    return this.view;
  }
}
