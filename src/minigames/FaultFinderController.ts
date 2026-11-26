import { faultLevels, faultTutorialLevel } from '../content/faultLevelCatalog';
import type { FaultLevel } from '../content/faultLevelLoader';
import { StorageAdapter, type StorageLike } from '../persistence/storageAdapter';
import type { ScreenController, ScreenSwitcher } from '../screenTypes';
import {
  faultCount,
  runTest,
  startGame,
  submitDiagnosis,
  testMatching,
  testsLeft,
  toggleInput,
  toggleMark,
  type FaultGame,
  type TestRecord,
} from './faultFinder';
import { FaultFinderView, type FaultFinderViewModel, type MessageTone } from './FaultFinderView';
import { advance, prompt, type TutorialEvent, type TutorialStep } from './faultTutorial';

/** Fault Finder progress lives under its own key, so it can never touch the main game's saves. */
export const FAULT_FINDER_PROGRESS_KEY = 'cse110-team25:fault-finder-progress';

export interface FaultFinderOptions {
  readonly levels?: readonly FaultLevel[];
  /** The practice board for How to Play. */
  readonly tutorial?: FaultLevel;
  /** Where to save progress. Omit for the browser's localStorage; null disables saving. */
  readonly storage?: StorageLike | null;
}

/**
 * FaultFinderController - Runs "Fault Finder": a level-select screen, then the board for the
 * chosen level. Turns clicks into tests and marks, reports results without hints, and saves
 * which levels are solved through the shared StorageAdapter. The first visit opens the How to
 * Play walkthrough on a practice board; it can be replayed from the level list.
 */
export class FaultFinderController implements ScreenController {
  private readonly view: FaultFinderView;
  private readonly levels: readonly FaultLevel[];
  private readonly tutorialLevel: FaultLevel;
  /** The walkthrough step while the practice board is open, otherwise null. */
  private tutorial: TutorialStep | null = null;
  private readonly progress: StorageAdapter;
  /** Which screen is showing: the level list or a board. */
  private mode: 'select' | 'play' = 'select';
  private levelIndex = 0;
  private game!: FaultGame;
  private message = '';
  private tone: MessageTone = 'info';

  constructor(
    private readonly screenSwitcher: ScreenSwitcher,
    width: number,
    height: number,
    { levels = faultLevels, tutorial = faultTutorialLevel, storage }: FaultFinderOptions = {},
  ) {
    if (levels.length === 0) throw new Error('FaultFinderController needs at least one level');
    this.levels = levels;
    this.tutorialLevel = tutorial;
    // Undefined lets the adapter fall back to the browser's localStorage.
    this.progress = new StorageAdapter(storage, FAULT_FINDER_PROGRESS_KEY);
    this.view = new FaultFinderView(width, height, {
      onToggleInput: (inputId) => this.update(toggleInput(this.game, inputId), 'toggle'),
      onMarkGate: (slotId) => this.update(toggleMark(this.game, slotId), 'mark'),
      onRunTest: () => this.handleRunTest(),
      onSubmit: () => this.handleSubmit(),
      onSelectLevel: (index) => this.openLevel(index),
      onAction: () => this.handleAction(),
      onBack: () => this.handleBack(),
      onHowToPlay: () => this.startTutorial(),
      onTutorialNext: () => this.handleTutorialNext(),
      onSkipTutorial: () => this.finishTutorial(),
    });
  }

  /** The first visit opens the walkthrough; later visits open on the level list. */
  start(): void {
    if (this.progress.getProgress()[this.tutorialLevel.id]?.completed) this.showLevelSelect();
    else this.startTutorial();
  }

  getView(): FaultFinderView {
    return this.view;
  }

  /** The current board, for tests and debugging. */
  getGame(): FaultGame {
    return this.game;
  }

  private showLevelSelect(): void {
    this.mode = 'select';
    const saved = this.progress.getProgress();
    this.view.renderSelect({
      levels: this.levels.map((level) => ({
        title: level.title,
        faultCount: faultCount(level),
        completed: saved[level.id]?.completed ?? false,
      })),
    });
  }

  /** Back from a board goes to the level list; back from the list leaves the minigame. */
  private handleBack(): void {
    if (this.tutorial !== null) this.finishTutorial();
    else if (this.mode === 'play') this.showLevelSelect();
    else this.screenSwitcher.switchToScreen({ type: 'menu' });
  }

  private startTutorial(): void {
    this.mode = 'play';
    this.tutorial = 'goal';
    this.game = startGame(this.tutorialLevel);
    this.say('', 'info');
    this.render();
  }

  private handleTutorialNext(): void {
    if (this.tutorial === 'done') this.finishTutorial();
    else this.update(this.game, 'next');
  }

  /** Finishing or skipping both count as seen, so it doesn't open by itself again. */
  private finishTutorial(): void {
    this.tutorial = null;
    this.progress.saveSummary(this.tutorialLevel.id, { completed: true, stars: 0 });
    this.showLevelSelect();
  }

  private openLevel(index: number): void {
    if (index < 0 || index >= this.levels.length) return;
    this.mode = 'play';
    this.tutorial = null;
    this.levelIndex = index;
    this.game = startGame(this.levels[index]);
    this.say('', 'info');
    this.render();
  }

  private update(game: FaultGame, event?: TutorialEvent): void {
    this.game = game;
    if (this.tutorial !== null && event) this.tutorial = advance(this.tutorial, event, game);
    this.render();
  }

  private handleRunTest(): void {
    const next = runTest(this.game);
    if (next === this.game) return;
    // The lit wires and bulbs are the result; no text needed.
    this.say('', 'info');
    this.update(next, 'test');
  }

  private handleSubmit(): void {
    const { outcome, game } = submitDiagnosis(this.game);
    switch (outcome.kind) {
      case 'correct':
        // The practice board is never saved as a level; finishing the walkthrough is.
        if (this.tutorial === null) this.progress.saveSummary(game.level.id, { completed: true, stars: 0 });
        this.say(this.isLastLevel() ? 'Solved! You\'ve finished Fault Finder.' : 'Solved!', 'good');
        break;
      case 'wrongCount':
        this.say(`Mark ${outcome.expected} gate${outcome.expected === 1 ? '' : 's'}.`, 'hint');
        break;
      case 'wrong':
        // No hint about which mark was off: the whole diagnosis is simply wrong.
        this.say(this.afterMistake(game), 'bad');
        break;
    }
    this.update(game, outcome.kind === 'correct' ? 'won' : undefined);
  }

  /** The real faults are revealed on the gates themselves when the round is lost. */
  private afterMistake(game: FaultGame): string {
    if (game.status === 'lost') return 'Out of guesses.';
    const left = game.level.maxMistakes - game.mistakes;
    return `Wrong. ${left} guess${left === 1 ? '' : 'es'} left.`;
  }

  private isLastLevel(): boolean {
    return this.tutorial === null && this.levelIndex === this.levels.length - 1;
  }

  private handleAction(): void {
    if (this.game.status === 'won' && this.isLastLevel()) {
      this.showLevelSelect();
    } else if (this.game.status === 'won') {
      this.openLevel((this.levelIndex + 1) % this.levels.length);
    } else if (this.game.status === 'lost') {
      this.openLevel(this.levelIndex);
    }
  }


  private say(message: string, tone: MessageTone): void {
    this.message = message;
    this.tone = tone;
  }

  private render(): void {
    const { level, inputs, tests, diagnosis, mistakes, status } = this.game;
    const match = testMatching(this.game, inputs);
    const current: TestRecord | null = match === null ? null : tests[match];
    const inTutorial = this.tutorial !== null;
    const model: FaultFinderViewModel = {
      level,
      levelLabel: inTutorial ? 'How to Play' : `Level ${this.levelIndex + 1} / ${this.levels.length}`,
      tutorial: inTutorial ? prompt(this.tutorial!, this.game) : null,
      levelIndex: this.levelIndex,
      levelCount: this.levels.length,
      inputs,
      current,
      faultCount: faultCount(level),
      diagnosis,
      revealed: status === 'playing' ? null : level.faults,
      testsLeft: testsLeft(this.game),
      lives: level.maxMistakes - mistakes,
      maxLives: level.maxMistakes,
      message: this.message,
      tone: this.tone,
      playing: status === 'playing',
      // In the walkthrough the callout's own button moves on instead.
      action: inTutorial ? null
        : status === 'won' ? (this.isLastLevel() ? 'finish' : 'next')
        : status === 'lost' ? 'restart' : null,
    };
    this.view.render(model);
  }
}
