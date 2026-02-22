import axios from "axios";
import { API_BASE_URL } from "../config";
import { getToken } from "../lib/storage";

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default http;
