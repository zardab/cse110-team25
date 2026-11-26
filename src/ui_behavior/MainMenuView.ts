
import Konva from "konva";
import type { View } from "../screenTypes.ts";
import { loadImage } from "./loadImage.ts";
import titleUrl from "../assets/gameTitle.png";

const IMAGE_FADE_SECONDS = 0.5;
const BUTTON_FADE_SECONDS = 1;

const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 60;

// Negative moves title upward
const TITLE_Y_OFFSET = -80;

/** Minigame 2 isn't built yet; flip this to true to make its button clickable. */
const MINIGAME_2_ENABLED = false;

export class MainMenuView implements View {
  private group = new Konva.Group();
  private titleImage: Konva.Image;
  private button: Konva.Group;
  private minigame1Button: Konva.Group;
  private minigame2Button: Konva.Group;
  private minigame3Button: Konva.Group;

  constructor(
    width: number,
    height: number,
    onStartClick: () => void,
    onMinigame1Click: () => void,
    onMinigame2Click: () => void,
    onMinigame3Click: () => void,
  ) {
    this.group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width,
        height,
        fill: "black",
      }),
    );

    this.titleImage = new Konva.Image({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      image: undefined,
    });

    this.group.add(this.titleImage);

    const createButton = (
      text: string,
      onClick: () => void,
      enabled = true,
    ): Konva.Group => {
      const button = new Konva.Group({
        visible: false,
      });

      button.add(
        new Konva.Rect({
          width: BUTTON_WIDTH,
          height: BUTTON_HEIGHT,
          fill: "black",
          cornerRadius: 1,
        }),
      );

      button.add(
        new Konva.Text({
          width: BUTTON_WIDTH,
          height: BUTTON_HEIGHT,
          text,
          fontSize: 24,
          // A disabled button is greyed out rather than hidden, so the menu layout stays put.
          fill: enabled ? "white" : "#52525B",
          align: "center",
          verticalAlign: "middle",
        }),
      );

      if (enabled) button.on("click tap", onClick);
      button.setAttr("enabled", enabled);
      this.group.add(button);

      return button;
    };

    this.button = createButton("MAIN STORY", onStartClick);
    this.minigame1Button = createButton(
      "MINIGAME 1",
      onMinigame1Click,
    );
    this.minigame2Button = createButton(
      "MINIGAME 2",
      onMinigame2Click,
      MINIGAME_2_ENABLED,
    );
    this.minigame3Button = createButton(
      "MINIGAME 3",
      onMinigame3Click,
    );

    const gap = height * 0.02;

    const layout = (
      imageWidth: number,
      imageHeight: number,
    ) => {
      const totalHeight =
        imageHeight + gap * 4 + BUTTON_HEIGHT * 4;

      const top = (height - totalHeight) / 2;
      const centerX = (width - BUTTON_WIDTH) / 2;

      this.titleImage.size({
        width: imageWidth,
        height: imageHeight,
      });

      this.titleImage.position({
        x: (width - imageWidth) / 2,
        y: top + TITLE_Y_OFFSET,
      });

      this.button.position({
        x: centerX,
        y: top + imageHeight + gap,
      });

      this.minigame1Button.position({
        x: centerX,
        y: top + imageHeight + gap * 2 + BUTTON_HEIGHT,
      });

      this.minigame2Button.position({
        x: centerX,
        y: top + imageHeight + gap * 3 + BUTTON_HEIGHT * 2,
      });

      this.minigame3Button.position({
        x: centerX,
        y: top + imageHeight + gap * 4 + BUTTON_HEIGHT * 3,
      });

      this.button.visible(true);
      this.minigame1Button.visible(true);
      this.minigame2Button.visible(true);
      this.minigame3Button.visible(true);

      this.group.getLayer()?.batchDraw();
    };

    loadImage(titleUrl).then(
      (img) => {
        const scale = Math.min(
          (width * 0.5) / img.naturalWidth,
          (height * 0.35) / img.naturalHeight,
        );

        this.titleImage.image(img);

        layout(
          img.naturalWidth * scale,
          img.naturalHeight * scale,
        );
      },
      () => layout(0, 0),
    );
  }

  fadeOut(onDone: () => void): void {
    this.titleImage.to({
      opacity: 0,
      duration: IMAGE_FADE_SECONDS,
      easing: Konva.Easings.Linear,
      onFinish: () => {
        const buttons = [
          this.button,
          this.minigame1Button,
          this.minigame2Button,
          this.minigame3Button,
        ];

        let finished = 0;

        for (const button of buttons) {
          button.to({
            opacity: 0,
            duration: BUTTON_FADE_SECONDS,
            easing: Konva.Easings.Linear,
            onFinish: () => {
              finished++;

              if (finished === buttons.length) {
                onDone();
              }
            },
          });
        }
      },
    });
  }

  show(): void {
    this.titleImage.opacity(1);
    this.button.opacity(1);
    this.minigame1Button.opacity(1);
    this.minigame2Button.opacity(1);
    this.minigame3Button.opacity(1);

    this.group.visible(true);
    this.group.getLayer()?.batchDraw();
  }

  hide(): void {
    this.group.visible(false);
    this.group.getLayer()?.batchDraw();
  }

  getGroup(): Konva.Group {
    return this.group;
  }
}
