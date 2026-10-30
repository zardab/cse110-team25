import { Cutscene1 } from "./Cutscene1.ts";

type Line = { atMs: number; text: string; bounce?: boolean };

export class Cutscene1Controller {
	private view: Cutscene1;
	private onFinish: () => void;

	// The script: what to say and when (milliseconds after the cutscene starts)
	private lines: Line[] = [
		{ atMs: 500, text: "Alright, time to finally doomscroll..." },
		{ atMs: 7000, text: "Was that the breaker box?", bounce: true },
		{ atMs: 10000, text: "[sigh] Time to fix some circuits...", bounce: true },
	];
	private blackScreenMs = 2000; // when the black screen disappears
    private darknessMs = 6000; // when the room starts getting dark
	private endMs = 13000; // when the cutscene ends

	constructor(width: number, height: number, onFinish: () => void = () => {}) {
		this.view = new Cutscene1(width, height);
		this.onFinish = onFinish;
	}

	// Call this after the cutscene's group has been added to a layer
	start(): void {
		setTimeout(() => this.view.hideBlackScreen(), this.blackScreenMs);

		for (const line of this.lines) {
			setTimeout(() => {
				this.view.showSubtitle(line.text);
				if (line.bounce) {
					this.view.bounceImage();
				}
			}, line.atMs);
		}
        setTimeout(() => this.view.darken(), this.darknessMs);

		setTimeout(() => {
			this.view.clearSubtitle();
			this.onFinish();
		}, this.endMs);
	}

	getGroup() {
		return this.view.getGroup();
	}
}