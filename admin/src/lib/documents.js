import { useCallback, useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import { putFile } from './uploads';

// Property documents (registry, khatiyan, ...): locked files. Owners and the
// admin attach them with POST /api/v1/uploads/presign (purpose DOCUMENT) and send
// the ids as document_ids. Only the super admin can open them, by unlocking a
// property's documents with the document password; the links last 10 minutes.

export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const MAX_DOCUMENT_MB = 10;
export const MAX_DOCUMENTS = 5;

/** Returns an error message for a document the API would refuse, or null. */
export const documentProblem = (file) => {
  if (!DOCUMENT_TYPES.includes(file.type)) return `${file.name}: only PDF, JPG or PNG documents`;
  if (file.size > MAX_DOCUMENT_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_DOCUMENT_MB} MB`;
  return null;
};

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Uploads documents as they are (no shrinking: scans must stay readable) and returns their ids in order. */
export async function uploadDocuments(files, onProgress) {
  if (!files.length) return [];
  const { data } = await apiClient.post('/api/v1/uploads/presign', {
    files: files.map((f) => ({ content_type: f.type, size: f.size, purpose: 'DOCUMENT', file_name: f.name })),
  });
  const total = files.reduce((sum, f) => sum + f.size, 0);
  const sent = files.map(() => 0);
  const report = () => onProgress?.(sent.reduce((sum, n) => sum + n, 0) / total);
  await Promise.all(files.map(async (file, i) => {
    await putFile(data.data[i], file, (bytes) => { sent[i] = bytes; report(); });
    sent[i] = file.size;
    report();
  }));
  return data.data.map((target) => target.document_id);
}

/**
 * Unlocking one property's documents. `links` maps a document id to a URL
 * that opens it, until `expiresAt`; after that the documents lock again.
 */
export function useDocumentUnlock(propertyId) {
  const [links, setLinks] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const lock = useCallback(() => {
    setLinks(null);
    setExpiresAt(null);
  }, []);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = setTimeout(lock, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [expiresAt, lock]);

  useEffect(lock, [propertyId, lock]);

  // Throws the API error (wrong password, locked out, ...) for the caller to show
  const unlock = useCallback(async (password) => {
    const { data } = await apiClient.post(`/api/v1/admin/properties/${propertyId}/documents/unlock`, { password });
    setLinks(Object.fromEntries(data.data.documents.map((d) => [d.id, d.url])));
    setExpiresAt(Date.now() + data.data.expires_in * 1000);
  }, [propertyId]);

  return { links, expiresAt, unlock, lock };
}
