
import "./index.css";
import { SceneController } from "./ui_behavior/SceneController";
import { LevelScreen } from "./ui/LevelScreen";
import { StorageAdapter } from "./persistence/storageAdapter";
import { mainLevels } from "./content/levelCatalog";

window.addEventListener("DOMContentLoaded", () => {
  const introContainer = document.getElementById("container")!;
  const appContainer = document.getElementById("app")!;

  const storage = new StorageAdapter();
  let activeLevel: LevelScreen | undefined;

  const openLevel = (levelId: string) => {
    const level = mainLevels.find(
      (entry) => entry.id === levelId,
    );

    if (!level) {
      console.error(`Unknown level: ${levelId}`);
      return;
    }

    activeLevel?.destroy();

    introContainer.style.display = "none";
    appContainer.style.display = "flex";

    activeLevel = new LevelScreen({
      level,
      storage,
    });
  };

  // Minigame 1 is "Name That Gate", a Konva screen inside the scene.
  const openMinigame1 = () => {
    scene.switchToScreen({ type: "gateGuess" });
  };

  const openMinigame2 = () => {
    // Connect standalone Minigame 2 here.
    console.warn("Minigame 2 is not connected yet.");
  };

  const scene = new SceneController(
    openLevel,
    openMinigame1,
    openMinigame2,
  );
});
