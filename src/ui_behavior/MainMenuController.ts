
import type { ScreenController, ScreenSwitcher } from "../screenTypes.ts";
import { MainMenuView } from "./MainMenuView.ts";

/**
 * MainMenuController - Handles main menu interactions
 */
export class MainMenuController implements ScreenController {
	private view: MainMenuView;
	private screenSwitcher: ScreenSwitcher;
	private startClicked = false;

	constructor(screenSwitcher: ScreenSwitcher, width: number, height: number) {
		this.screenSwitcher = screenSwitcher;

		this.view = new MainMenuView(
			width,
			height,
			() => this.handleStartClick(),
			() => this.handleMinigame1Click(),
			() => this.handleMinigame2Click(),
			() => this.handleMinigame3Click(),
		);
	}

	start(): void {
		this.startClicked = false;
	}

	// Main game: START -> Cutscene 1
	private handleStartClick(): void {
		if (this.startClicked) return;
		this.startClicked = true;

		this.view.fadeOut(() =>
			this.screenSwitcher.switchToScreen({ type: "cutscene1" }),
		);
	}

	// Standalone Minigame 1
	private handleMinigame1Click(): void {
		if (this.startClicked) return;
		this.startClicked = true;

		this.screenSwitcher.switchToScreen({ type: "minigame1" });
	}

	// Standalone Minigame 2
	private handleMinigame2Click(): void {
		if (this.startClicked) return;
		this.startClicked = true;

		this.screenSwitcher.switchToScreen({ type: "minigame2" });
	}

	// Standalone Minigame 3
	private handleMinigame3Click(): void {
		if (this.startClicked) return;
		this.startClicked = true;

		this.screenSwitcher.switchToScreen({ type: "minigame3" });
	}

	getView(): MainMenuView {
		return this.view;
	}
}
