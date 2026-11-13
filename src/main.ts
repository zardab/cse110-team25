import './index.css';
import { SceneController } from './ui_behavior/SceneController';
import { LevelScreen } from './ui/LevelScreen';
import { StorageAdapter } from './persistence/storageAdapter';

window.addEventListener('DOMContentLoaded', () => {
  const introContainer = document.getElementById('container')!;
  const appContainer = document.getElementById('app')!;
  const storage = new StorageAdapter();
  let activeLevel: LevelScreen | undefined;

  const scene = new SceneController((level) => {
    activeLevel?.destroy();
    introContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    activeLevel = new LevelScreen({ level, storage });
  });

  document.getElementById('menu-btn')?.addEventListener('click', () => {
    activeLevel?.destroy();
    activeLevel = undefined;
    appContainer.style.display = 'none';
    introContainer.style.display = '';
    scene.switchToScreen({ type: 'levelSelector' });
  });
});
