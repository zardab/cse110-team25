
import Konva from "konva";
import type { View } from "../screenTypes.ts";
import menuImageUrl from "../assets/levelSelectorMenu.png";
import type { LevelConfig } from "../types/circuit";

const IMAGE = { width: 800, height: 550 };

type LevelButton = {
  id: string;
  label: string;
  x: number;
  y: number;
};

const BUTTON_STYLE = {
  width: 235,
  height: 42,
  fontSize: 20,
};

export class LevelSelectorView implements View {
  private group = new Konva.Group();

  constructor(
    width: number,
    height: number,
    levels: readonly LevelConfig[],
    onStartCutscene: (levelId: string) => void,
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

    const scale =
      Math.min(width / IMAGE.width, height / IMAGE.height) * 0.8;

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
      menuImage.zIndex(1);
      this.group.getLayer()?.draw();
    });

    const twoColumns = levels.length > 5;
    const rows = Math.ceil(levels.length / (twoColumns ? 2 : 1));
    const buttonScale = Math.min(1, width / (twoColumns ? 560 : 275), height / 420);
    const rowSpacing = Math.min(54 * buttonScale / height, 0.11);
    const columnSpacing = 255 * buttonScale / width;

    for (const [index, entry] of levels.entries()) {
      const row = index % rows;
      const level: LevelButton = {
        id: entry.id,
        label: `Level ${index + 1}`,
        x: twoColumns ? 0.5 + (Math.floor(index / rows) - 0.5) * columnSpacing : 0.5,
        y: 0.58 + (row - (rows - 1) / 2) * rowSpacing,
      };

      const button = this.createButton(level, width, height, onStartCutscene);
      const center = { x: width * level.x, y: height * level.y };
      button.offset(center);
      button.position(center);
      button.scale({ x: buttonScale, y: buttonScale });
      this.group.add(button);
    }
  }

  private createButton(
    level: LevelButton,
    width: number,
    height: number,
    onStartCutscene: (levelId: string) => void,
  ): Konva.Group {
    const x = width * level.x - BUTTON_STYLE.width / 2;
    const y = height * level.y - BUTTON_STYLE.height / 2;

    const button = new Konva.Group();

    button.add(
      new Konva.Rect({
        x,
        y,
        width: BUTTON_STYLE.width,
        height: BUTTON_STYLE.height,
        fill: "red",
      }),
    );

    button.add(
      new Konva.Text({
        x,
        y,
        width: BUTTON_STYLE.width,
        height: BUTTON_STYLE.height,
        text: level.label,
        fontSize: BUTTON_STYLE.fontSize,
        fill: "black",
        align: "center",
        verticalAlign: "middle",
      }),
    );

    button.on("click tap", (event) => {
      event.cancelBubble = true;
      onStartCutscene(level.id);
    });

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
