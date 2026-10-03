import apiClient from '../services/apiClient';

// Property photos (technical document 4.6): ask the API for upload URLs, PUT
// each file to its URL, then send the returned file URLs as image_urls.

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_MB = 5;

/** Returns an error message for a file the API would refuse, or null. */
export const photoProblem = (file) => {
  if (!PHOTO_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WEBP photos`;
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_PHOTO_MB} MB`;
  return null;
};

/** Uploads the files and returns their URLs, in the same order. */
export async function uploadPhotos(files) {
  if (!files.length) return [];
  const { data } = await apiClient.post('/api/v1/uploads/presign', {
    files: files.map((f) => ({ content_type: f.type, size: f.size })),
  });
  await Promise.all(data.data.map(async (target, i) => {
    const res = await fetch(target.upload_url, { method: target.method || 'PUT', headers: target.headers, body: files[i] });
    if (!res.ok) throw new Error(`Upload of ${files[i].name} failed`);
  }));
  return data.data.map((target) => target.file_url);
}
