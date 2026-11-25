import Konva from 'konva';
import { loadImage } from '../../../ui_behavior/loadImage';

const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement>>();

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
