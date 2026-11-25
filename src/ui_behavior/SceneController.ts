
import Konva from "konva";
import type {
  ScreenId,
  ScreenController,
  ScreenSwitcher,
} from "../screenTypes.ts";

import { MainMenuController } from "./MainMenuController.ts";
import { Cutscene1Controller } from "../Cutscenes/Cutscene1/Cutscene1Controller.ts";
import { LevelSelectorController } from "./LevelSelectorController.ts";
import { locateBreakerBoxController } from "./locateBreakerBoxController.ts";
import { GateGuessController } from "../minigames/GateGuessController.ts";
import { FaultFinderController } from "../minigames/FaultFinderController.ts";
import { mainLevels } from "../content/levelCatalog";

type KonvaScreenId =
  | "menu"
  | "cutscene1"
  | "levelSelector"
  | "locateBreakerBox"
  | "gateGuess"
  | "faultFinder";

export class SceneController implements ScreenSwitcher {
  private stage: Konva.Stage;
  private layer = new Konva.Layer();
  private screens: Record<KonvaScreenId, ScreenController>;

  private breakerController: locateBreakerBoxController;

  constructor(
    private onLevel: (levelId: string) => void,
    private onMinigame1: () => void,
    private onMinigame2: () => void,
    private onMinigame3: () => void,
  ) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.stage = new Konva.Stage({
      container: "container",
      width,
      height,
    });

    this.stage.add(this.layer);

    this.breakerController = new locateBreakerBoxController(
      this.stage,
      width,
      height,
      1,
      (levelId) => this.openLevel(levelId),
    );

    this.screens = {
      menu: new MainMenuController(this, width, height),

      cutscene1: new Cutscene1Controller(
        width,
        height,
        () => this.showKonvaScreen("levelSelector"),
      ),

      levelSelector: new LevelSelectorController(
        width,
        height,
        mainLevels,
        (id) => this.startLevelCutscene(id),
      ),

      locateBreakerBox: this.breakerController,

      gateGuess: new GateGuessController(this, width, height),

      faultFinder: new FaultFinderController(this, width, height),
    };

    for (const controller of Object.values(this.screens)) {
      this.layer.add(controller.getView().getGroup());
    }

    this.showKonvaScreen("menu");
  }

  // Level Selector -> Flashlight cutscene
  private startLevelCutscene(levelId: string): void {
    const levelIndex = mainLevels.findIndex(
      (level) => level.id === levelId,
    );

    if (levelIndex === -1) {
      console.error(`Unknown level: ${levelId}`);
      return;
    }

    const levelNumber = levelIndex + 1;

    this.breakerController.setLevel(
      levelNumber,
      levelId,
    );

    this.showKonvaScreen("locateBreakerBox");
  }

  private showKonvaScreen(screenId: KonvaScreenId): void {
    for (const [name, controller] of Object.entries(this.screens)) {
      if (name === screenId) {
        controller.getView().show();
      } else {
        controller.stop?.();
        controller.getView().hide();
      }
    }

    this.screens[screenId].start?.();
    this.layer.batchDraw();
  }

  public switchToScreen(screen: ScreenId): void {
    switch (screen.type) {
      case "menu":
        this.showKonvaScreen("menu");
        return;

      case "cutscene1":
        this.showKonvaScreen("cutscene1");
        return;

      case "levelSelector":
        this.showKonvaScreen("levelSelector");
        return;

      case "locateBreakerBox":
        this.showKonvaScreen("locateBreakerBox");
        return;

      case "gateGuess":
        this.showKonvaScreen("gateGuess");
        return;

      case "faultFinder":
        this.showKonvaScreen("faultFinder");
        return;

      case "level1":
        this.startLevelCutscene("level1");
        return;

      case "minigame1":
        this.hideAllScreens();
        this.onMinigame1();
        return;

      case "minigame2":
        this.hideAllScreens();
        this.onMinigame2();
        return;

      case "minigame3":
        this.hideAllScreens();
        this.onMinigame3();
        return;
    }
  }

  private hideAllScreens(): void {
    for (const controller of Object.values(this.screens)) {
      controller.stop?.();
      controller.getView().hide();
    }
  }

  // Flashlight breaker clicked -> Circuit level
  private openLevel(levelId: string): void {
    this.hideAllScreens();
    this.onLevel(levelId);
  }

  public destroy(): void {
    for (const controller of Object.values(this.screens)) {
      controller.stop?.();
    }

    this.stage.off(".flashlight");
    this.stage.destroy();
  }
}
