// Shrinks a photo in the browser before it is uploaded. Phone photos are often
// 4000px and 5-10 MB, while no page shows them wider than ~2000px, so this
// makes uploads several times faster. Re-encoding also drops the EXIF data
// (including the GPS position the camera stored).

const MAX_SIDE = 2048;
const QUALITY = 0.85;
const SKIP_BELOW_BYTES = 300 * 1024;
const OUTPUT_TYPES = ['image/jpeg', 'image/webp'];

/** A smaller copy of `file`, or `file` itself when it is not a photo or can't be made smaller. */
export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.size < SKIP_BELOW_BYTES || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // PNGs may be transparent: WebP keeps that, JPEG would turn it black
    const wanted = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, wanted, QUALITY));
    // Browsers that can't encode WebP return a PNG; keep the original then
    if (!blob || !OUTPUT_TYPES.includes(blob.type) || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, '')}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`;
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
