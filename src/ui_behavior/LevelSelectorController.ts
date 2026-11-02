
import type { ScreenController } from "../screenTypes.ts";
import { LevelSelectorView } from "./LevelSelectorView.ts";

/**
 * LevelSelectorController - Handles level selector interactions
 */
export class LevelSelectorController implements ScreenController {
  private view: LevelSelectorView;

  constructor(
    width: number,
    height: number,
    private onLevel1: () => void,
  ) {
    this.view = new LevelSelectorView(
      width,
      height,
      (levelId) => this.handleLevelClick(levelId),
    );
  }

  private handleLevelClick(levelId: string): void {
    if (levelId === "level1") {
      this.onLevel1();
    }
  }

  getView(): LevelSelectorView {
    return this.view;
  }
}
