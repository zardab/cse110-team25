import './index.css';
import { SceneController } from './ui_behavior/SceneController';
import { LevelScreen } from './ui/LevelScreen'; // adjust path to your LevelScreen location

window.addEventListener('DOMContentLoaded', () => {
  const introContainer = document.getElementById('container');
  const appContainer = document.getElementById('app');

  // 1. Boot up the SceneController with the transition callback
  const scene = new SceneController(() => {
    // 2. Transition fired: destroy the intro scene
    scene.destroy();

    // 3. Hide the intro DOM element
    if (introContainer) {
      introContainer.style.display = 'none';
    }

    // 4. Reveal the game UI
    if (appContainer) {
      appContainer.style.display = 'flex';
    }

    // 5. Instantiate the Konva level screen
    //new LevelScreen();
    new LevelScreen({ timed: true });
  });
});