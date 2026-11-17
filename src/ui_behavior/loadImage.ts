/**
 * Loads an image from a file path.
 * Returns the image when it finishes loading.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  // Create a Promise because loading an image takes time.
  return new Promise((resolve, reject) => {
    // Create an empty image.
    const img = new Image();

    // If the image loads, return it.
    img.onload = () => resolve(img);

    // If loading fails, return an error.
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));

    // Start loading the image from the given path.
    img.src = url;
  });
}