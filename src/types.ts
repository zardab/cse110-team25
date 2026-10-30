import type Konva from "konva";

// Every screen that exists. Add new ones here.
export type Screen =
	| { type: "menu" }
	| { type: "cutscene1" }
	| { type: "levelSelector" };

// Anything that can switch screens
export interface ScreenSwitcher {
	switchToScreen(screen: Screen): void;
}

// What every screen's controller must provide.
// start() is optional: only screens that need to do something when they
// appear (like playing a cutscene) need it.
export interface ScreenController {
	getGroup(): Konva.Group;
	start?(): void;
}