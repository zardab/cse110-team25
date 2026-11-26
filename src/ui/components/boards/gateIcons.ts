import Konva from 'konva';
import { loadImage } from '../../../ui_behavior/loadImage';

const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();
const INFO_KEY = '__info__';

/** Returns a cached gate SVG if already loaded. */
export function getGateIcon(gate: string): HTMLImageElement | undefined {
  return cache.get(gate);
}

/** Loads `/assets/{gate}.svg`, caching the result. */
export function loadGateIcon(gate: string): Promise<HTMLImageElement> {
  const hit = cache.get(gate);
  if (hit) return Promise.resolve(hit);

  let pending = loading.get(gate);
  if (!pending) {
    pending = loadImage(`/assets/${gate}.svg`).then((img) => {
      cache.set(gate, img);
      loading.delete(gate);
      return img;
    });
    loading.set(gate, pending);
  }
  return pending;
}

export function getInfoIcon(): HTMLImageElement | undefined {
  return cache.get(INFO_KEY);
}

export function loadInfoIcon(): Promise<HTMLImageElement> {
  const hit = cache.get(INFO_KEY);
  if (hit) return Promise.resolve(hit);

  let pending = loading.get(INFO_KEY);
  if (!pending) {
    pending = loadImage('/assets/info.svg').then((img) => {
      cache.set(INFO_KEY, img);
      loading.delete(INFO_KEY);
      return img;
    });
    loading.set(INFO_KEY, pending);
  }
  return pending;
}

/**
 * Adds a centered, non-stretched gate SVG into a slot group with ~20% padding.
 * Returns false when the image is still loading (caller should redraw when ready).
 */
export function addGateIcon(
  group: Konva.Group,
  gate: string,
  slotWidth: number,
  slotHeight: number,
): boolean {
  const img = getGateIcon(gate);
  if (!img) return false;

  const boxW = slotWidth * 0.6;
  const boxH = slotHeight * 0.6;
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  const scale = Math.min(boxW / natW, boxH / natH);
  const width = natW * scale;
  const height = natH * scale;

  group.add(new Konva.Image({
    image: img,
    x: slotWidth * 0.2 + (boxW - width) / 2,
    y: slotHeight * 0.2 + (boxH - height) / 2,
    width,
    height,
    listening: false,
  }));
  return true;
}

/** Top-right info affordance on a placed gate slot. Returns false if still loading. */
export function addSlotInfoButton(
  group: Konva.Group,
  slotWidth: number,
  onInfo: () => void,
): boolean {
  const img = getInfoIcon();
  if (!img) return false;

  const size = Math.max(12, Math.round(slotWidth * 0.12));
  const button = new Konva.Image({
    image: img,
    x: slotWidth - size - 6,
    y: 5,
    width: size,
    height: size,
    opacity: 0.75,
  });
  button.cache();
  button.filters([Konva.Filters.Invert]);
  button.on('click tap', (event) => {
    event.cancelBubble = true;
    onInfo();
  });
  button.on('mouseenter', () => {
    button.opacity(1);
    button.getLayer()?.batchDraw();
  });
  button.on('mouseleave', () => {
    button.opacity(0.75);
    button.getLayer()?.batchDraw();
  });
  group.add(button);
  return true;
}
