import type { GateType } from '../../types/circuit';
import { GATE_INFO } from './gateInfoContent';

export interface GateInfoOpenOptions {
  /** When true, only Got it / carousel controls dismiss (no backdrop / Escape). */
  locked?: boolean;
}

export class GateInfoModal {
  private readonly root: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly prevBtn: HTMLButtonElement | null;
  private readonly nextBtn: HTMLButtonElement | null;
  private readonly dots: HTMLElement | null;
  private locked = false;
  private gates: GateType[] = [];
  private index = 0;

  constructor(signal: AbortSignal) {
    const root = document.getElementById('gate-info-overlay');
    const dialog = document.getElementById('gate-info-modal');
    if (!root || !dialog) {
      throw new Error('GateInfoModal: #gate-info-overlay / #gate-info-modal not found');
    }
    this.root = root;
    this.dialog = dialog;
    this.prevBtn = document.getElementById('gate-info-prev') as HTMLButtonElement | null;
    this.nextBtn = document.getElementById('gate-info-next') as HTMLButtonElement | null;
    this.dots = document.getElementById('gate-info-dots');

    const options = { signal };
    document.getElementById('gate-info-dismiss')?.addEventListener('click', () => this.onGotIt(), options);
    this.prevBtn?.addEventListener('click', () => this.goTo(this.index - 1), options);
    this.nextBtn?.addEventListener('click', () => this.goTo(this.index + 1), options);
    root.addEventListener('click', (event) => {
      if (event.target === root && !this.locked) this.close();
    }, options);
    document.addEventListener('keydown', (event) => {
      if (this.root.hidden) return;
      if (event.key === 'Escape' && !this.locked) {
        this.close();
        return;
      }
      if (this.gates.length <= 1) return;
      if (event.key === 'ArrowLeft') this.goTo(this.index - 1);
      if (event.key === 'ArrowRight') this.goTo(this.index + 1);
    }, options);
  }

  /** Single-gate ⓘ popup (or locked intro with one gate). */
  open(gate: GateType, options: GateInfoOpenOptions = {}): void {
    this.openGates([gate], options);
  }

  /** Multi-gate intro carousel. */
  openGates(gates: readonly GateType[], options: GateInfoOpenOptions = {}): void {
    if (gates.length === 0) return;
    this.gates = [...gates];
    this.index = 0;
    this.locked = options.locked ?? false;
    this.renderSlide();
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
    this.locked = false;
    this.gates = [];
    this.index = 0;
  }

  private onGotIt(): void {
    if (this.gates.length > 1 && this.index < this.gates.length - 1) {
      this.goTo(this.index + 1);
      return;
    }
    this.close();
  }

  private goTo(next: number): void {
    if (this.gates.length === 0) return;
    this.index = Math.max(0, Math.min(this.gates.length - 1, next));
    this.renderSlide();
  }

  private renderSlide(): void {
    const gate = this.gates[this.index];
    const info = GATE_INFO[gate];

    const title = this.dialog.querySelector('.gate-info-title');
    const subtitle = this.dialog.querySelector<HTMLElement>('.gate-info-subtitle');
    const description = this.dialog.querySelector('.gate-info-description');
    const funFact = this.dialog.querySelector<HTMLElement>('.gate-info-fun-fact');
    const graphic = this.dialog.querySelector('.gate-info-graphic') as HTMLImageElement | null;
    const inputLabels = this.dialog.querySelector('.gate-info-input-labels');
    const table = this.dialog.querySelector('.gate-info-truth');

    if (title) title.textContent = info.name;
    if (subtitle) {
      if (info.subtitle) {
        subtitle.hidden = false;
        subtitle.textContent = `“${info.subtitle}”`;
      } else {
        subtitle.hidden = true;
        subtitle.textContent = '';
      }
    }
    if (description) description.textContent = info.description;
    if (funFact) {
      if (info.funFact) {
        funFact.hidden = false;
        funFact.innerHTML = `<em>Fun Fact:</em> ${info.funFact}`;
      } else {
        funFact.hidden = true;
        funFact.textContent = '';
      }
    }
    if (graphic) {
      graphic.src = `/assets/${gate}.svg`;
      graphic.alt = info.name;
    }
    if (inputLabels) {
      inputLabels.innerHTML = info.inputs
        .map((label) => `<span>${label}</span>`)
        .join('');
    }
    if (table) {
      const headers = [...info.inputs, 'OUT'];
      table.innerHTML = `
        <div class="gate-info-truth-cols" style="--truth-cols: ${headers.length}">
          ${headers.map((header, col) => `
            <div class="gate-info-truth-col">
              <span class="gate-info-truth-head">${header}</span>
              ${info.truthTable.map((row) => `<span>${row[col]}</span>`).join('')}
            </div>
          `).join('')}
        </div>
      `;
    }

    this.renderCarouselChrome();
  }

  private renderCarouselChrome(): void {
    const multi = this.gates.length > 1;

    if (this.prevBtn) {
      this.prevBtn.hidden = !multi;
      this.prevBtn.disabled = this.index <= 0;
    }
    if (this.nextBtn) {
      this.nextBtn.hidden = !multi;
      this.nextBtn.disabled = this.index >= this.gates.length - 1;
    }

    if (!this.dots) return;
    if (!multi) {
      this.dots.hidden = true;
      this.dots.innerHTML = '';
      return;
    }

    this.dots.hidden = false;
    this.dots.innerHTML = this.gates
      .map((_, i) => `<button type="button" class="gate-info-dot${i === this.index ? ' active' : ''}" aria-label="Gate ${i + 1}" data-index="${i}"></button>`)
      .join('');
    this.dots.querySelectorAll('.gate-info-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        const i = Number((dot as HTMLElement).dataset.index);
        if (!Number.isNaN(i)) this.goTo(i);
      });
    });
  }
}
