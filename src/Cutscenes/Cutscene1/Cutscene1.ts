import Konva from "konva";
import coblenzeUrl from "../../assets/Coblenze.png";
import backgroundUrl from "../../assets/bedroomBackground.jpg";

// Everything in the scene is laid out in "design pixels", measured from the
// top-left corner of the Coblenze image. The whole scene is then scaled to fit
// the screen, so the monitor always stays in the same place relative to him.
const IMAGE_SIZE = 750;
const MONITOR = { x: -300, y: 700, width: 1000, height: 550 };

export class Cutscene1 {
	private group = new Konva.Group();
	private background: Konva.Image;
	private scene: Konva.Group; // container holding the image and monitor
	private blackScreen: Konva.Rect;
	private image: Konva.Image;
	private baseY = 0; // the image's resting height (in design pixels)
	private subtitle: Konva.Text;
	private darkness: Konva.Rect;

	constructor(width: number, height: number) {
		// Background image, added first so it sits behind everything
		this.background = new Konva.Image({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			image: undefined, // filled in once the file loads
		});
		this.group.add(this.background);

		const bgImg = new Image();
		bgImg.onload = () => {
			// "Cover" fit: scale up until the screen is filled, keeping the
			// picture's shape. Whatever sticks out is cut off by the canvas edge.
			const scale = Math.max(
				width / bgImg.naturalWidth,
				height / bgImg.naturalHeight,
			);
			const w = bgImg.naturalWidth * scale;
			const h = bgImg.naturalHeight * scale;
			this.background.image(bgImg);
			this.background.size({ width: w, height: h });
			this.background.position({ x: (width - w) / 2, y: (height - h) / 2 });
			this.group.getLayer()?.draw();
		};
		bgImg.src = backgroundUrl;

		// Work out how big the scene is in design pixels
		const left = Math.min(0, MONITOR.x);
		const top = Math.min(0, MONITOR.y);
		const right = Math.max(IMAGE_SIZE, MONITOR.x + MONITOR.width);
		const bottom = Math.max(IMAGE_SIZE, MONITOR.y + MONITOR.height);
		const sceneWidth = right - left;
		const sceneHeight = bottom - top;

		// Scale the scene to fit the screen (0.9 leaves a small margin), then center it
		const scale = Math.min(width / sceneWidth, height / sceneHeight) * 0.9;
		this.scene = new Konva.Group({
			scaleX: scale,
			scaleY: scale,
			x: (width - sceneWidth * scale) / 2 - left * scale,
			y: (height - sceneHeight * scale) / 2 - top * scale,
		});
		this.group.add(this.scene);

		// The image (its top-left corner is the scene's origin)
		this.image = new Konva.Image({
			x: 0,
			y: this.baseY,
			width: IMAGE_SIZE,
			height: IMAGE_SIZE,
			image: undefined, // filled in once the file loads
		});
		this.scene.add(this.image);

		const img = new Image();
		img.onload = () => {
			this.image.image(img);
			this.group.getLayer()?.draw();
		};
		img.src = coblenzeUrl;

		// Computer monitor rect (the back of the monitor), in front of the image
		this.scene.add(
			new Konva.Rect({
				x: MONITOR.x,
				y: MONITOR.y,
				width: MONITOR.width,
				height: MONITOR.height,
				fill: "gray",
			}),
		);

		// Black screen, covering the whole scene
		this.blackScreen = new Konva.Rect({
			x: 0,
			y: 0,
			width: width,
			height: height,
			fill: "black",
		});
		this.group.add(this.blackScreen);

		

		// Darkness: added last, so it sits above everything else.
		// Starts fully transparent; darken() fades it in.
		this.darkness = new Konva.Rect({
			x: 0,
			y: 0,
			width: width,
			height: height,
			fill: "black",
			opacity: 0,
		});
		this.group.add(this.darkness);

		// Subtitles: just text, added on top of the black screen
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

	// Fade the darkness from fully transparent to semi-transparent
	darken(durationSeconds = 0.1, targetOpacity = 0.8): void {
		this.darkness.to({
			opacity: targetOpacity,
			duration: durationSeconds,
			easing: Konva.Easings.Linear,
		});
	}

	//talking bounce animation
	bounceImage(distance = 40, durationSeconds = 0.15, onFinish?: () => void): void {
		this.image.to({
			y: this.baseY - distance,
			duration: durationSeconds,
			easing: Konva.Easings.Linear,
			onFinish: () => {
				this.image.to({
					y: this.baseY,
					duration: durationSeconds,
					easing: Konva.Easings.Linear,
					onFinish: onFinish,
				});
			},
		});
	}

	showSubtitle(text: string): void {
		this.subtitle.text(text);
		this.group.getLayer()?.draw();
	}

	clearSubtitle(): void {
		this.subtitle.text("");
		this.group.getLayer()?.draw();
	}

	getGroup(): Konva.Group {
		return this.group;
	}
}