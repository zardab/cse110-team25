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
		this.view = new MainMenuView(width, height, () => this.handleStartClick());
	}

	/** Called each time the menu appears. */
	start(): void {
		this.startClicked = false;
	}

	/**
	 * Handle start button click. Only the first click counts: the button
	 * ignores input while the menu fades out.
	 */
	private handleStartClick(): void {
		if (this.startClicked) return;
		this.startClicked = true;

		this.view.fadeOut(() =>
			this.screenSwitcher.switchToScreen({ type: "cutscene1" }),
		);
	}

	getView(): MainMenuView {
		return this.view;
	}
}