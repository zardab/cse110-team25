import './index.css';
import { SceneController } from './ui_behavior/SceneController';
import { LevelScreen } from './ui/LevelScreen';
import { StorageAdapter } from './persistence/storageAdapter';
import type { LevelConfig } from './types/circuit';

window.addEventListener('DOMContentLoaded', () => {
  const introContainer = document.getElementById('container')!;
  const appContainer = document.getElementById('app')!;
  const storage = new StorageAdapter();
  let activeLevel: LevelScreen | undefined;

  const openLevel = (level: LevelConfig) => {
    activeLevel?.destroy();
    introContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    activeLevel = new LevelScreen({
      level,
      storage,
      onNextLevel: openLevel,
      onPreviousLevel: openLevel,
    });
  };

  new SceneController(openLevel);
});
