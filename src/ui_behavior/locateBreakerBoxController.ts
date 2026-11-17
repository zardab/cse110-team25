
import Konva from "konva";
import type { ScreenController } from "../screenTypes.ts";
import { locateBreakerBoxView } from "./locateBreakerBoxView.ts";

export class locateBreakerBoxController implements ScreenController {
  private view: locateBreakerBoxView;
  private active = false;

  constructor(
    stage: Konva.Stage,
    width: number,
    height: number,
    level: number,
    onContinue: () => void,
  ) {
    this.view = new locateBreakerBoxView(
      width,
      height,
      level,
      onContinue,
    );

    stage.on("mousemove.flashlight", () => {
      if (!this.active) return;

      const pos = stage.getPointerPosition();

      if (pos) {
        this.view.moveLight(pos.x, pos.y);
        this.view.moveParallax(pos.x, pos.y);
      }
    });
  }

  public start(): void {
    this.active = true;
  }

  public stop(): void {
    this.active = false;
  }

  public getView(): locateBreakerBoxView {
    return this.view;
  }
}
