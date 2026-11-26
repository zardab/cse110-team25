import Konva from "konva";
import type { View } from "../screenTypes.ts";

// Everything is laid out on a 960 × 600 board, then scaled to fit the screen.
const BOARD = { width: 960, height: 600 };

/** The same font stack as the main game (src/index.css). */
const FONT =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// Dark colors from the main game's stylesheet and board, so the tutorial looks like part of it.
const COLOR = {
	page: "#09090B",
	card: "#18181B",
	border: "#27272A",
	ink: "#FAFAFA",
	muted: "#A1A1AA",
	faint: "#71717A",
	unlit: "#3F3F46",
	bulbOn: "#FACC15",
	bulbGlow: "#FEF08A",
	skullOn: "#A1A1AA",
	skullGlow: "#D4D4D8",
	button: "#FAFAFA",
	buttonHover: "#D4D4D8",
	buttonText: "#18181B",
};

/** The numbered How to Play steps: [heading, body]. */
export const TUTORIAL_STEPS: readonly (readonly [string, string])[] = [
	[
		"Follow the power",
		"Each circuit starts at the ⚡ inputs. A yellow line is ON (1) and a gray line is OFF (0).",
	],
	[
		"Place logic gates",
		"Drag a gate from the AVAILABLE GATES tray onto an empty dashed slot. Click a placed gate to take it back out. Each gate can only be used as many times as the tray shows.",
	],
	[
		"Match every output",
		"Every wire ends at a 💡 lightbulb or a 💀 skull. The level is solved when every slot has a gate in it, every lightbulb is ON, and every skull is OFF at the same time.",
	],
];

/** The continue button's text after the opening cutscene. */
export const DEFAULT_BUTTON_LABEL = "Got it — choose a level";

type OutputKind = "bulb" | "skull";

/** What the two output cards say: lightbulbs want power, skulls must stay dark. */
export const OUTPUT_RULES: Record<
	OutputKind,
	{ icon: string; title: string; goal: string; body: string }
> = {
	bulb: {
		icon: "💡",
		title: "LIGHTBULB",
		goal: "Turn it ON — output must be 1",
		body: "Route power so this wire ends ON. The bulb glows yellow once it is lit.",
	},
	skull: {
		icon: "💀",
		title: "SKULL",
		goal: "Keep it OFF — output must be 0",
		body: "Power reaching a skull is a trap. Make sure this wire ends OFF. The skull glows silver once it is safe.",
	},
};

/** TutorialView - the How to Play screen shown after the opening cutscene. */
export class TutorialView implements View {
	private readonly group = new Konva.Group({ visible: false });
	private readonly board = new Konva.Group();
	private buttonLabel!: Konva.Text;

	constructor(width: number, height: number, onContinue: () => void) {
		this.group.add(
			new Konva.Rect({ width, height, fill: COLOR.page }),
		);

		const margin = 32;
		const scale = Math.min(
			(width - margin * 2) / BOARD.width,
			(height - margin * 2) / BOARD.height,
			1.5,
		);
		this.board.scale({ x: scale, y: scale });
		this.board.position({
			x: (width - BOARD.width * scale) / 2,
			y: (height - BOARD.height * scale) / 2,
		});
		this.group.add(this.board);

		this.drawHeader();
		this.drawSteps();
		this.drawOutputCard("bulb", 520, 100);
		this.drawOutputCard("skull", 520, 290);
		this.drawContinueButton(onContinue);
	}

	private drawHeader(): void {
		this.board.add(
			new Konva.Text({
				name: "tutorial-title",
				x: 0,
				y: 0,
				width: BOARD.width,
				align: "center",
				text: "How to Play",
				fontSize: 40,
				fontStyle: "bold",
				fontFamily: FONT,
				fill: COLOR.ink,
			}),
			new Konva.Text({
				x: 0,
				y: 52,
				width: BOARD.width,
				align: "center",
				text: "Fix the circuits in the breaker box by placing the right logic gates.",
				fontSize: 17,
				fontFamily: FONT,
				fill: COLOR.muted,
			}),
		);
	}

	/** Numbered steps down the left, each placed under the one before it. */
	private drawSteps(): void {
		let y = 110;
		TUTORIAL_STEPS.forEach(([heading, body], index) => {
			this.board.add(
				new Konva.Circle({
					x: 14,
					y: y + 12,
					radius: 14,
					fill: COLOR.ink,
				}),
				new Konva.Text({
					x: 0,
					y: y + 4,
					width: 28,
					align: "center",
					text: `${index + 1}`,
					fontSize: 15,
					fontStyle: "bold",
					fontFamily: FONT,
					fill: COLOR.buttonText,
				}),
				new Konva.Text({
					x: 42,
					y: y + 2,
					width: 440,
					text: heading,
					fontSize: 19,
					fontStyle: "bold",
					fontFamily: FONT,
					fill: COLOR.ink,
				}),
			);
			const text = new Konva.Text({
				name: `tutorial-step-${index + 1}`,
				x: 42,
				y: y + 30,
				width: 440,
				text: body,
				fontSize: 15,
				fontFamily: FONT,
				fill: COLOR.muted,
				lineHeight: 1.4,
			});
			this.board.add(text);
			y = text.y() + text.height() + 24;
		});
	}

	/** A card showing one output type, its goal, and how it looks unsolved vs solved. */
	private drawOutputCard(kind: OutputKind, x: number, y: number): void {
		const rule = OUTPUT_RULES[kind];
		const card = new Konva.Group({ name: `tutorial-${kind}-card`, x, y });
		const width = 440;
		const height = 170;

		card.add(
			new Konva.Rect({
				width,
				height,
				cornerRadius: 16,
				fill: COLOR.card,
				stroke: COLOR.border,
				strokeWidth: 1.5,
			}),
		);

		// Before and after: the dark unsolved icon, then the glowing solved one.
		this.drawOutputIcon(card, kind, false, 48, 62);
		card.add(
			new Konva.Text({
				x: 76,
				y: 52,
				text: "→",
				fontSize: 20,
				fontFamily: FONT,
				fill: COLOR.faint,
			}),
		);
		this.drawOutputIcon(card, kind, true, 124, 62);
		card.add(
			new Konva.Text({
				x: 18,
				y: 98,
				width: 140,
				align: "center",
				text: "UNSOLVED → SOLVED",
				fontSize: 10,
				fontStyle: "bold",
				fontFamily: FONT,
				fill: COLOR.faint,
				letterSpacing: 0.5,
			}),
		);

		const goal = new Konva.Text({
			name: `tutorial-${kind}-goal`,
			x: 172,
			y: 42,
			width: width - 190,
			text: rule.goal,
			fontSize: 16,
			fontStyle: "bold",
			fontFamily: FONT,
			fill: COLOR.ink,
			lineHeight: 1.25,
		});
		card.add(
			new Konva.Text({
				x: 172,
				y: 20,
				width: width - 190,
				text: `${rule.icon}  ${rule.title}`,
				fontSize: 13,
				fontStyle: "bold",
				fontFamily: FONT,
				fill: kind === "bulb" ? COLOR.bulbOn : COLOR.skullGlow,
				letterSpacing: 1,
			}),
			goal,
			new Konva.Text({
				x: 172,
				// The goal may wrap, so the body sits under however tall it ends up.
				y: goal.y() + goal.height() + 10,
				width: width - 190,
				text: rule.body,
				fontSize: 14,
				fontFamily: FONT,
				fill: COLOR.muted,
				lineHeight: 1.35,
			}),
		);

		this.board.add(card);
	}

	/** Draws an output icon the same way the game board does (see FixedLayoutBoardView). */
	private drawOutputIcon(
		parent: Konva.Group,
		kind: OutputKind,
		solved: boolean,
		x: number,
		y: number,
	): void {
		const glow = kind === "bulb" ? COLOR.bulbGlow : COLOR.skullGlow;
		const fill = solved
			? kind === "bulb"
				? COLOR.bulbOn
				: COLOR.skullOn
			: COLOR.unlit;
		if (solved) {
			parent.add(new Konva.Circle({ x, y, radius: 30, fill: glow, opacity: 0.6 }));
		}
		parent.add(new Konva.Circle({ x, y, radius: 23, fill }));
		parent.add(
			new Konva.Text({
				x: x - 23,
				y: y - 23,
				width: 46,
				height: 46,
				text: OUTPUT_RULES[kind].icon,
				fontSize: 26,
				align: "center",
				verticalAlign: "middle",
			}),
		);
	}

	private drawContinueButton(onContinue: () => void): void {
		const width = 300;
		const height = 56;
		const button = new Konva.Group({
			name: "tutorial-continue",
			x: (BOARD.width - width) / 2,
			y: 500,
		});
		const background = new Konva.Rect({
			width,
			height,
			cornerRadius: 28,
			fill: COLOR.button,
		});
		button.add(
			background,
			this.buttonLabel = new Konva.Text({
				name: "tutorial-continue-label",
				width,
				height,
				align: "center",
				verticalAlign: "middle",
				text: DEFAULT_BUTTON_LABEL,
				fontSize: 19,
				fontStyle: "bold",
				fontFamily: FONT,
				fill: COLOR.buttonText,
			}),
		);
		button.on("mouseenter", () => {
			background.fill(COLOR.buttonHover);
			this.setCursor("pointer");
		});
		button.on("mouseleave", () => {
			background.fill(COLOR.button);
			this.setCursor("default");
		});
		button.on("click tap", () => {
			this.setCursor("default");
			onContinue();
		});
		this.board.add(
			button,
			new Konva.Text({
				x: 0,
				y: 568,
				width: BOARD.width,
				align: "center",
				text: "Press [ENTER] to continue",
				fontSize: 14,
				fontFamily: FONT,
				fill: COLOR.faint,
			}),
		);
	}

	/** Changes the continue button's text, e.g. to "Back to level" when opened mid-level. */
	setButtonLabel(text: string): void {
		this.buttonLabel.text(text);
		this.group.getLayer()?.batchDraw();
	}

	private setCursor(cursor: string): void {
		const container = this.group.getStage()?.container();
		if (container) container.style.cursor = cursor;
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
