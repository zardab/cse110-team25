import Konva from "konva";
import type { View } from "../screenTypes.ts";
import menuImageUrl from "../assets/levelSelectorMenu.png";

// Set IMAGE to your picture's real width and height so it isn't stretched.
const IMAGE = { width: 800, height: 550 };

type LevelButton = {
	id: string; // handed to the controller when the button is clicked
	label: string; // text shown on the button
	x: number; // center of the button, as a fraction of the screen's width (0.5 = halfway)
	y: number; // center of the button, as a fraction of the screen's height
};

// Every level button. To add a level, add one line here.
const LEVELS: LevelButton[] = [
	{ id: "level1", label: "LEVEL 1", x: 0.5, y: 0.68 },
	// { id: "level2", label: "LEVEL 2", x: 0.35, y: 0.5 },
];

// All buttons share this look (sizes are in screen pixels)
const BUTTON_STYLE = { width: 235, height: 63, fontSize: 31 };

/**
 * LevelSelectorView - Renders the level selector: a black screen with a
 * centered menu image and one labeled button per level
 */
export class LevelSelectorView implements View {
	private group = new Konva.Group();

	constructor(
		width: number,
		height: number,
		onLevelClick: (levelId: string) => void,
	) {
		//black cutscene box
		this.group.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: width,
				height: height,
				fill: "black",
			}),
		);

		// The menu image, scaled to fit the screen and centered.
		// fromURL loads the file, then hands us the finished image shape.
		const scale = Math.min(width / IMAGE.width, height / IMAGE.height) * 0.8;
		Konva.Image.fromURL(menuImageUrl, (menuImage) => {
			menuImage.position({
				x: (width - IMAGE.width * scale) / 2,
				y: (height - IMAGE.height * scale) / 2,
			});
			menuImage.size({
				width: IMAGE.width * scale,
				height: IMAGE.height * scale,
			});
			this.group.add(menuImage);
			menuImage.zIndex(1); // above the black background, below the buttons
			this.group.getLayer()?.draw();
		});

		// One button per entry in LEVELS
		for (const level of LEVELS) {
			this.group.add(this.createButton(level, width, height, onLevelClick));
		}
	}

	/** Builds one button, centered on the position given in its LEVELS entry. */
	private createButton(
		level: LevelButton,
		width: number,
		height: number,
		onLevelClick: (levelId: string) => void,
	): Konva.Group {
		const x = width * level.x - BUTTON_STYLE.width / 2;
		const y = height * level.y - BUTTON_STYLE.height / 2;

		const button = new Konva.Group();
		button.add(
			new Konva.Rect({
				x: x,
				y: y,
				width: BUTTON_STYLE.width,
				height: BUTTON_STYLE.height,
				fill: "red",
				cornerRadius: 0,
			}),
		);
		button.add(
			new Konva.Text({
				x: x,
				y: y,
				width: BUTTON_STYLE.width,
				height: BUTTON_STYLE.height,
				text: level.label,
				fontSize: BUTTON_STYLE.fontSize,
				fill: "black",
				align: "center",
				verticalAlign: "middle",
			}),
		);
		button.on("click", () => onLevelClick(level.id));
		return button;
	}

	show(): void {
		this.group.visible(true);
		this.group.getLayer()?.draw();
	}

	hide(): void {
		this.group.visible(false);
		this.group.getLayer()?.draw();
	}

	getGroup(): Konva.Group {
		return this.group;
	}
}