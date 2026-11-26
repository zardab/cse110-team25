import Konva from "konva";
import { afterEach, expect, it, vi } from "vitest";
import { mainLevels } from "../content/levelCatalog";
import { LevelSelectorView } from "./LevelSelectorView";

afterEach(() => vi.restoreAllMocks());

it.each([[1280, 800], [480, 360]])(
  "keeps all ten level buttons visible and mapped to their puzzle IDs at %ix%i",
  (width, height) => {
    vi.spyOn(Konva.Image, "fromURL").mockImplementation(() => {});
    const select = vi.fn();
    const selector = new LevelSelectorView(width, height, mainLevels, select);
    const group = selector.getGroup();
    try {
      const labels = group.find<Konva.Text>("Text");
      expect(labels.map((label) => label.text())).toEqual(
        Array.from({ length: 10 }, (_, index) => `Level ${index + 1}`),
      );
      const boxes = labels.map((label) => label.getClientRect());
      for (const [index, box] of boxes.entries()) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
        for (const other of boxes.slice(index + 1)) {
          expect(Konva.Util.haveIntersection(box, other)).toBe(false);
        }
        labels[index].fire("click", {}, true);
      }
      expect(select.mock.calls).toEqual(mainLevels.map(({ id }) => [id]));
    } finally {
      group.destroy();
    }
  },
);
