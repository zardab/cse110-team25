import type { ScreenController } from "../screenTypes.ts";
import { DEFAULT_BUTTON_LABEL, TutorialView } from "./TutorialView.ts";

/** Where the tutorial goes when the player is done, if not the default. */
export interface TutorialExit {
	label: string;
	onExit: () => void;
}

/**
 * Shows How to Play. After the opening cutscene it moves on to the level selector;
 * opened from a level with setExit, it goes back to that level instead.
 */
export class TutorialController implements ScreenController {
	private view: TutorialView;
	private active = false;
	private exit?: TutorialExit;

	constructor(
		width: number,
		height: number,
		private onContinue: () => void,
	) {
		this.view = new TutorialView(width, height, () => this.finish());
	}

	/** Sends the next finish to `exit` instead of the level selector. Cleared on stop. */
	setExit(exit: TutorialExit): void {
		this.exit = exit;
		this.view.setButtonLabel(exit.label);
	}

	// Enter moves on. Held keys are ignored so a held skip key from the cutscene can't skip this too.
	private handleKeyDown = (event: KeyboardEvent): void => {
		if (event.code === "Enter" && !event.repeat && this.active) {
			event.preventDefault();
			this.finish();
		}
	};

	private finish(): void {
		if (!this.active) return;
		const exit = this.exit;
		this.stop();
		if (exit) exit.onExit();
		else this.onContinue();
	}

	start(): void {
		this.active = true;
		window.addEventListener("keydown", this.handleKeyDown);
	}

	stop(): void {
		this.active = false;
		window.removeEventListener("keydown", this.handleKeyDown);
		if (this.exit) {
			this.exit = undefined;
			this.view.setButtonLabel(DEFAULT_BUTTON_LABEL);
		}
	}

	getView(): TutorialView {
		return this.view;
	}
}
