
import Konva from "konva";
import type { View } from "../screenTypes.ts";

import breakerScene1Image from "../assets/wall.png";
import breakerScene2Image from "../assets/closet.png";
import breakerScene3Image from "../assets/laundry.png";
import breakerScene4Image from "../assets/hallway.png";
import breakerScene5Image from "../assets/basement.png";

const BREAKER_SCENES: Record<number, {
  image: string;
  x: number;
  y: number;
}> = {
  1: { image: breakerScene1Image, x: 0.95, y: 0.73 },
  2: { image: breakerScene2Image, x: 0.3, y: 0.45 },
  3: { image: breakerScene3Image, x: 0.5, y: 0.4 },
  4: { image: breakerScene4Image, x: 0.15, y: 0.2 },
  5: { image: breakerScene5Image, x: 0.52, y: 0.6 },
};

type DustParticle = {
  circle: Konva.Circle;
  x: number;
  y: number;
  speedX: number;
  speedY: number;
};

export class locateBreakerBoxView implements View {
  private group = new Konva.Group();

  private canvas: HTMLCanvasElement;
  private darkness: Konva.Image;
  private background?: Konva.Image;

  // Two separate dust layers
  private farDustGroup = new Konva.Group({
    listening: false,
  });

  private nearDustGroup = new Konva.Group({
    listening: false,
  });

  private farParticles: DustParticle[] = [];
  private nearParticles: DustParticle[] = [];

  private animation: Konva.Animation;
  private disposed = false;

  // Parallax strengths
  private readonly parallaxStrength = 0.02;
  private readonly farDustStrength = 0.04;
  private readonly nearDustStrength = 0.08;

  // Particle counts
  private readonly farDustCount = 150;
  private readonly nearDustCount = 50;

  constructor(
    private width: number,
    private height: number,
    breakerSceneNumber: number,
    onContinue: () => void,
  ) {
    const config = BREAKER_SCENES[breakerSceneNumber];

    if (!config) {
      throw new Error(`Unknown breaker scene: ${breakerSceneNumber}`);
    }

    // -------------------------
    // Background
    // -------------------------

    Konva.Image.fromURL(config.image, (image) => {
      if (this.disposed) {
        image.destroy();
        return;
      }
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

    // -------------------------
    // Dust layers
    // -------------------------

    this.farParticles = this.createDust(
      this.farDustGroup,
      this.farDustCount,
      0.5,
      1.5,
      0.12,
      0.3,
      0.35, //speed
    );

    this.nearParticles = this.createDust(
      this.nearDustGroup,
      this.nearDustCount,
      1.5,
      3,
      0.2,
      0.5,
      0.55, //speed
    );

    this.group.add(this.farDustGroup);
    this.group.add(this.nearDustGroup);

    // -------------------------
    // Darkness / flashlight
    // -------------------------

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

    // -------------------------
    // Breaker box button
    // -------------------------

    const buttonWidth = width * 0.18;
    const buttonHeight = height * 0.40;

    const button = new Konva.Group({
      x: width * config.x - buttonWidth / 2,
      y: height * config.y - buttonHeight / 2,
    });

    button.add(new Konva.Rect({
      width: buttonWidth,
      height: buttonHeight,
      fill: "rgba(0,0,0,0)",
      stroke: "white",
      strokeWidth: 0, //set to above 1 te debug button loc
      cornerRadius: 4,
    }));

    button.on("click tap", onContinue);
    this.group.add(button);

    // -------------------------
    // Instruction label
    // -------------------------

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

    // -------------------------
    // Continuous dust animation
    // -------------------------

    this.animation = new Konva.Animation((frame) => {
      if (!frame) return;

      // Convert elapsed milliseconds to seconds
      const dt = Math.min(frame.timeDiff, 50) / 1000;

      this.moveDust(this.farParticles, dt);
      this.moveDust(this.nearParticles, dt);
    });

    // The animation starts when show() is called.
  }

  // Create a layer of random dust particles
  private createDust(
    group: Konva.Group,
    count: number,
    minRadius: number,
    maxRadius: number,
    minOpacity: number,
    maxOpacity: number,
    speed: number,
  ): DustParticle[] {
    const particles: DustParticle[] = [];

    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;

      const circle = new Konva.Circle({
        x,
        y,
        radius:
          minRadius +
          Math.random() * (maxRadius - minRadius),
        fill: "white",
        opacity:
          minOpacity +
          Math.random() * (maxOpacity - minOpacity),
        listening: false,
      });

      group.add(circle);

      particles.push({
        circle,
        x,
        y,

        // Random horizontal drift
        speedX: (Math.random() - 0.5) * speed * 20,

        // Random vertical drift
        speedY: (Math.random() - 0.5) * speed * 20,
      });
    }

    return particles;
  }

  // Move particles a little every animation frame
  private moveDust(
    particles: DustParticle[],
    dt: number,
  ): void {
    for (const particle of particles) {
      particle.x += particle.speedX * dt;
      particle.y += particle.speedY * dt;

      // Wrap particles around the screen
      if (particle.x < -10) {
        particle.x = this.width + 10;
      }

      if (particle.x > this.width + 10) {
        particle.x = -10;
      }

      if (particle.y < -10) {
        particle.y = this.height + 10;
      }

      if (particle.y > this.height + 10) {
        particle.y = -10;
      }

      particle.circle.position({
        x: particle.x,
        y: particle.y,
      });
    }
  }

  // Flashlight follows the cursor
  public moveLight(x: number, y: number): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    const radius = Math.min(width, height) * 0.3;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "rgba(0,0,0,0.98)";
    ctx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "destination-out";

    const gradient = ctx.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      radius,
    );

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

  // Move background and both dust layers with the cursor
  public moveParallax(x: number, y: number): void {
    const offsetX = (x / this.width - 0.5) * 2;
    const offsetY = (y / this.height - 0.5) * 2;

    // Background: slowest movement
    if (this.background) {
      this.background.position({
        x:
          (this.width - this.background.width()) / 2 -
          offsetX * this.width * this.parallaxStrength,

        y:
          (this.height - this.background.height()) / 2 -
          offsetY * this.height * this.parallaxStrength,
      });
    }

    // Far dust: medium movement
    this.farDustGroup.position({
      x: -offsetX * this.width * this.farDustStrength,
      y: -offsetY * this.height * this.farDustStrength,
    });

    // Near dust: strongest movement
    this.nearDustGroup.position({
      x: -offsetX * this.width * this.nearDustStrength,
      y: -offsetY * this.height * this.nearDustStrength,
    });

    this.group.getLayer()?.batchDraw();
  }

  public show(): void {
    this.group.show();

    // Start dust movement
    const layer = this.group.getLayer();

    if (layer) {
      this.animation.setLayers(layer);
      this.animation.start();
      layer.batchDraw();
    }
  }

  public hide(): void {
    // Stop animation when leaving the screen
    this.animation.stop();
    this.group.hide();
    this.group.getLayer()?.batchDraw();
  }

  public destroy(): void {
    this.disposed = true;
    this.animation.stop();
    this.group.destroy();
  }

  public getGroup(): Konva.Group {
    return this.group;
  }
}
