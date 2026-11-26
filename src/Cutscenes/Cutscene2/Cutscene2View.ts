
import Konva from "konva";
import type { View } from "../../screenTypes.ts";
import { loadImage } from "../../ui_behavior/loadImage.ts";

import coblenzeUrl from "../../assets/Coblenze.png";
import backgroundUrl from "../../assets/bedroomBackground.jpg";
import monitorUrl from "../../assets/monitor.png";

// All positions and dimensions are relative to screen size
const COBLENZE_IMAGE = {
	x: 0.5,
	y: 0.38,
	width: 0.38,
	height: 0.5,
};

const MONITOR = {
	x: 0.288,
	y: 0.64,
	width: 0.405,
	height: 0.45,
};

/**
 * Cutscene2View - Renders cutscene 2: a background, Coblenze,
 * a monitor image, a black screen, subtitles, and a darkness overlay.
 */
export class Cutscene2View implements View {
	private group = new Konva.Group();
	private background: Konva.Image;
	private blackScreen: Konva.Rect;
	private image: Konva.Image;
	private subtitle: Konva.Text;
	private imageBaseY: number;
	private imageBaseX: number;
	private imageStartX: number;
	private walk?: Konva.Animation;
	private fade?: Konva.Tween;
	private bounce?: Konva.Tween;
	private thanks: Konva.Text;
	private credits: Konva.Text;
	private menuButton: Konva.Group;

	constructor(width: number, height: number, onMenuClick: () => void) {
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
		this.imageBaseX = width * COBLENZE_IMAGE.x;
		this.imageStartX = width + imageWidth / 2;

		this.image = new Konva.Image({
			x: this.imageStartX,
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

		// Monitor image
		const monitor = new Konva.Image({
			x: width * MONITOR.x,
			y: height * MONITOR.y,
			width: width * MONITOR.width,
			height: height * MONITOR.height,
			image: undefined,
			listening: false,
		});
		this.group.add(monitor);

		loadImage(monitorUrl).then((img) => {
			monitor.image(img);
			this.group.getLayer()?.draw();
		});

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

		// Ending overlay (above the room and subtitles)
		this.blackScreen = new Konva.Rect({
			x: 0, y: 0, width, height, fill: "black", opacity: 0,
			listening: false,
		});
		this.group.add(this.blackScreen);

		this.thanks = new Konva.Text({
			x: 0, y: height * 0.2, width,
			text: "Thanks for playing!!", fontSize: height * 0.065,
			fill: "white", align: "center", visible: false,
		});
		this.group.add(this.thanks);

		this.credits = new Konva.Text({
			x: width * 0.1, y: height * 0.32, width: width * 0.8,
			text: "Team 25\n\nJoey Fitzjerald\nAllen Guo\nManeesh Bijjula\nDamian Barlett\nZheyu Chen\nClaude LLM",
			fontSize: height * 0.035, lineHeight: 1.5,
			fill: "white", align: "center", visible: false,
		});
		this.group.add(this.credits);

		// Return button, centered below the credits.
		const buttonWidth = width * 0.28;
		const buttonHeight = height * 0.065;
		this.menuButton = new Konva.Group({
			x: (width - buttonWidth) / 2,
			y: this.credits.y() + this.credits.height() + height * 0.05,
			visible: false,
		});
		this.menuButton.add(new Konva.Rect({
			width: buttonWidth,
			height: buttonHeight,
			fill: "black",
			stroke: "white",
			strokeWidth: 1,
			cornerRadius: 4,
		}));
		this.menuButton.add(new Konva.Text({
			width: buttonWidth,
			height: buttonHeight,
			text: "Return to Main Menu",
			fontSize: height * 0.03,
			fill: "white",
			align: "center",
			verticalAlign: "middle",
		}));
		this.menuButton.on("click tap", onMenuClick);
		this.group.add(this.menuButton);
	}

	walkIn(durationMs = 3000, onFinish?: () => void): void {
		this.walk?.stop();
		this.image.x(this.imageStartX);
		this.walk = new Konva.Animation((frame) => {
			if (!frame) return;
			const progress = Math.min(frame.time / durationMs, 1);
			this.image.x(this.imageStartX + (this.imageBaseX - this.imageStartX) * progress);
			this.image.y(this.imageBaseY - Math.abs(Math.sin(frame.time / 100)) * this.image.height() * 0.035);
			if (progress === 1) {
				this.walk?.stop();
				this.image.y(this.imageBaseY);
				onFinish?.();
			}
		}, this.group.getLayer() ?? undefined);
		this.walk.start();
	}

	bounceImage(): void {
		this.bounce?.destroy();
		this.bounce = new Konva.Tween({
			node: this.image, y: this.imageBaseY - this.image.height() * 0.06, duration: 0.15,
			onFinish: () => {
				this.bounce?.destroy();
				this.bounce = new Konva.Tween({ node: this.image, y: this.imageBaseY, duration: 0.15 });
				this.bounce.play();
			},
		});
		this.bounce.play();
	}

	fadeToBlack(durationSeconds = 3, onFinish?: () => void): void {
		this.fade?.destroy();
		this.fade = new Konva.Tween({
			node: this.blackScreen, opacity: 1, duration: durationSeconds,
			easing: Konva.Easings.Linear, onFinish,
		});
		this.fade.play();
	}

	showThanks(): void {
		this.thanks.visible(true);
		this.group.getLayer()?.draw();
	}

	showCredits(): void {
		this.credits.visible(true);
		this.group.getLayer()?.draw();
	}

	showMenuButton(): void {
		this.menuButton.visible(true);
		this.group.getLayer()?.draw();
	}

	showSubtitle(text: string): void {
		this.subtitle.text(text);
		this.group.getLayer()?.draw();
	}

	clearSubtitle(): void {
		this.showSubtitle("");
	}

	stopAnimations(): void {
		this.walk?.stop();
		this.fade?.destroy();
		this.bounce?.destroy();
		this.walk = undefined;
		this.fade = undefined;
		this.bounce = undefined;
	}

	show(): void {
		this.stopAnimations();
		this.blackScreen.opacity(0);
		this.thanks.visible(false);
		this.credits.visible(false);
		this.menuButton.visible(false);
		this.subtitle.text("");
		this.image.position({ x: this.imageStartX, y: this.imageBaseY });
		this.group.visible(true);
		this.group.getLayer()?.draw();
	}

	hide(): void {
		this.stopAnimations();
		this.group.visible(false);
		this.group.getLayer()?.draw();
	}

	getGroup(): Konva.Group {
		return this.group;
	}
}
