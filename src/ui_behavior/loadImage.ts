/**
 * Loads an image file. Resolves with the loaded image element,
 * or rejects if the file can't be loaded.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Could not load image: ${url}`));
		img.src = url;
	});
}