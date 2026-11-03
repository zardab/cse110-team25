import Konva from "konva";
import type { View } from "../screenTypes.ts";
import { loadImage } from "./loadImage.ts";
import titleUrl from "../assets/gameTitle.png";

// How long each fade takes, in seconds
const IMAGE_FADE_SECONDS = 2;
const BUTTON_FADE_SECONDS = 1;

const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 60;

/**
 * MainMenuView - Renders the main menu: a title image and a START button,
 * centered together on a black background
 */
export class MainMenuView implements View {
	private group = new Konva.Group();
	private titleImage: Konva.Image;
	private button: Konva.Group;

	constructor(width: number, height: number, onStartClick: () => void) {
		// Black background covering the whole canvas
		this.group.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: width,
				height: height,
				fill: "black",
			}),
		);

		// Title image. Its size and position are set in layout() once it loads.
		this.titleImage = new Konva.Image({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			image: undefined, // filled in once the file loads
		});
		this.group.add(this.titleImage);

		// Button: the rectangle and text sit at (0, 0) inside the group,
		// and layout() moves the whole group into place
		this.button = new Konva.Group({ visible: false });
		this.button.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: BUTTON_WIDTH,
				height: BUTTON_HEIGHT,
				fill: "black",
				cornerRadius: 1,
			}),
		);
		this.button.add(
			new Konva.Text({
				x: 0,
				y: 0,
				width: BUTTON_WIDTH,
				height: BUTTON_HEIGHT,
				text: "START",
				fontSize: 24,
				fill: "white",
				align: "center",
				verticalAlign: "middle",
			}),
		);
		// The view only reports the click; the controller decides what it means
		this.button.on("click", onStartClick);
		this.group.add(this.button);

		// Centers the title image and the button on the screen as one block:
		// image on top, a gap, then the button
		const gap = height * 0.05;
		const layout = (imageWidth: number, imageHeight: number) => {
			const totalHeight = imageHeight + gap + BUTTON_HEIGHT;
			const top = (height - totalHeight) / 2;

			this.titleImage.size({ width: imageWidth, height: imageHeight });
			this.titleImage.position({ x: (width - imageWidth) / 2, y: top });
			this.button.position({
				x: (width - BUTTON_WIDTH) / 2,
				y: top + imageHeight + gap,
			});
			this.button.visible(true);
			this.group.getLayer()?.draw();
		};

		loadImage(titleUrl).then(
			(img) => {
				// Fit within half the screen's width and 35% of its height,
				// without stretching
				const scale = Math.min(
					(width * 0.5) / img.naturalWidth,
					(height * 0.35) / img.naturalHeight,
				);
				this.titleImage.image(img);
				layout(img.naturalWidth * scale, img.naturalHeight * scale);
			},
			() => layout(0, 0), // no image: still show the button
		);
	}

	/** Fades the title image out, then the button, then calls onDone. */
	fadeOut(onDone: () => void): void {
		this.titleImage.to({
			opacity: 0,
			duration: IMAGE_FADE_SECONDS,
			easing: Konva.Easings.Linear,
			onFinish: () => {
				this.button.to({
					opacity: 0,
					duration: BUTTON_FADE_SECONDS,
					easing: Konva.Easings.Linear,
					onFinish: onDone,
				});
			},
		});
	}

	show(): void {
		// Undo any fade from a previous visit
		this.titleImage.opacity(1);
		this.button.opacity(1);
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