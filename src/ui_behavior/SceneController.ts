
import Konva from "konva";
import type {
  ScreenId,
  ScreenController,
  ScreenSwitcher,
} from "../screenTypes.ts";

import { MainMenuController } from "./MainMenuController.ts";
import { Cutscene1Controller } from "../Cutscenes/Cutscene1/Cutscene1Controller.ts";
import { Cutscene2Controller } from "../Cutscenes/Cutscene2/Cutscene2Controller.ts";
import { LevelSelectorController } from "./LevelSelectorController.ts";
import { locateBreakerBoxController } from "./locateBreakerBoxController.ts";
import { GateGuessController } from "../minigames/GateGuessController.ts";
import { TutorialController } from "../Tutorial/TutorialController.ts";
import { mainLevels } from "../content/levelCatalog";
import type { StorageAdapter } from "../persistence/storageAdapter";

type KonvaScreenId =
  | "menu"
  | "cutscene1"
  | "cutscene2"
  | "tutorial"
  | "levelSelector"
  | "locateBreakerBox"
  | "gateGuess";

const LEVELS_PER_BREAKER_SCENE = 2;

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

      cutscene2: new Cutscene2Controller(
        width,
        height,
        () => this.showKonvaScreen("menu"),
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

  private breakerSceneNumber(levelId: string): number | undefined {
    const index = mainLevels.findIndex((level) => level.id === levelId);
    return index < 0 ? undefined : Math.floor(index / LEVELS_PER_BREAKER_SCENE) + 1;
  }

  // A selection always starts its breaker scene. Navigation within a pair does not.
  public startLevelCutscene(levelId: string, previousLevelId?: string): void {
    const breakerSceneNumber = this.breakerSceneNumber(levelId);
    if (breakerSceneNumber === undefined) {
      console.error(`Unknown level: ${levelId}`);
      return;
    }

    if (previousLevelId !== undefined &&
        this.breakerSceneNumber(previousLevelId) === breakerSceneNumber) {
      this.openLevel(levelId);
      return;
    }

    this.breakerController.setBreakerScene(breakerSceneNumber, levelId);
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

      case "cutscene2":
        this.showKonvaScreen("cutscene2");
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
        if (mainLevels[0]) this.startLevelCutscene(mainLevels[0].id);
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
