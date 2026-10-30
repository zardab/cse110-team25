import Konva from "konva";
import menuImageUrl from "./assets/levelSelectorMenu.png";

// Laid out in "design pixels", measured from the menu image's top-left corner.
// Set IMAGE to your picture's real width and height so it isn't stretched.
const IMAGE = { width: 800, height: 600 };
const BUTTON = { x: 300, y: 450, width: 200, height: 60, label: "LEVEL 1" };

export class LevelSelector {
	private group = new Konva.Group();

	constructor(width: number, height: number, onLevelClick: () => void) {
		//Black background covering the whole screen
		this.group.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: width,
				height: height,
				fill: "black",
			}),
		);

		// Container: scaled to fit the screen and centered, so the button
		const scale = Math.min(width / IMAGE.width, height / IMAGE.height) * 0.8;
		const scene = new Konva.Group({
			scaleX: scale,
			scaleY: scale,
			x: (width - IMAGE.width * scale) / 2,
			y: (height - IMAGE.height * scale) / 2,
		});
		this.group.add(scene);

		//The menu image
		const menuImage = new Konva.Image({
			x: 0,
			y: 0,
			width: IMAGE.width,
			height: IMAGE.height,
			image: undefined, // filled in once the file loads
		});
		scene.add(menuImage);

		const img = new Image();
		img.onload = () => {
			menuImage.image(img);
			this.group.getLayer()?.draw();
		};
		img.src = menuImageUrl;

		// he button, drawn on top of the image
		const button = new Konva.Group();
		button.add(
			new Konva.Rect({
				x: BUTTON.x,
				y: BUTTON.y,
				width: BUTTON.width,
				height: BUTTON.height,
				fill: "red",
				cornerRadius: 1,
			}),
		);
		button.add(
			new Konva.Text({
				x: BUTTON.x,
				y: BUTTON.y,
				width: BUTTON.width,
				height: BUTTON.height,
				text: BUTTON.label,
				fontSize: 24,
				fill: "black",
				align: "center",
				verticalAlign: "middle",
			}),
		);
		button.on("click", onLevelClick);
		scene.add(button);
	}

	getGroup(): Konva.Group {
		return this.group;
	}
}