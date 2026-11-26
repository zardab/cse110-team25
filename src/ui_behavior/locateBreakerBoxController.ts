
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
    breakerSceneNumber: number,
    private onContinue: (levelId: string) => void,
  ) {
    this.levelId = "";
    this.view = this.createView(breakerSceneNumber);

    stage.on("mousemove.flashlight", () => {
      if (!this.active) return;

      const pos = stage.getPointerPosition();

      if (pos) {
        this.view.moveLight(pos.x, pos.y);
        this.view.moveParallax(pos.x, pos.y);
      }
    });
  }

  private createView(breakerSceneNumber: number): locateBreakerBoxView {
    return new locateBreakerBoxView(
      this.width,
      this.height,
      breakerSceneNumber,
      () => {
        if (!this.active) return;

        this.active = false;
        this.onContinue(this.levelId);
      },
    );
  }

  // Choose a breaker scene and its destination circuit level.
  public setBreakerScene(breakerSceneNumber: number, levelId: string): void {
    this.active = false;

    const oldGroup = this.view.getGroup();
    const parent = oldGroup.getParent();

    this.view.destroy();

    this.levelId = levelId;
    this.view = this.createView(breakerSceneNumber);

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
    this.view.hide();
  }

  public getView(): locateBreakerBoxView {
    return this.view;
  }
}
