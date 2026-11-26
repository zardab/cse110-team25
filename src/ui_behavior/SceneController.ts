
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
import { TutorialController } from "../Tutorial/TutorialController.ts";
import { mainLevels } from "../content/levelCatalog";
import type { StorageAdapter } from "../persistence/storageAdapter";

type KonvaScreenId =
  | "menu"
  | "cutscene1"
  | "tutorial"
  | "levelSelector"
  | "locateBreakerBox"
  | "gateGuess";

export class SceneController implements ScreenSwitcher {
  private stage: Konva.Stage;
  private layer = new Konva.Layer();
  private screens: Record<KonvaScreenId, ScreenController>;

  private breakerController: locateBreakerBoxController;
  private tutorialController: TutorialController;

  constructor(
    private onLevel: (levelId: string) => void,
    private onMinigame1: () => void,
    private onMinigame2: () => void,
    storage: Pick<StorageAdapter, "getProgress">,
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

    this.tutorialController = new TutorialController(
      width,
      height,
      () => this.showKonvaScreen("levelSelector"),
    );

    this.screens = {
      menu: new MainMenuController(this, width, height),

      cutscene1: new Cutscene1Controller(
        width,
        height,
        () => this.showKonvaScreen("tutorial"),
      ),

      tutorial: this.tutorialController,

      levelSelector: new LevelSelectorController(
        width,
        height,
        mainLevels,
        (id) => this.startLevelCutscene(id),
        storage,
      ),

      locateBreakerBox: this.breakerController,

      gateGuess: new GateGuessController(this, width, height),
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

      case "tutorial":
        this.showKonvaScreen("tutorial");
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
    }
  }

  /** Opens How to Play from inside a level; its button hides the scene and calls onBack. */
  public showTutorialFromLevel(onBack: () => void): void {
    this.tutorialController.setExit({
      label: "Back to level",
      onExit: () => {
        this.hideAllScreens();
        onBack();
      },
    });
    this.showKonvaScreen("tutorial");
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
