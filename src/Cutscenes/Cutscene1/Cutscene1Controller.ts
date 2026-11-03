
import type { ScreenController } from "../../screenTypes.ts";
import { Cutscene1View } from "./Cutscene1View.ts";

type Line = { atMs: number; text: string; bounce?: boolean };

/**
 * Cutscene1Controller - Runs the timing of cutscene 1: when the black screen
 * lifts, which subtitles appear, and when the darkness arrives.
 */
export class Cutscene1Controller implements ScreenController {
	private view: Cutscene1View;
	private onFinish: () => void;
	private timers: number[] = [];
	private subtitleTimer?: number;

	// Subtitle display duration
	private subtitleDurationMs = 1000;

	// The script: what to say and when (milliseconds after the cutscene starts)
	private lines: Line[] = [
		{ atMs: 500, text: "It's dark in here..." },

		{ atMs: 3500, text: "There we go!", bounce: true },

		{ atMs: 5000, text: "Finally, time to doomscroll!", bounce: true },

		{ atMs: 12500, text: "Was that the breaker box?", bounce: true },

		{ atMs: 15000, text: "Time to fix some circuits.", bounce: true },
	];

	private blackScreenMs = 2000;
	private darknessMs = 9000;
	private flipMs1 = 11000;
	private flipMs2 = 12000;
	private endMs = 17000;

	constructor(width: number, height: number, onFinish: () => void) {
		this.view = new Cutscene1View(width, height);
		this.onFinish = onFinish;
	}

	/** Called each time the cutscene appears. */
	start(): void {
		this.stop();

		this.after(this.blackScreenMs, () => this.view.hideBlackScreen());

		for (const line of this.lines) {
			this.after(line.atMs, () => {
				this.showSubtitle(line.text);

				if (line.bounce) {
					this.view.bounceImage();
				}
			});
		}

		this.after(this.darknessMs, () => this.view.darken());

		this.after(this.flipMs1, () => this.view.flipImage());
		this.after(this.flipMs2, () => this.view.flipImage());

		this.after(this.endMs, () => {
			this.clearSubtitle();
			this.onFinish();
		});
	}

	/** Shows a subtitle and automatically clears it after the display duration. */
	private showSubtitle(text: string): void {
		// Cancel the previous subtitle's dismissal timer
		if (this.subtitleTimer !== undefined) {
			window.clearTimeout(this.subtitleTimer);
		}

		this.view.showSubtitle(text);

		this.subtitleTimer = window.setTimeout(() => {
			this.view.clearSubtitle();
			this.subtitleTimer = undefined;
		}, this.subtitleDurationMs);
	}

	/** Clears the subtitle and its pending timer. */
	private clearSubtitle(): void {
		if (this.subtitleTimer !== undefined) {
			window.clearTimeout(this.subtitleTimer);
			this.subtitleTimer = undefined;
		}

		this.view.clearSubtitle();
	}

	/** Cancels every pending timer (called when leaving the screen). */
	stop(): void {
		for (const id of this.timers) {
			window.clearTimeout(id);
		}
		this.timers = [];

		this.clearSubtitle();
	}

	getView(): Cutscene1View {
		return this.view;
	}

	/** Runs an action after a delay, remembering the timer so stop() can cancel it. */
	private after(delayMs: number, action: () => void): void {
		this.timers.push(window.setTimeout(action, delayMs));
	}
}
