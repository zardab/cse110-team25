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
      onNextLevel: (next) => navigateLevel(level.id, next.id),
      onGameComplete: showEnding,
      onPreviousLevel: (previous) => navigateLevel(level.id, previous.id),
      onMainMenu: showMainMenu,
      onTutorial: showTutorial,
    });
  };

  // Show a breaker scene only when navigation crosses into another pair.
  const navigateLevel = (previousLevelId: string, levelId: string) => {
    activeLevel?.destroy();
    activeLevel = undefined;
    appContainer.style.display = "none";
    introContainer.style.display = "";
    scene.startLevelCutscene(levelId, previousLevelId);
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

  // Leaves the final level and starts the ending cutscene.
  const showEnding = () => {
    activeLevel?.destroy();
    activeLevel = undefined;
    appContainer.style.display = "none";
    introContainer.style.display = "";
    scene.switchToScreen({ type: "cutscene2" });
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

  // Minigame 3 is "Fault Finder", a Konva screen inside the scene.
  const openMinigame3 = () => {
    scene.switchToScreen({ type: "faultFinder" });
  };

  const scene = new SceneController(openLevel, openMinigame1, openMinigame2, openMinigame3, storage);
});
