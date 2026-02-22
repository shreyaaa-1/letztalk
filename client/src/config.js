const runtimeHost = typeof window !== "undefined" ? window.location.hostname : "localhost";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `http://${runtimeHost}:5000/api`;
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || `http://${runtimeHost}:5000`;

export const STORAGE_KEYS = {
  token: "letztalk.token",
  user: "letztalk.user",
};
