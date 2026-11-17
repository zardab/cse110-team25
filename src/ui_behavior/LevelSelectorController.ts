
import type { ScreenController } from "../screenTypes.ts";
import { LevelSelectorView } from "./LevelSelectorView.ts";
import type { LevelConfig } from "../types/circuit";

export class LevelSelectorController implements ScreenController {
  private view: LevelSelectorView;

  constructor(
    width: number,
    height: number,
    levels: readonly LevelConfig[],
    onStartCutscene: (levelId: string) => void,
  ) {
    this.view = new LevelSelectorView(
      width,
      height,
      levels,
      onStartCutscene,
    );
  }

  getView(): LevelSelectorView {
    return this.view;
  }
}
