import "./index.css";
import { SceneController } from "./ui_behavior/SceneController";
import { LevelScreen } from "./ui/LevelScreen";
import { StorageAdapter } from "./persistence/storageAdapter";
import { mainLevels } from "./content/levelCatalog";
import type { LevelConfig } from "./types/circuit";

window.addEventListener("DOMContentLoaded", () => {
  const introContainer = document.getElementById("container")!;
  const appContainer = document.getElementById("app")!;
  
  const storage = new StorageAdapter();
  let activeLevel: LevelScreen | undefined;
  
  const showLevel = (level: LevelConfig) => {
    activeLevel?.destroy();
    introContainer.style.display = "none";
    appContainer.style.display = "flex";
    activeLevel = new LevelScreen({
      level,
      storage,
      onNextLevel: showLevel,
      onPreviousLevel: showLevel,
      onMainMenu: showMainMenu,
      onTutorial: showTutorial,
    });
  };

  // Shows How to Play over the current level, then returns to it untouched.
  const showTutorial = (onReturn: () => void) => {
    appContainer.style.display = "none";
    introContainer.style.display = "";
    scene.showTutorialFromLevel(() => {
      introContainer.style.display = "none";
      appContainer.style.display = "flex";
      onReturn();
    });
  };

  // Leaves the level and returns to the start screen
  const showMainMenu = () => {
    activeLevel?.destroy();
    activeLevel = undefined;
    appContainer.style.display = "none";
    introContainer.style.display = "";
    scene.switchToScreen({ type: "menu" });
  };

  // Opens a level by ID
  const openLevel = (levelId: string) => {
    const level = mainLevels.find((entry) => entry.id === levelId);
    if (!level) {
      console.error(`Unknown level: ${levelId}`);
      return;
    }
    showLevel(level);
  };
  
  // Minigame 1 is "Name That Gate", a Konva screen inside the scene.
  const openMinigame1 = () => {
    scene.switchToScreen({ type: "gateGuess" });
  };
  
  // Minigame 2: Timed circuit challenge
  const openMinigame2 = () => {
    activeLevel?.destroy();

    // Hide the main menu and display the game.
    introContainer.style.display = "none";
    appContainer.style.display = "flex";

    // Launch a fresh timed level without changing story progress.
    activeLevel = new LevelScreen({
      timed: true,
      durationSeconds: 15,
      onMainMenu: showMainMenu,
      onTutorial: showTutorial,
    });
  };

  const scene = new SceneController(openLevel, openMinigame1, openMinigame2, storage);
});
