const STORAGE_KEY = 'seascan.api.base';
const FALLBACK_API_BASE = 'http://localhost:8000';
const DEFAULT_API_BASE = import.meta.env?.VITE_API_BASE ?? FALLBACK_API_BASE;

export const getDefaultApiBase = () => DEFAULT_API_BASE;

export const getApiBase = () => {
  if (typeof window === 'undefined') return DEFAULT_API_BASE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_API_BASE;
  const trimmed = stored.trim();
  return trimmed || DEFAULT_API_BASE;
};

export const setApiBase = (value: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, value.trim());
};

export const clearApiBase = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const buildApiUrl = (path: string) => {
  const base = getApiBase().replace(/\/+$/, '');
  const suffix = path.replace(/^\/+/, '');
  return `${base}/${suffix}`;
};
