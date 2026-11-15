/** Visual-only in-game sidebar: open/close + difficulty toggle styling. */
export class SideMenu {
  private readonly root: HTMLElement;
  private readonly toggle: HTMLElement;

  constructor(signal: AbortSignal) {
    const root = document.getElementById('game-sidebar');
    if (!root) {
      throw new Error('SideMenu: #game-sidebar not found');
    }

    const toggle = document.getElementById('difficulty-toggle');
    if (!toggle) {
      throw new Error('SideMenu: #difficulty-toggle not found');
    }

    this.root = root;
    this.toggle = toggle;

    const options = { signal };
    document.getElementById('sidebar-close-btn')?.addEventListener('click', () => this.close(), options);
    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => this.close(), options);
    this.toggle.addEventListener('click', () => this.flipDifficulty(), options);
  }

  open(): void {
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  private flipDifficulty(): void {
    const next = this.toggle.dataset.mode === 'HARD' ? 'EASY' : 'HARD';
    this.toggle.dataset.mode = next;
  }
}
