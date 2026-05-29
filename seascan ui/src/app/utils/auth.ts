const TOKEN_KEY = 'seascan.auth.token';
const USER_KEY = 'seascan.auth.user';
const AUTH_EVENT = 'seascan-auth-change';

export type AuthUser = {
  username: string;
  role: 'admin' | 'user';
};

export const getAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
};

export const setAccessToken = (token: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearAccessToken = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const getStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: AuthUser) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const clearStoredUser = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const onAuthChange = (handler: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
};
