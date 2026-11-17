
import Konva from "konva";
import type {
  ScreenId,
  ScreenController,
  ScreenSwitcher,
} from "../screenTypes.ts";

import { MainMenuController } from "./MainMenuController.ts";
import { Cutscene1Controller } from "../Cutscenes/Cutscene1/Cutscene1Controller.ts";
import { locateBreakerBoxController } from "./locateBreakerBoxController.ts";
import { mainLevels } from "../content/levelCatalog";
import type { LevelConfig } from "../types/circuit";

// Screens managed directly by Konva
type KonvaScreenId = Exclude<
  ScreenId["type"],
  "level1" | "minigame1" | "minigame2"
>;

// Handles creating screens and switching between them.
export class SceneController implements ScreenSwitcher {
  private stage: Konva.Stage;
  private layer = new Konva.Layer();
  private screens: Record<KonvaScreenId, ScreenController>;

  constructor(
    private onLevel1: () => void,
    private onMinigame1: () => void,
    private onMinigame2: () => void,
  ) {
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
        () =>
          this.switchToScreen({
            type: "locateBreakerBox",
          }),
      ),

      locateBreakerBox: new locateBreakerBoxController(
        this.stage,
        width,
        height,
        3,
        () => this.openLevel1(),
        mainLevels,
        (id) => this.openLevel(id),
      ),
    };

    for (const screen of Object.values(this.screens)) {
      this.layer.add(screen.getView().getGroup());
    }

    this.switchToScreen({ type: "menu" });
  }

  // Switch between screens.
  public switchToScreen(screen: ScreenId): void {
    if (screen.type === "level1") {
      this.openLevel1();
      return;
    }

    if (screen.type === "minigame1") {
      this.openMinigame1();
      return;
    }

    if (screen.type === "minigame2") {
      this.openMinigame2();
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

  // Hide all Konva screens.
  private hideAllScreens(): void {
    for (const controller of Object.values(this.screens)) {
      controller.stop?.();
      controller.getView().hide();
    }
  }

  // Open the main game's Level 1.
  private openLevel1(): void {
    this.hideAllScreens();
    this.onLevel1();
  }

  // Open standalone Minigame 1.
  private openMinigame1(): void {
    this.hideAllScreens();
    this.onMinigame1();
  }

  // Open standalone Minigame 2.
  private openMinigame2(): void {
    this.hideAllScreens();
    this.onMinigame2();
  }

  public destroy(): void {
    for (const controller of Object.values(this.screens)) {
      controller.stop?.();
    }

    this.stage.off(".locateBreakerBox");
    this.stage.destroy();
  }
}
