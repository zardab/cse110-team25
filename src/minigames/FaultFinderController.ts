import { faultLevels } from '../content/faultLevelCatalog';
import type { FaultLevel } from '../content/faultLevelLoader';
import type { StorageLike } from '../persistence/storageAdapter';
import type { ScreenController, ScreenSwitcher } from '../screenTypes';
import { simulateCircuit } from '../simulation/evaluateCircuit';
import {
  attachProbe,
  countSuspects,
  cycleMark,
  probesLeft,
  runTest,
  setInputs,
  startGame,
  submitDiagnosis,
  testMatching,
  testsLeft,
  toggleInput,
  type Bits,
  type FaultGame,
  type TestRecord,
} from './faultFinder';
import { browserStorage, loadBestTests, recordBest, type BestTests } from './faultFinderRecord';
import { FaultFinderView, type FaultFinderViewModel, type MessageTone } from './FaultFinderView';

export interface FaultFinderOptions {
  readonly levels?: readonly FaultLevel[];
  readonly storage?: StorageLike | null;
}

/**
 * FaultFinderController - Runs "Fault Finder": holds the current board, turns clicks into
 * tests, probes and marks, explains each result, and saves the fewest tests per level.
 */
export class FaultFinderController implements ScreenController {
  private readonly view: FaultFinderView;
  private readonly levels: readonly FaultLevel[];
  private readonly storage: StorageLike | null;
  private best: BestTests;
  private levelIndex = 0;
  private game!: FaultGame;
  private message = '';
  private tone: MessageTone = 'info';

  constructor(
    private readonly screenSwitcher: ScreenSwitcher,
    width: number,
    height: number,
    { levels = faultLevels, storage = browserStorage() }: FaultFinderOptions = {},
  ) {
    if (levels.length === 0) throw new Error('FaultFinderController needs at least one level');
    this.levels = levels;
    this.storage = storage;
    this.best = loadBestTests(storage);
    this.view = new FaultFinderView(width, height, {
      onToggleInput: (inputId) => this.update(toggleInput(this.game, inputId)),
      onAttachProbe: (slotId) => this.handleAttachProbe(slotId),
      onMarkGate: (slotId) => this.update(cycleMark(this.game, slotId)),
      onRunTest: () => this.handleRunTest(),
      onSubmit: () => this.handleSubmit(),
      onSelectTest: (index) => this.handleSelectTest(index),
      onSelectLevel: (index) => this.openLevel(index),
      onAction: () => this.handleAction(),
      onBack: () => this.screenSwitcher.switchToScreen({ type: 'menu' }),
    });
  }

  /** Each visit restarts the level the player was on. */
  start(): void {
    this.openLevel(this.levelIndex);
  }

  getView(): FaultFinderView {
    return this.view;
  }

  /** The current board, for tests and debugging. */
  getGame(): FaultGame {
    return this.game;
  }

  private openLevel(index: number): void {
    if (index < 0 || index >= this.levels.length) return;
    this.levelIndex = index;
    this.game = startGame(this.levels[index]);
    this.say(this.game.level.briefing, 'info');
    this.render();
  }

  private update(game: FaultGame): void {
    this.game = game;
    this.render();
  }

  private handleAttachProbe(slotId: string): void {
    const next = attachProbe(this.game, slotId);
    if (next !== this.game) {
      const left = probesLeft(next);
      this.say(`Probe attached to ${this.gateLabel(slotId)}. It will read that wire on every test from now on. ${left} probe${left === 1 ? '' : 's'} left.`, 'info');
    }
    this.update(next);
  }

  private handleRunTest(): void {
    const next = runTest(this.game);
    if (next === this.game) return;
    const test = next.tests[next.tests.length - 1];
    const design = simulateCircuit(next.level, test.inputs);
    const wrongOutputs = next.level.primaryOutputs
      .filter((id) => test.actual[id] !== test.expected[id])
      .map((id) => `${id} should be ${test.expected[id]} but reads ${test.actual[id]}`);
    const wrongProbes = Object.entries(test.readings)
      .filter(([slotId, value]) => value !== design[next.level.slots[slotId].outputWireId])
      .map(([slotId, value]) => `the probe on ${this.gateLabel(slotId)} reads ${value}, not ${1 - value}`);
    const number = next.tests.length;
    const wrong = [...wrongOutputs, ...wrongProbes];
    if (wrong.length > 0) {
      this.say(`Test ${number}: ${wrong.join('; ')}.`, 'bad');
    } else {
      this.say(`Test ${number}: every reading matches the design. The fault is hiding on these inputs.`, 'hint');
    }
    this.update(next);
  }

  private handleSubmit(): void {
    const { outcome, game } = submitDiagnosis(this.game);
    const label = (slotId: string) => `${this.gateLabel(slotId)} stuck at ${game.level.faults[slotId]}`;
    const answer = Object.keys(game.level.faults).map(label).join(' and ');
    switch (outcome.kind) {
      case 'correct': {
        const used = game.tests.length;
        this.best = recordBest(this.storage, this.best, game.level.id, used);
        this.say(`Found it: ${answer}. Solved in ${used} test${used === 1 ? '' : 's'}.`, 'good');
        break;
      }
      case 'wrongCount':
        this.say(`Mark exactly ${outcome.expected} gate${outcome.expected === 1 ? '' : 's'} before submitting.`, 'hint');
        break;
      case 'contradicts':
        this.say(this.afterMistake(game, `Those marks can't be right: they would not give the readings in test ${outcome.testIndex + 1}.`, answer), 'bad');
        break;
      case 'fitsSoFar':
        this.say(this.afterMistake(game, 'Those marks fit every test so far, but they are not the real fault.', answer), 'bad');
        break;
    }
    this.update(game);
  }

  private afterMistake(game: FaultGame, reason: string, answer: string): string {
    if (game.status === 'lost') return `${reason}\nOut of guesses. The answer was ${answer}.`;
    const left = game.level.maxMistakes - game.mistakes;
    return `${reason} ${left} guess${left === 1 ? '' : 'es'} left. Keep testing.`;
  }

  private handleSelectTest(index: number): void {
    const test = this.game.tests[index];
    if (!test) return;
    this.update(setInputs(this.game, test.inputs));
  }

  private handleAction(): void {
    if (this.game.status === 'won') {
      this.openLevel((this.levelIndex + 1) % this.levels.length);
    } else if (this.game.status === 'lost') {
      this.openLevel(this.levelIndex);
    }
  }

  private gateLabel(slotId: string): string {
    const index = this.game.level.executionOrder.indexOf(slotId);
    return `G${index + 1} (${this.game.level.slots[slotId].assignedGate})`;
  }

  private say(message: string, tone: MessageTone): void {
    this.message = message;
    this.tone = tone;
  }

  private render(): void {
    const { level, inputs, tests, probes, diagnosis, mistakes, status } = this.game;
    const expected = simulateCircuit(level, inputs) as Bits;
    const match = testMatching(this.game, inputs);
    const current: TestRecord | null = match === null ? null : tests[match];
    const model: FaultFinderViewModel = {
      level,
      levelIndex: this.levelIndex,
      levelCount: this.levels.length,
      inputs,
      expected,
      current,
      tests,
      probes,
      diagnosis,
      revealed: status === 'playing' ? null : level.faults,
      testsLeft: testsLeft(this.game),
      probesLeft: probesLeft(this.game),
      lives: level.maxMistakes - mistakes,
      maxLives: level.maxMistakes,
      suspects: countSuspects(this.game),
      best: this.best[level.id] ?? null,
      message: this.message,
      tone: this.tone,
      playing: status === 'playing',
      action: status === 'won' ? 'next' : status === 'lost' ? 'restart' : null,
    };
    this.view.render(model);
  }
}
