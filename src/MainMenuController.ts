import { MainMenu } from "./MainMenu.ts";
import type { ScreenSwitcher } from "./types.ts";

export class MainMenuController {
	private menu: MainMenu;
	private screenSwitcher: ScreenSwitcher;

	constructor(screenSwitcher: ScreenSwitcher, width: number, height: number) {
		this.screenSwitcher = screenSwitcher;
		this.menu = new MainMenu(width, height, () => this.handleStartClick());
	}

	private handleStartClick(): void {
		this.screenSwitcher.switchToScreen({ type: "cutscene1" });
	}

	getGroup() {
		return this.menu.getGroup();
	}
}