import Konva from "konva";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorialController } from "./TutorialController";
import { OUTPUT_RULES } from "./TutorialView";

function setup() {
	const onContinue = vi.fn();
	const controller = new TutorialController(960, 600, onContinue);
	const layer = new Konva.Layer();
	layer.add(controller.getView().getGroup());
	const group = controller.getView().getGroup();
	const find = (name: string) => group.findOne(`.${name}`) as Konva.Node;
	return { controller, onContinue, group, find };
}

const press = (code: string, repeat = false) =>
	window.dispatchEvent(new KeyboardEvent("keydown", { code, repeat }));

describe("TutorialController", () => {
	let controller: TutorialController | undefined;
	afterEach(() => controller?.stop());

	it("explains lightbulbs must be ON and skulls must be OFF", () => {
		const s = setup();
		controller = s.controller;
		const goal = (kind: string) =>
			(s.find(`tutorial-${kind}-goal`) as Konva.Text).text();
		expect(goal("bulb")).toBe(OUTPUT_RULES.bulb.goal);
		expect(goal("bulb")).toMatch(/must be 1/);
		expect(goal("skull")).toBe(OUTPUT_RULES.skull.goal);
		expect(goal("skull")).toMatch(/must be 0/);
		expect((s.find("tutorial-step-3") as Konva.Text).text()).toMatch(
			/every slot has a gate in it, every lightbulb is ON, and every skull is OFF/,
		);
	});

	it("continues when the button is clicked", () => {
		const s = setup();
		controller = s.controller;
		s.controller.start();
		s.find("tutorial-continue").fire("click");
		expect(s.onContinue).toHaveBeenCalledTimes(1);
		// Further input after leaving does nothing.
		s.find("tutorial-continue").fire("click");
		press("Enter");
		expect(s.onContinue).toHaveBeenCalledTimes(1);
	});

	it("continues on Enter but ignores held keys", () => {
		const s = setup();
		controller = s.controller;
		s.controller.start();
		press("Enter", true);
		press("Space");
		expect(s.onContinue).not.toHaveBeenCalled();
		press("Enter");
		expect(s.onContinue).toHaveBeenCalledTimes(1);
	});

	it("ignores input until started and after stopping", () => {
		const s = setup();
		controller = s.controller;
		press("Enter");
		s.find("tutorial-continue").fire("click");
		s.controller.start();
		s.controller.stop();
		press("Enter");
		expect(s.onContinue).not.toHaveBeenCalled();
	});

	it("is hidden until shown", () => {
		const s = setup();
		controller = s.controller;
		expect(s.group.visible()).toBe(false);
		s.controller.getView().show();
		expect(s.group.visible()).toBe(true);
	});
});
