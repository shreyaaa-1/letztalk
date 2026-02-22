import { STORAGE_KEYS } from "../config";

export const getToken = () => localStorage.getItem(STORAGE_KEYS.token);

export const setSession = ({ token, user }) => {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.token);
  }

  if (user) {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEYS.user);
  }
};

export const getStoredUser = () => {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
};
