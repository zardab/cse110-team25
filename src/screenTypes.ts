import type Konva from "konva";

//List of every screen/scene. Add new ones here.
export type ScreenId =
	| { type: "menu" }
	| { type: "cutscene1" }
	| { type: "levelSelector" }
	| { type: "level1"};

/** Anything that can switch screens. */
export interface ScreenSwitcher {
	switchToScreen(screen: ScreenId): void;
}

/** What every screen's view must be able to do. */
export interface View {
	show(): void;
	hide(): void;
	getGroup(): Konva.Group;
}

/**
 * What every screen's controller must provide.
 * start() runs when the screen appears, stop() when it goes away (or the
 * game shuts down). Both are optional: only screens that need them define them.
 */
export interface ScreenController {
	getView(): View;
	start?(): void;
	stop?(): void;
}
