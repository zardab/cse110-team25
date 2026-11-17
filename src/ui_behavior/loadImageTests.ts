import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadImage } from "./loadImage.ts";

describe("loadImage", () => {
  const OriginalImage = globalThis.Image;

  beforeEach(() => {
    vi.useFakeTimers();

    // Simulate browser image loading.
    vi.stubGlobal("Image", class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private url = "";

      set src(value: string) {
        this.url = value;

        setTimeout(() => {
          if (value.includes("missing")) {
            this.onerror?.();
          } else {
            this.onload?.();
          }
        }, 100);
      }

      get src() {
        return this.url;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal("Image", OriginalImage);
    vi.unstubAllGlobals();
  });

  it("loads an image successfully", async () => {
    const promise = loadImage("test.png");

    await vi.advanceTimersByTimeAsync(100);

    const image = await promise;

    expect(image.src).toBe("test.png");
  });

  it("rejects when an image fails to load", async () => {
    const promise = loadImage("missing.png");
    const result = expect(promise).rejects.toThrow(
      "Could not load image: missing.png"
    );

    await vi.advanceTimersByTimeAsync(100);

    await result;
  });

  it("does not resolve before the image finishes loading", async () => {
    const onLoaded = vi.fn();

    loadImage("test.png").then(onLoaded);

    await vi.advanceTimersByTimeAsync(99);

    expect(onLoaded).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });
});
