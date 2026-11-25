/** Visual-only in-game sidebar: open/close. */
export class SideMenu {
  private readonly root: HTMLElement;

  constructor(signal: AbortSignal) {
    const root = document.getElementById('game-sidebar');
    if (!root) {
      throw new Error('SideMenu: #game-sidebar not found');
    }

    this.root = root;

    const options = { signal };
    document.getElementById('sidebar-close-btn')?.addEventListener('click', () => this.close(), options);
    document.getElementById('sidebar-backdrop')?.addEventListener('click', () => this.close(), options);
  }

  open(): void {
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }
}
