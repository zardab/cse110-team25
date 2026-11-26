
import type { ScreenController } from "../screenTypes.ts";
import { LevelSelectorView } from "./LevelSelectorView.ts";
import type { StorageAdapter } from "../persistence/storageAdapter";
import type { LevelConfig } from "../types/circuit";

export class LevelSelectorController implements ScreenController {
  private view: LevelSelectorView;

  constructor(
    width: number,
    height: number,
    levels: readonly LevelConfig[],
    onStartCutscene: (levelId: string) => void,
    private readonly storage: Pick<StorageAdapter, "getProgress">,
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

  start(): void {
    this.view.updateProgress(this.storage.getProgress());
  }
}
