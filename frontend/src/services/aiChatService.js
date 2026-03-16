/**
 * AI Chat Service
 * REST API calls for AI chat management (non-streaming operations)
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const API_BASE = API_BASE_URL ? `${API_BASE_URL}/api/v1/admin/ai` : '/api/v1/admin/ai';

function getAuthHeaders() {
  const accessToken = localStorage.getItem('auth_access_token');
  const sessionToken = localStorage.getItem('auth_session_token');
  const adminToken = localStorage.getItem('auth_admin_token');
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (sessionToken) headers['X-Session-Token'] = sessionToken;
  if (adminToken) headers['X-Admin-Token'] = adminToken;
  return headers;
}

async function parseJsonOrThrow(res, fallbackMessage) {
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error(fallbackMessage || res.statusText || 'Empty response');
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json') && !ct.includes('text/json')) {
    throw new Error(
      fallbackMessage ||
        `Expected JSON but got ${ct || 'non-JSON response'} (${res.status})`
    );
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(
      fallbackMessage ||
        `Invalid JSON response (${res.status}): ${text.slice(0, 80)}...`
    );
  }
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
  if (!res.ok) {
    let err = { detail: res.statusText };
    try {
      err = await parseJsonOrThrow(res, res.statusText);
    } catch {
      err = { detail: res.statusText };
    }
    throw new Error(
      (typeof err === 'object' && err?.detail) || `Request failed: ${res.status}`
    );
  }
  return parseJsonOrThrow(res);
}

// ── Chat Sessions ─────────────────────────────────────────────────────────

export const listChats = (archived = false) =>
  apiFetch(`/chats?archived=${archived}`);

export const createChat = () => apiFetch('/chats', { method: 'POST' });

export const getChat = (id, { limit = 100, beforeId } = {}) => {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (beforeId) params.set('before_id', beforeId);
  const qs = params.toString();
  return apiFetch(`/chats/${id}${qs ? `?${qs}` : ''}`);
};

export const updateChat = (id, data) =>
  apiFetch(`/chats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const deleteChat = (id) =>
  apiFetch(`/chats/${id}`, { method: 'DELETE' });

export const deleteChatMessage = (sessionId, messageId) =>
  apiFetch(`/chats/${sessionId}/messages/${messageId}`, { method: 'DELETE' });

// ── File Upload ───────────────────────────────────────────────────────────

export async function uploadFileToChat(sessionId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/chats/${sessionId}/upload`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let err = { detail: res.statusText };
    try {
      err = await parseJsonOrThrow(res, res.statusText);
    } catch {
      err = { detail: res.statusText };
    }
    throw new Error(err?.detail || 'Upload failed');
  }
  return parseJsonOrThrow(res);
}

// ── Memory ────────────────────────────────────────────────────────────────

export const getMemory = () => apiFetch('/memory');

export const upsertMemory = (key, data) =>
  apiFetch(`/memory/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteMemory = (key) =>
  apiFetch(`/memory/${encodeURIComponent(key)}`, { method: 'DELETE' });

// ── Training Documents ────────────────────────────────────────────────────

export const listTrainingDocs = () => apiFetch('/training');

export async function uploadTrainingDoc(file, name, description = '', tags = '') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('name', name);
  formData.append('description', description);
  formData.append('tags', tags);

  const res = await fetch(`${API_BASE}/training`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let err = { detail: res.statusText };
    try {
      err = await parseJsonOrThrow(res, res.statusText);
    } catch {
      err = { detail: res.statusText };
    }
    throw new Error(err?.detail || 'Training upload failed');
  }
  return parseJsonOrThrow(res);
}

const BATCH_CHUNK_MAX_BYTES = 4 * 1024 * 1024;

export async function uploadTrainingBatch(files, onProgress) {
  if (!files?.length) throw new Error('No files selected');
  const chunks = [];
  let current = [];
  let currentSize = 0;
  for (const file of files) {
    const size = file.size || 0;
    if (currentSize + size > BATCH_CHUNK_MAX_BYTES && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(file);
    currentSize += size;
  }
  if (current.length > 0) chunks.push(current);
  let totalUploaded = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress({ batch: i + 1, totalBatches: chunks.length, uploaded: totalUploaded });
    const formData = new FormData();
    for (const file of chunks[i]) {
      formData.append('files', file);
    }
    const res = await fetch(`${API_BASE}/training/batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      let err = { detail: res.statusText };
      try {
        err = await parseJsonOrThrow(res, res.statusText);
      } catch {
        err = { detail: res.statusText };
      }
      throw new Error(err?.detail || `Batch upload failed (batch ${i + 1}/${chunks.length})`);
    }
    const data = await parseJsonOrThrow(res);
    totalUploaded += data.uploaded || chunks[i].length;
  }
  return { uploaded: totalUploaded };
}

export const deleteTrainingDoc = (id) =>
  apiFetch(`/training/${id}`, { method: 'DELETE' });

// ── WebSocket ─────────────────────────────────────────────────────────────

export function getWebSocketToken() {
  return localStorage.getItem('auth_access_token');
}

export function createChatWebSocket(sessionId) {
  const token = getWebSocketToken();
  const base = API_BASE_URL
    ? new URL(API_BASE_URL).origin.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
  const url = `${base}/api/v1/admin/ai/ws/${sessionId}?token=${token}`;
  return new WebSocket(url);
}
