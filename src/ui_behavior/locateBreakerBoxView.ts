import Konva from "konva";
import type { View } from "../screenTypes.ts";

import level1Image from "../assets/wall.png";
import level2Image from "../assets/closet.png";
import level3Image from "../assets/laundry.png";
import level4Image from "../assets/hallway.png";
import level5Image from "../assets/basement.png";

const LEVELS: Record <number, {
  image: string;
  x: number;
  y: number;
}> = {
  1: { image: level1Image, x: 0.8, y: 0.73 },
  2: { image: level2Image, x: 0.3, y: 0.6 },
  3: { image: level3Image, x: 0.55, y: 0.3 },
  4: { image: level4Image, x: 0.3, y: 0.3 },
  5: { image: level5Image, x: 0.52, y: 0.6 },
};

export class locateBreakerBoxView implements View {
  private group = new Konva.Group();
  private canvas: HTMLCanvasElement;
  private darkness: Konva.Image;
  private background?: Konva.Image;

  private readonly parallaxStrength = 0.02;

  constructor(
    private width: number,
    private height: number,
    level: number,
    onContinue: () => void,
  ) {
    const config = LEVELS[level];
    if (!config) throw new Error(`Unknown level: ${level}`);

    // Background with parallax padding
    Konva.Image.fromURL(config.image, (image) => {
      this.background = image;

      const scale = Math.max(
        width / image.width(),
        height / image.height(),
      ) * (1 + this.parallaxStrength * 2);

      const imageWidth = image.width() * scale;
      const imageHeight = image.height() * scale;

      image.size({
        width: imageWidth,
        height: imageHeight,
      });

      image.position({
        x: (width - imageWidth) / 2,
        y: (height - imageHeight) / 2,
      });

      this.group.add(image);
      image.moveToBottom();
      this.group.getLayer()?.batchDraw();
    });

    // Darkness canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;

    this.darkness = new Konva.Image({
      image: this.canvas,
      width,
      height,
      listening: false,
    });

    this.group.add(this.darkness);
    this.moveLight(width / 2, height / 2);

    // Outlined button, using your dimensions
    const buttonWidth = width * 0.18;
    const buttonHeight = height * 0.40;

    const button = new Konva.Group({
      x: width * config.x - buttonWidth / 2,
      y: height * config.y - buttonHeight / 2,
    });

    button.add(new Konva.Rect({
      width: buttonWidth,
      height: buttonHeight,
      stroke: "white",
      strokeWidth: 0,
      cornerRadius: 4,
    }));

    button.on("click tap", onContinue);
    this.group.add(button);

    // Instruction label above the darkness FIND BREAKER BOX
    this.group.add(new Konva.Text({
      x: 0,
      y: height * 0.06,
      width,
      text: "Click the breaker box",
      fontSize: height * 0.045,
      fontStyle: "bold",
      fill: "red",
      align: "center",
      listening: false,
    }));
  }

  // Flashlight follows the cursor
  public moveLight(x: number, y: number): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const radius = Math.min(width, height) * 0.3;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(0,0,0,0.98)"; //darkness
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "destination-out";

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius); //flashlight
    gradient.addColorStop(0, "rgba(0,0,0,0.4)");
    gradient.addColorStop(0.4, "rgba(0,0,0,0.4)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
    this.darkness.getLayer()?.batchDraw();
  }

  // Background moves opposite the cursor
  public moveParallax(x: number, y: number): void {
    if (!this.background) return;

    const offsetX = (x / this.width - 0.5) * 2;
    const offsetY = (y / this.height - 0.5) * 2;

    this.background.position({
      x: (this.width - this.background.width()) / 2
        - offsetX * this.width * this.parallaxStrength,
      y: (this.height - this.background.height()) / 2
        - offsetY * this.height * this.parallaxStrength,
    });

    this.group.getLayer()?.batchDraw();
  }

  public show(): void {
    this.group.show();
  }

  public hide(): void {
    this.group.hide();
  }

  public getGroup(): Konva.Group {
    return this.group;
  }
}
