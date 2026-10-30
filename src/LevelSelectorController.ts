import { LevelSelector } from "./LevelSelector.ts";

export class LevelSelectorController {
	private view: LevelSelector;

	constructor(width: number, height: number) {
		this.view = new LevelSelector(width, height, () => this.handleLevelClick());
	}

	private handleLevelClick(): void {
		// TODO: switch to the level once that scene exists
		console.log("Level 1 clicked");
	}

	getGroup() {
		return this.view.getGroup();
	}
}