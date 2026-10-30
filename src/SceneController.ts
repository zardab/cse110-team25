import Konva from "konva";
import type { Screen, ScreenController, ScreenSwitcher } from "./types.ts";
import { MainMenuController } from "./MainMenuController.ts";
import { Cutscene1Controller } from "./Cutscenes/Cutscene1/Cutscene1Controller.ts";
import { LevelSelectorController } from "./LevelSelectorController.ts";

// The overall scene controller: owns the canvas and decides which screen is showing
export class SceneController implements ScreenSwitcher {
	private stage: Konva.Stage;
	private layer = new Konva.Layer();
	private screens: Record<Screen["type"], ScreenController>;

	constructor() {
		const width = window.innerWidth;
		const height = window.innerHeight;

		// Create the canvas (stage) and add the surface we draw on (layer)
		this.stage = new Konva.Stage({
			container: "container", // matches the div id in App.tsx
			width: width,
			height: height,
		});
		this.stage.add(this.layer);

		// Every screen, in one place. To add a screen: add it to the Screen
		// type in types.ts, then list it here (TypeScript complains if you forget).
		this.screens = {
			menu: new MainMenuController(this, width, height),
			cutscene1: new Cutscene1Controller(width, height, () =>
				this.switchToScreen({ type: "levelSelector" }),
			),
			levelSelector: new LevelSelectorController(width, height),
		};

		for (const screen of Object.values(this.screens)) {
			this.layer.add(screen.getGroup());
		}

		this.switchToScreen({ type: "menu" });
	}

	// Shows one screen, hides the rest, and starts the new one if it has a start()
	switchToScreen(screen: Screen): void {
		for (const [name, controller] of Object.entries(this.screens)) {
			controller.getGroup().visible(name === screen.type);
		}
		this.layer.draw();
		this.screens[screen.type].start?.();
	}

	// Removes the canvas (React calls this when the component goes away)
	destroy(): void {
		this.stage.destroy();
	}
}

new SceneController();