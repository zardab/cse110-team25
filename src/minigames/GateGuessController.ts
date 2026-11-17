import type { ScreenController, ScreenSwitcher } from '../screenTypes';
import type { StorageLike } from '../persistence/storageAdapter';
import {
  ROUND_SECONDS,
  firstContradiction,
  nextRound,
  startSession,
  submitGuess,
  timeOut,
  type Clue,
  type GuessGate,
  type GuessSession,
  type Rng,
} from './gateGuess';
import { browserStorage, loadBestStreak, saveBestStreak } from './gateGuessRecord';
import { GateGuessView, type GateGuessViewModel, type MessageTone } from './GateGuessView';

export interface GateGuessOptions {
  readonly rng?: Rng;
  readonly storage?: StorageLike | null;
}

function describe(clue: Clue): string {
  return `A=${clue.a}, B=${clue.b}`;
}

/**
 * GateGuessController - Runs "Name That Gate": holds the current run, turns clicks
 * into guesses, and saves the best streak.
 */
export class GateGuessController implements ScreenController {
  private readonly view: GateGuessView;
  private readonly rng: Rng;
  private readonly storage: StorageLike | null;
  private session!: GuessSession;
  private best: number;
  private selectedClue = 0;
  private message = '';
  private tone: MessageTone = 'info';
  private timeLeft = ROUND_SECONDS;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly screenSwitcher: ScreenSwitcher,
    width: number,
    height: number,
    { rng = Math.random, storage = browserStorage() }: GateGuessOptions = {},
  ) {
    this.rng = rng;
    this.storage = storage;
    this.best = loadBestStreak(storage);
    this.view = new GateGuessView(width, height, {
      onGuess: (gate) => this.handleGuess(gate),
      onSelectClue: (index) => this.handleSelectClue(index),
      onAction: () => this.handleAction(),
      onBack: () => this.screenSwitcher.switchToScreen({ type: 'levelSelector' }),
    });
  }

  /** Each visit starts a fresh run. */
  start(): void {
    this.session = startSession(this.rng);
    this.showNewRound();
  }

  /** Leaving the screen stops the clock. */
  stop(): void {
    this.stopTimer();
  }

  getView(): GateGuessView {
    return this.view;
  }

  /** The current run, for tests and debugging. */
  getSession(): GuessSession {
    return this.session;
  }

  private handleGuess(gate: GuessGate): void {
    if (this.session.status !== 'playing') return;
    const { outcome, session } = submitGuess(this.session, gate, this.rng);
    this.session = session;
    const { clues, answer } = session.round;

    if (session.status !== 'playing') this.stopTimer();

    if (outcome === 'correct') {
      if (session.streak > this.best) {
        this.best = session.streak;
        saveBestStreak(this.storage, this.best);
      }
      const used = clues.length === 1 ? '1 test' : `${clues.length} tests`;
      this.say(`Correct, it's ${answer}! You needed ${used}.`, 'good');
    } else if (outcome === 'fitsSoFar') {
      this.selectedClue = clues.length - 1;
      this.say(`${gate} fits so far, but it isn't the answer. Here's a new test.`, 'hint');
    } else {
      // Point the circuit at the test the guess fails, so the player sees why.
      const failed = firstContradiction(gate, clues)!;
      this.selectedClue = clues.indexOf(failed);
      const reason = `${gate} doesn't fit: with ${describe(failed)} it would output ${1 - failed.out}, not ${failed.out}.`;
      if (session.status === 'lost') {
        this.say(`${reason}\nOut of lives. It was ${answer}. Final streak: ${session.streak}.`, 'bad');
      } else {
        const lives = session.lives === 1 ? '1 life' : `${session.lives} lives`;
        this.say(`${reason} ${lives} left.`, 'bad');
      }
    }
    this.render();
  }

  private handleSelectClue(index: number): void {
    if (index < 0 || index >= this.session.round.clues.length) return;
    this.selectedClue = index;
    this.render();
  }

  private handleAction(): void {
    if (this.session.status === 'won') {
      this.session = nextRound(this.session, this.rng);
      this.showNewRound();
    } else if (this.session.status === 'lost') {
      this.start();
    }
  }

  // Every new circuit gets the full time; the clock pauses while a solved circuit waits for Next.
  private startTimer(): void {
    this.stopTimer();
    this.timeLeft = ROUND_SECONDS;
    this.timerId = setInterval(() => this.tick(), 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== null) clearInterval(this.timerId);
    this.timerId = null;
  }

  private tick(): void {
    this.timeLeft -= 1;
    if (this.timeLeft > 0) {
      this.view.setTimeLeft(this.timeLeft);
      return;
    }
    this.stopTimer();
    this.timeLeft = 0;
    this.session = timeOut(this.session);
    this.say(`Time's up! It was ${this.session.round.answer}. Final streak: ${this.session.streak}.`, 'bad');
    this.render();
  }

  private showNewRound(): void {
    this.startTimer();
    this.selectedClue = 0;
    this.say(`Here's one test of the hidden gate: ${describe(this.session.round.clues[0])}. Which gate is it?`, 'info');
    this.render();
  }

  private say(message: string, tone: MessageTone): void {
    this.message = message;
    this.tone = tone;
  }

  private render(): void {
    const { round, lives, streak, status } = this.session;
    const model: GateGuessViewModel = {
      clues: round.clues,
      selectedClue: this.selectedClue,
      revealedGate: status === 'playing' ? null : round.answer,
      guessed: round.guessed,
      lives,
      streak,
      best: this.best,
      timeLeft: this.timeLeft,
      message: this.message,
      tone: this.tone,
      action: status === 'won' ? 'next' : status === 'lost' ? 'restart' : null,
    };
    this.view.render(model);
  }
}
