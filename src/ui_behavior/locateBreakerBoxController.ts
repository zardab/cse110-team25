
import Konva from "konva";
import type { ScreenController } from "../screenTypes.ts";
import { locateBreakerBoxView } from "./locateBreakerBoxView.ts";

export class locateBreakerBoxController implements ScreenController {
  private view: locateBreakerBoxView;
  private active = false;
  private levelId: string;

  constructor(
    stage: Konva.Stage,
    private width: number,
    private height: number,
    level: number,
    private onContinue: (levelId: string) => void,
  ) {
    this.levelId = `level${level}`;
    this.view = this.createView(level);

    stage.on("mousemove.flashlight", () => {
      if (!this.active) return;

      const pos = stage.getPointerPosition();

      if (pos) {
        this.view.moveLight(pos.x, pos.y);
        this.view.moveParallax(pos.x, pos.y);
      }
    });
  }

  private createView(level: number): locateBreakerBoxView {
    return new locateBreakerBoxView(
      this.width,
      this.height,
      level,
      () => {
        if (!this.active) return;

        this.active = false;
        this.onContinue(this.levelId);
      },
    );
  }

  // Change which level's flashlight scene is displayed.
  public setLevel(level: number, levelId: string): void {
    this.active = false;

    const oldGroup = this.view.getGroup();
    const parent = oldGroup.getParent();

    oldGroup.destroy();

    this.levelId = levelId;
    this.view = this.createView(level);

    if (parent) {
      parent.add(this.view.getGroup());
      this.view.hide();
    }
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
