
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

  const openMinigame1 = () => {
    // Connect standalone Minigame 1 here.
    console.warn("Minigame 1 is not connected yet.");
  };

  const openMinigame2 = () => {
    // Connect standalone Minigame 2 here.
    console.warn("Minigame 2 is not connected yet.");
  };

  new SceneController(
    openLevel,
    openMinigame1,
    openMinigame2,
  );
});
