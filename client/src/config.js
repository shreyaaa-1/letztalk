export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const STORAGE_KEYS = {
  token: "letztalk.token",
  user: "letztalk.user",
};
