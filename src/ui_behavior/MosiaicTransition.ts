import Konva from "konva";

export type MosaicPattern = "random" | "wave" | "center";

export class MosaicTransition {
  private stage: Konva.Stage;
  private layer: Konva.Layer | null = null;
  private animation: Konva.Animation | null = null;

  constructor(stage: Konva.Stage) {
    this.stage = stage;
  }

  cover(
    onCovered: () => void,
    pattern: MosaicPattern = "random",
    durationMs = 1200,
    squareSize = 60,
  ): void {
    this.destroy();

    const width = this.stage.width();
    const height = this.stage.height();

    const cols = Math.ceil(width / squareSize);
    const rows = Math.ceil(height / squareSize);

    const cells: { row: number; col: number }[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        cells.push({ row, col });
      }
    }

    if (pattern === "random") {
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
    } else if (pattern === "wave") {
      cells.sort(
        (a, b) => a.row + a.col - (b.row + b.col),
      );
    } else if (pattern === "center") {
      const centerX = (cols - 1) / 2;
      const centerY = (rows - 1) / 2;

      cells.sort((a, b) => {
        const distanceA = Math.hypot(
          a.col - centerX,
          a.row - centerY,
        );

        const distanceB = Math.hypot(
          b.col - centerX,
          b.row - centerY,
        );

        return distanceA - distanceB;
      });
    }

    const layer = new Konva.Layer({
      listening: true,
    });

    this.layer = layer;
    this.stage.add(layer);

    let nextCell = 0;

    const animation = new Konva.Animation((frame) => {
      if (!frame) return;

      const progress = Math.min(
        1,
        frame.time / Math.max(1, durationMs),
      );

      const targetCount = Math.floor(
        progress * cells.length,
      );

      while (nextCell < targetCount) {
        const cell = cells[nextCell++];

        layer.add(
          new Konva.Rect({
            x: cell.col * squareSize,
            y: cell.row * squareSize,
            width: squareSize + 1,
            height: squareSize + 1,
            fill: "black",
            listening: true,
          }),
        );
      }

      if (progress >= 1) {
        animation.stop();
        this.animation = null;

        onCovered();

        if (this.layer === layer) {
          this.layer = null;
          layer.destroy();
        }
      }
    }, layer);

    this.animation = animation;
    animation.start();
  }

  destroy(): void {
    this.animation?.stop();
    this.animation = null;

    this.layer?.destroy();
    this.layer = null;
  }
}
