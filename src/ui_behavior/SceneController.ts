
import Konva from "konva";
import type {
  ScreenId,
  ScreenController,
  ScreenSwitcher,
} from "../screenTypes.ts";

import { MainMenuController } from "./MainMenuController.ts";
import { Cutscene1Controller } from "../Cutscenes/Cutscene1/Cutscene1Controller.ts";
import { LevelSelectorController } from "./LevelSelectorController.ts";
import { mainLevels } from "../content/levelCatalog";
import type { LevelConfig } from "../types/circuit";

type KonvaScreenId = Exclude<ScreenId["type"], "level1">;

export class SceneController implements ScreenSwitcher {
  private stage: Konva.Stage;
  private layer = new Konva.Layer();
  private screens: Record<KonvaScreenId, ScreenController>;

  constructor(private onLevel: (level: LevelConfig) => void) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.stage = new Konva.Stage({
      container: "container",
      width,
      height,
    });

    this.stage.add(this.layer);

    this.screens = {
      menu: new MainMenuController(this, width, height),

      cutscene1: new Cutscene1Controller(
        width,
        height,
        () => this.switchToScreen({ type: "levelSelector" }),
      ),

      levelSelector: new LevelSelectorController(
        width,
        height,
        mainLevels,
        (id) => this.openLevel(id),
      ),
    };

    for (const screen of Object.values(this.screens)) {
      this.layer.add(screen.getView().getGroup());
    }

    this.switchToScreen({ type: "menu" });
  }

  switchToScreen(screen: ScreenId): void {
    if (screen.type === "level1") {
      this.openLevel(mainLevels[0].id);
      return;
    }

    for (const [name, controller] of Object.entries(this.screens)) {
      if (name === screen.type) {
        controller.getView().show();
      } else {
        controller.stop?.();
        controller.getView().hide();
      }
    }

    this.screens[screen.type].start?.();
  }

  private openLevel(id: string): void {
    const level = mainLevels.find((candidate) => candidate.id === id);
    if (!level) return;
    for (const controller of Object.values(this.screens)) {
      controller.stop?.();
      controller.getView().hide();
    }

    this.onLevel(level);
  }

  destroy(): void {
    for (const controller of Object.values(this.screens)) {
      controller.stop?.();
    }

    this.stage.destroy();
  }
}
