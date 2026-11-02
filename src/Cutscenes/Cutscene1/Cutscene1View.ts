
import Konva from "konva";
import type { View } from "../../screenTypes.ts";
import { loadImage } from "../../ui_behavior/loadImage.ts";
import coblenzeUrl from "../../assets/Coblenze.png";
import backgroundUrl from "../../assets/bedroomBackground.jpg";

// All positions and dimensions are relative to screen size
const COBLENZE_IMAGE = {
	x: 0.5,
	y: 0.21,
	width: 0.5,
	height: 0.5,
};

const MONITOR = {
	x: 0.2875,
	y: 0.554,
	width: 0.405,
	height: 0.396,
};

/**
 * Cutscene1View - Renders cutscene 1: a background, Coblenze and a monitor,
 * a black screen, subtitles, and a darkness overlay.
 */
export class Cutscene1View implements View {
	private group = new Konva.Group();
	private background: Konva.Image;
	private blackScreen: Konva.Rect;
	private image: Konva.Image;
	private subtitle: Konva.Text;
	private darkness: Konva.Rect;
	private imageBaseY: number;

	constructor(width: number, height: number) {
		// Background image
		this.background = new Konva.Image({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			image: undefined,
		});
		this.group.add(this.background);

		loadImage(backgroundUrl).then((img) => {
			const scale = Math.max(
				width / img.naturalWidth,
				height / img.naturalHeight,
			);
			const w = img.naturalWidth * scale;
			const h = img.naturalHeight * scale;

			this.background.image(img);
			this.background.size({ width: w, height: h });
			this.background.position({
				x: (width - w) / 2,
				y: (height - h) / 2,
			});
			this.group.getLayer()?.draw();
		});

		// Coblenze
		const imageWidth = width * COBLENZE_IMAGE.width;
		const imageHeight = height * COBLENZE_IMAGE.height;

		this.imageBaseY = height * COBLENZE_IMAGE.y;

		this.image = new Konva.Image({
			x: width * COBLENZE_IMAGE.x,
			y: this.imageBaseY,
			width: imageWidth,
			height: imageHeight,
			offsetX: imageWidth / 2,
			image: undefined,
		});
		this.group.add(this.image);

		loadImage(coblenzeUrl).then((img) => {
			this.image.image(img);
			this.group.getLayer()?.draw();
		});

		// Monitor
		this.group.add(
			new Konva.Rect({
				x: width * MONITOR.x,
				y: height * MONITOR.y,
				width: width * MONITOR.width,
				height: height * MONITOR.height,
				fill: "gray",
			}),
		);

		// Black screen
		this.blackScreen = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "black",
		});
		this.group.add(this.blackScreen);

		// Darkness overlay
		this.darkness = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: "black",
			opacity: 0,
		});
		this.group.add(this.darkness);

		// Subtitles
		this.subtitle = new Konva.Text({
			x: width * 0.1,
			y: height * 0.85,
			width: width * 0.8,
			text: "",
			fontSize: height * 0.04,
			fill: "white",
			align: "center",
		});
		this.group.add(this.subtitle);
	}

	hideBlackScreen(): void {
		this.blackScreen.visible(false);
		this.group.getLayer()?.draw();
	}

	darken(durationSeconds = 0.1, targetOpacity = 0.7): void {
		this.darkness.to({
			opacity: targetOpacity,
			duration: durationSeconds,
			easing: Konva.Easings.Linear,
		});
	}

	/** Talking bounce animation */
	bounceImage(
		distance = 30,
		durationSeconds = 0.15,
		onFinish?: () => void,
	): void {
		this.image.to({
			y: this.imageBaseY - distance,
			duration: durationSeconds,
			easing: Konva.Easings.Linear,
			onFinish: () => {
				this.image.to({
					y: this.imageBaseY,
					duration: durationSeconds,
					easing: Konva.Easings.Linear,
					onFinish,
				});
			},
		});
	}

	/** Mirrors Coblenze left to right */
	flipImage(): void {
		this.image.scaleX(-this.image.scaleX());
		this.group.getLayer()?.draw();
	}

	showSubtitle(text: string): void {
		this.subtitle.text(text);
		this.group.getLayer()?.draw();
	}

	clearSubtitle(): void {
		this.subtitle.text("");
		this.group.getLayer()?.draw();
	}

	show(): void {
		this.blackScreen.visible(true);
		this.darkness.opacity(0);
		this.subtitle.text("");
		this.image.y(this.imageBaseY);
		this.image.scaleX(1);
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
