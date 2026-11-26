import type Konva from "konva";

export type ScreenId =
  | { type: "menu" }
  | { type: "cutscene1" }
  | { type: "cutscene2" }
  | { type: "tutorial" }
  | { type: "levelSelector" }
  | { type: "locateBreakerBox" }
  | { type: "gateGuess" }
  | { type: "faultFinder" }
  | { type: "level1" }
  | { type: "minigame1" }
  | { type: "minigame2" }
  | { type: "minigame3" };
  

export interface View {
  getGroup(): Konva.Group;
  show(): void;
  hide(): void;
}

export interface ScreenController {
  getView(): View;
  start?(): void;
  stop?(): void;
}

export interface ScreenSwitcher {
  switchToScreen(screen: ScreenId): void;
}
