import apiClient from '../services/apiClient';
import { compressImage } from './compressImage';

// Property photos and videos (technical document 4.6): ask the API for upload
// URLs, PUT each file to its URL, then send the returned file URLs as image_urls.

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const MAX_UPLOAD_MB = 500;

/** Returns an error message for a file the API would refuse, or null. */
export const mediaProblem = (file) => {
  if (!PHOTO_TYPES.includes(file.type) && !VIDEO_TYPES.includes(file.type)) {
    return `${file.name}: only JPG, PNG or WEBP photos and MP4, MOV or WEBM videos`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_UPLOAD_MB} MB`;
  return null;
};

// XHR rather than fetch: only XHR reports upload progress
const putFile = (target, file, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open(target.method || 'PUT', target.upload_url);
  Object.entries(target.headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
  xhr.upload.onprogress = (e) => onProgress(e.loaded);
  xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload of ${file.name} failed`)));
  xhr.onerror = () => reject(new Error(`Upload of ${file.name} failed. Check the connection and try again.`));
  xhr.send(file);
});

const PARALLEL_UPLOADS = 3;

/**
 * Uploads photos (shrunk first, see compressImage) and videos, a few at a
 * time, and returns their URLs in the same order. `onProgress` gets 0..1 for
 * all the files together.
 */
export async function uploadMedia(files, onProgress) {
  if (!files.length) return [];
  const ready = await Promise.all(files.map(compressImage));
  const { data } = await apiClient.post('/api/v1/uploads/presign', {
    files: ready.map((f) => ({ content_type: f.type, size: f.size })),
  });
  const total = ready.reduce((sum, f) => sum + f.size, 0);
  const sent = ready.map(() => 0);
  const report = () => onProgress?.(sent.reduce((sum, n) => sum + n, 0) / total);
  let next = 0;
  const worker = async () => {
    while (next < ready.length) {
      const i = next++;
      await putFile(data.data[i], ready[i], (bytes) => { sent[i] = bytes; report(); });
      sent[i] = ready[i].size;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, ready.length) }, worker));
  return data.data.map((target) => target.file_url);
}
