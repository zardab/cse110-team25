import type { ScreenController } from "../../screenTypes.ts";
import { Cutscene2View } from "./Cutscene2View.ts";

export class Cutscene2Controller implements ScreenController {
	private view: Cutscene2View;
	private onFinish: () => void;
	private timers: number[] = [];
	private active = false;
	private creditsVisible = false;

	private walkDurationMs = 3000;
	private subtitleDurationMs = 3000;
	private fadeDurationSeconds = 3;
	private creditsDelayMs = 1000;

	constructor(width: number, height: number, onFinish: () => void) {
		this.view = new Cutscene2View(width, height, () => this.returnToMenu());
		this.onFinish = onFinish;
	}

	start(): void {
		this.stop();
		this.active = true;
		this.creditsVisible = false;
		this.view.show();
		window.addEventListener("keydown", this.handleKeyDown);

		this.view.walkIn(this.walkDurationMs, () => {
			if (!this.active) return;
			this.view.showSubtitle("Alrightly! I can doomscroll now!");
			this.view.bounceImage();
			this.after(this.subtitleDurationMs, () => {
				this.view.clearSubtitle();
				this.view.fadeToBlack(this.fadeDurationSeconds, () => {
					if (!this.active) return;
					this.view.showThanks();
					this.after(this.creditsDelayMs, () => {
						this.view.showCredits();
						this.creditsVisible = true;
						this.view.showMenuButton();
					});
				});
			});
		});
	}

	// Space skips to the credits or returns to the menu.
	private handleKeyDown = (event: KeyboardEvent): void => {
		if (event.code !== "Space" || !this.active || event.repeat) return;
		event.preventDefault();
		if (!this.creditsVisible) {
			this.stop();
			this.active = true;
			window.addEventListener("keydown", this.handleKeyDown);
			this.view.fadeToBlack(0.1, () => {
				if (!this.active) return;
				this.view.showThanks();
				this.view.showCredits();
				this.creditsVisible = true;
				this.view.showMenuButton();
			});
			return;
		}
		this.returnToMenu();
	};

	private returnToMenu(): void {
		if (!this.active || !this.creditsVisible) return;
		this.stop();
		this.onFinish();
	}

	stop(): void {
		this.active = false;
		window.removeEventListener("keydown", this.handleKeyDown);
		for (const id of this.timers) window.clearTimeout(id);
		this.timers = [];
		this.view.stopAnimations();
		this.view.clearSubtitle();
	}

	getView(): Cutscene2View {
		return this.view;
	}

	private after(delayMs: number, action: () => void): void {
		this.timers.push(window.setTimeout(() => {
			if (this.active) action();
		}, delayMs));
	}
}
