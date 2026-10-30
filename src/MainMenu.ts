import Konva from "konva";
import titleUrl from "./assets/gameTitle.png";

// How long each fade takes, in seconds
const IMAGE_FADE_SECONDS = 2;
const BUTTON_FADE_SECONDS = 1;

export class MainMenu {
	private group = new Konva.Group();

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
		const titleImage = new Konva.Image({
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			image: undefined, // filled in once the file loads
		});
		this.group.add(titleImage);

		// Button: the rectangle and text sit at (0, 0) inside the group,
		// and layout() moves the whole group into place
		const buttonWidth = 200;
		const buttonHeight = 60;

		const button = new Konva.Group({ visible: false });
		button.add(
			new Konva.Rect({
				x: 0,
				y: 0,
				width: buttonWidth,
				height: buttonHeight,
				fill: "black",
				cornerRadius: 1,
			}),
		);
		button.add(
			new Konva.Text({
				x: 0,
				y: 0,
				width: buttonWidth,
				height: buttonHeight,
				text: "START",
				fontSize: 24,
				fill: "white",
				align: "center",
				verticalAlign: "middle",
			}),
		);

		// On click: fade the image out, then the button, then tell the controller
		button.on("click", () => {
			// Remove the handler right away, so the button ignores every
			// click after the first one
			button.off("click");

			titleImage.to({
				opacity: 0,
				duration: IMAGE_FADE_SECONDS,
				easing: Konva.Easings.Linear,
				onFinish: () => {
					button.to({
						opacity: 0,
						duration: BUTTON_FADE_SECONDS,
						easing: Konva.Easings.Linear,
						onFinish: onStartClick,
					});
				},
			});
		});
		this.group.add(button);

		// Centers the title image and the button on the screen as one block:
		// image on top, a gap, then the button
		const gap = height * 0.05;
		const layout = (imageWidth: number, imageHeight: number) => {
			const totalHeight = imageHeight + gap + buttonHeight;
			const top = (height - totalHeight) / 2;

			titleImage.size({ width: imageWidth, height: imageHeight });
			titleImage.position({ x: (width - imageWidth) / 2, y: top });
			button.position({
				x: (width - buttonWidth) / 2,
				y: top + imageHeight + gap,
			});
			button.visible(true);
			this.group.getLayer()?.draw();
		};

		const titleImg = new Image();
		titleImg.onload = () => {
			// Fit within half the screen's width and 35% of its height,
			// without stretching
			const scale = Math.min(
				(width * 0.5) / titleImg.naturalWidth,
				(height * 0.35) / titleImg.naturalHeight,
			);
			titleImage.image(titleImg);
			layout(titleImg.naturalWidth * scale, titleImg.naturalHeight * scale);
		};
		titleImg.onerror = () => layout(0, 0); // no image: still show the button
		titleImg.src = titleUrl;
	}

	getGroup(): Konva.Group {
		return this.group;
	}
}